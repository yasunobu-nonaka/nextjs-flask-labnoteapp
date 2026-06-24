"""
グループ参加申請 API のテスト。

対象エンドポイント:
  POST   /api/organizations/<org_id>/groups/<group_id>/join
  GET    /api/organizations/<org_id>/groups/<group_id>/join-requests
  GET    /api/organizations/<org_id>/groups/<group_id>/join-requests/count
  PATCH  /api/organizations/<org_id>/groups/<group_id>/join-requests/<target_user_id>
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


# ---------------------------------------------------------------------------
# POST /join
# ---------------------------------------------------------------------------

class TestJoinGroup:
    def test_join_open_group(self, client, auth_headers):
        """join_method='open' のグループに申請すると即座に active で参加できる。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "open")

        # 2人目のユーザーを組織に追加してから参加申請する
        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)

        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )

        assert res.status_code == 201
        data = res.get_json()
        assert data["result"] == "joined"
        assert data["member"]["status"] == "active"

    def test_join_request_group(self, client, auth_headers):
        """join_method='request' のグループに申請すると pending になる。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)

        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )

        assert res.status_code == 201
        data = res.get_json()
        assert data["result"] == "pending"
        assert data["member"]["status"] == "pending"

    def test_join_invite_only_group(self, client, auth_headers):
        """join_method='invite_only' のグループへの申請は 403 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        # デフォルトは invite_only なのでポリシー変更不要

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)

        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )

        assert res.status_code == 403

    def test_join_already_member(self, client, auth_headers):
        """すでに active メンバーが再度参加申請すると 409 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "open")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)

        # 1度目は成功
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )
        # 2度目は 409
        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )
        assert res.status_code == 409
        assert "already" in res.get_json()["message"] or "メンバー" in res.get_json()["message"]

    def test_join_already_pending(self, client, auth_headers):
        """pending 中に再度申請すると 409 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)

        # 1度目は pending
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )
        # 2度目は 409
        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )
        assert res.status_code == 409

    def test_join_not_org_member(self, client, auth_headers):
        """組織外のユーザーが参加申請すると 403 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "open")

        outsider_headers = register_and_get_headers(client, "outsider", "outsider@example.com")

        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=outsider_headers,
        )
        assert res.status_code == 403

    def test_join_unauthorized(self, client, auth_headers):
        """未認証で参加申請すると 401 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])

        res = client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
        )
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# GET /join-requests
# ---------------------------------------------------------------------------

class TestListJoinRequests:
    def test_list_by_group_admin(self, client, auth_headers):
        """グループ admin が pending 申請一覧を取得できる。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )

        res = client.get(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]["user_id"] == user2_id
        assert data[0]["status"] == "pending"

    def test_list_by_non_admin(self, client, auth_headers):
        """グループ admin でないユーザーが申請一覧を取得しようとすると 403 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "open")

        # user2 を参加させる（editor ロール）
        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )

        res = client.get(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests",
            headers=user2_headers,
        )
        assert res.status_code == 403

    def test_list_empty(self, client, auth_headers):
        """pending 申請がない場合は空配列を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])

        res = client.get(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json() == []


# ---------------------------------------------------------------------------
# GET /join-requests/count
# ---------------------------------------------------------------------------

class TestCountJoinRequests:
    def test_count_with_pending(self, client, auth_headers):
        """pending 申請が2件あれば count=2 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        for i in range(2):
            u_headers = register_and_get_headers(client, f"user{i}", f"user{i}@example.com")
            u_id = get_user_id(client, f"user{i}@example.com")
            add_org_member(client, auth_headers["headers"], org["id"], u_id)
            client.post(
                f"/api/organizations/{org['id']}/groups/{group['id']}/join",
                headers=u_headers,
            )

        res = client.get(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/count",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json()["count"] == 2

    def test_count_empty(self, client, auth_headers):
        """pending 申請がなければ count=0 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])

        res = client.get(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/count",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json()["count"] == 0

    def test_count_by_non_admin(self, client, auth_headers):
        """グループ admin でないユーザーがカウントを取得しようとすると 403 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "open")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )

        res = client.get(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/count",
            headers=user2_headers,
        )
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /join-requests/<target_user_id>
# ---------------------------------------------------------------------------

class TestApproveRejectJoinRequest:
    def _setup(self, client, auth_headers):
        """request グループを作成し user2 に申請させて org/group/user2_id を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])
        set_join_method(client, auth_headers["headers"], org["id"], group["id"], "request")

        user2_headers = register_and_get_headers(client, "user2", "user2@example.com")
        user2_id = get_user_id(client, "user2@example.com")
        add_org_member(client, auth_headers["headers"], org["id"], user2_id)
        client.post(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join",
            headers=user2_headers,
        )
        return org["id"], group["id"], user2_id

    def test_approve(self, client, auth_headers):
        """承認すると申請者の status が active になる。"""
        org_id, group_id, user2_id = self._setup(client, auth_headers)

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}/join-requests/{user2_id}",
            json={"action": "approve"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        data = res.get_json()
        assert data["member"]["status"] == "active"
        assert data["member"]["user_id"] == user2_id

    def test_reject(self, client, auth_headers):
        """拒否するとレコードが削除され 204 を返す。"""
        org_id, group_id, user2_id = self._setup(client, auth_headers)

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}/join-requests/{user2_id}",
            json={"action": "reject"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 204

        # 拒否後は申請一覧に表示されない
        list_res = client.get(
            f"/api/organizations/{org_id}/groups/{group_id}/join-requests",
            headers=auth_headers["headers"],
        )
        assert list_res.get_json() == []

    def test_approve_not_found(self, client, auth_headers):
        """存在しない申請を承認しようとすると 404 を返す。"""
        org = create_org(client, auth_headers["headers"])
        group = create_group(client, auth_headers["headers"], org["id"])

        res = client.patch(
            f"/api/organizations/{org['id']}/groups/{group['id']}/join-requests/9999",
            json={"action": "approve"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 404

    def test_approve_by_non_admin(self, client, auth_headers):
        """グループ admin でないユーザーが承認しようとすると 403 を返す。"""
        org_id, group_id, user2_id = self._setup(client, auth_headers)

        user3_headers = register_and_get_headers(client, "user3", "user3@example.com")
        user3_id = get_user_id(client, "user3@example.com")
        add_org_member(client, auth_headers["headers"], org_id, user3_id)

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}/join-requests/{user2_id}",
            json={"action": "approve"},
            headers=user3_headers,
        )
        assert res.status_code == 403

    def test_approve_invalid_action(self, client, auth_headers):
        """action が不正な値の場合は 400 を返す。"""
        org_id, group_id, user2_id = self._setup(client, auth_headers)

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}/join-requests/{user2_id}",
            json={"action": "invalid"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400
