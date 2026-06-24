"""
通知 API のテスト。

対象エンドポイント:
  GET /api/notifications

ログインユーザーがグループ admin を務めるグループへの pending 参加申請を返す。
"""

from conftest import register_user, login_and_get_token
from app.extensions import db
from app.model import User


# ---------------------------------------------------------------------------
# テスト用ヘルパー
# ---------------------------------------------------------------------------

def register_and_get_headers(client, username: str, email: str, password: str = "password1234"):
    """ユーザーを登録して認証ヘッダーを返す。"""
    register_user(client, username=username, email=email, password=password)
    token = login_and_get_token(client, identifier=email, password=password)
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def get_user_id(client, email: str) -> int:
    """メールアドレスからユーザー ID を取得する。"""
    with client.application.app_context():
        user = db.session.execute(
            db.select(User).filter_by(email=email)
        ).scalar_one()
        return user.id


def create_org(client, headers, name: str = "テスト組織") -> dict:
    """組織を作成して辞書を返す。"""
    res = client.post(
        "/api/organizations",
        json={"name": name},
        headers=headers,
    )
    return res.get_json()["organization"]


def create_group(client, headers, org_id: int, name: str = "テストグループ") -> dict:
    """グループを作成して辞書を返す。"""
    res = client.post(
        f"/api/organizations/{org_id}/groups",
        json={"name": name},
        headers=headers,
    )
    return res.get_json()["group"]


def set_join_method(client, headers, org_id: int, group_id: int, join_method: str) -> None:
    """グループの参加方式ポリシーを更新する。"""
    client.patch(
        f"/api/organizations/{org_id}/groups/{group_id}",
        json={"policy": {"join_method": join_method}},
        headers=headers,
    )


def add_org_member(client, admin_headers, org_id: int, user_id: int, role: str = "member") -> None:
    """ユーザーを組織メンバーとして追加する。"""
    client.post(
        f"/api/organizations/{org_id}/members",
        json={"user_id": user_id, "role": role},
        headers=admin_headers,
    )


def send_join_request(client, headers, org_id: int, group_id: int) -> None:
    """グループへの参加申請を送る。"""
    client.post(
        f"/api/organizations/{org_id}/groups/{group_id}/join",
        headers=headers,
    )


# ---------------------------------------------------------------------------
# GET /api/notifications
# ---------------------------------------------------------------------------

class TestGetNotifications:
    def test_no_pending_returns_empty(self, client, auth_headers):
        """pending 申請がない場合は空配列を返す。"""
        res = client.get("/api/notifications", headers=auth_headers["headers"])

        assert res.status_code == 200
        assert res.get_json() == []

    def test_returns_pending_for_admin(self, client, auth_headers):
        """自分が admin のグループに pending 申請があれば通知を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        send_join_request(client, user2_headers, org["id"], group["id"])

        res = client.get("/api/notifications", headers=auth_headers["headers"])

        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]["type"] == "join_request"
        assert data[0]["group_id"] == group["id"]
        assert data[0]["org_id"] == org["id"]
        assert data[0]["requester_user_id"] == user2_id

    def test_multiple_groups(self, client, auth_headers):
        """admin を務める複数グループに申請があれば全件返す。"""
        org = create_org(client, auth_headers["headers"])

        group1 = create_group(client, auth_headers["headers"], org["id"], "グループ1")
        group2 = create_group(client, auth_headers["headers"], org["id"], "グループ2")
        set_join_method(client, auth_headers["headers"], org["id"], group1["id"], "request")
        set_join_method(client, auth_headers["headers"], org["id"], group2["id"], "request")

        # user2 がグループ1に申請、user3 がグループ2に申請
        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user3_headers = register_and_get_headers(client, "user3", "user3@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        user3_id = get_user_id(client, "user3@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        add_org_member(client, auth_headers["headers"], org["id"], user3_id)
        send_join_request(client, user2_headers, org["id"], group1["id"])
        send_join_request(client, user3_headers, org["id"], group2["id"])

        res = client.get("/api/notifications", headers=auth_headers["headers"])

        assert res.status_code == 200
        assert len(res.get_json()) == 2

    def test_not_admin_returns_empty(self, client, auth_headers):
        """グループ admin でないユーザー（editor）には通知が返らない。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "open")

        # user2 を open グループに参加させる（editor ロール）
        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        send_join_request(client, user2_headers, org["id"], group["id"])

        # user3 が参加申請（user2 は editor なので通知は届かないはず）
        user3_headers = register_and_get_headers(client, "user3", "user3@example.com")
        user3_id = get_user_id(client, "user3@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user3_id)

        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")
        send_join_request(client, user3_headers, org["id"], group["id"])

        res = client.get("/api/notifications", headers=user2_headers)

        assert res.status_code == 200
        assert res.get_json() == []

    def test_approved_not_included(self, client, auth_headers):
        """承認済みの申請は通知に含まれない。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        send_join_request(client, user2_headers, org["id"], group["id"])

        # 申請を承認する
        client.patch(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/{user2_id}",
            json={"action": "approve"},
            headers=auth_headers["headers"],
        )

        res = client.get("/api/notifications", headers=auth_headers["headers"])

        assert res.status_code == 200
        assert res.get_json() == []

    def test_unauthorized(self, client):
        """未認証で通知を取得しようとすると 401 を返す。"""
        res = client.get("/api/notifications")
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# 申請者向け通知（承認・拒否）
# ---------------------------------------------------------------------------


class TestMemberResultNotifications:
    """join_request_approved / join_request_rejected 通知のテスト。"""

    def _setup_with_request(self, client, auth_headers):
        """request グループを作成し user2 に申請させて返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        send_join_request(client, user2_headers, org["id"], group["id"])

        return org, group, user2_headers, user2_id

    def test_approved_notification_returned_to_requester(self, client, auth_headers):
        """承認されると申請者の通知一覧に join_request_approved が返る。"""
        org, group, user2_headers, user2_id = self._setup_with_request(client, auth_headers)

        client.patch(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/{user2_id}",
            json={"action": "approve"},
            headers=auth_headers["headers"],
        )

        res = client.get("/api/notifications", headers=user2_headers)

        assert res.status_code == 200
        data = res.get_json()
        approved = [n for n in data if n["type"] == "join_request_approved"]
        assert len(approved) == 1
        assert approved[0]["group_id"] == group["id"]
        assert approved[0]["approved_at"] is not None

    def test_rejected_notification_returned_to_requester(self, client, auth_headers):
        """拒否されると申請者の通知一覧に join_request_rejected が返る。"""
        org, group, user2_headers, user2_id = self._setup_with_request(client, auth_headers)

        client.patch(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/{user2_id}",
            json={"action": "reject"},
            headers=auth_headers["headers"],
        )

        res = client.get("/api/notifications", headers=user2_headers)

        assert res.status_code == 200
        data = res.get_json()
        rejected = [n for n in data if n["type"] == "join_request_rejected"]
        assert len(rejected) == 1
        assert rejected[0]["group_id"] == group["id"]
        assert rejected[0]["rejected_at"] is not None

    def test_directly_added_member_has_no_approved_notification(self, client, auth_headers):
        """管理者が直接追加したメンバーには承認通知が出ない（approved_at が None のため）。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)

        # 申請フローではなく管理者が直接追加
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        res = client.get("/api/notifications", headers=user2_headers)

        assert res.status_code == 200
        approved = [n for n in res.get_json() if n["type"] == "join_request_approved"]
        assert approved == []

    def test_dismiss_rejected_removes_notification(self, client, auth_headers):
        """DELETE /api/notifications/rejected で拒否通知が消える。"""
        org, group, user2_headers, user2_id = self._setup_with_request(client, auth_headers)

        client.patch(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/{user2_id}",
            json={"action": "reject"},
            headers=auth_headers["headers"],
        )

        # dismiss 前は通知がある
        before = client.get("/api/notifications", headers=user2_headers).get_json()
        assert any(n["type"] == "join_request_rejected" for n in before)

        # dismiss する
        res = client.delete("/api/notifications/rejected", headers=user2_headers)
        assert res.status_code == 204

        # dismiss 後は通知がない
        after = client.get("/api/notifications", headers=user2_headers).get_json()
        assert not any(n["type"] == "join_request_rejected" for n in after)

    def test_dismiss_unauthorized(self, client):
        """未認証で dismiss しようとすると 401 を返す。"""
        res = client.delete("/api/notifications/rejected")
        assert res.status_code == 401

    def test_response_shape(self, client, auth_headers):
        """レスポンスの各通知に必須フィールドが含まれている。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        send_join_request(client, user2_headers, org["id"], group["id"])

        res = client.get("/api/notifications", headers=auth_headers["headers"])
        notification = res.get_json()[0]

        # 必須フィールドの存在確認
        assert notification["type"] == "join_request"
        assert "org_id" in notification
        assert "group_id" in notification
        assert "group_name" in notification
        assert "requester_user_id" in notification
        assert "requester_username" in notification
        assert "requester_email" in notification
        assert "requested_at" in notification
