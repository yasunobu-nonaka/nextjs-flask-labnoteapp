"""
グループ（Group）APIのテスト。
グループのCRUD、メンバー管理、ポリシー更新を検証する。
"""

from conftest import register_user, login_and_get_token
from app.extensions import db
from app.model import User


def register_and_get_headers(client, username: str, email: str, password: str = "password1234"):
    """テスト用ヘルパー：ユーザーを登録してAuthヘッダーを返す。"""
    register_user(client, username=username, email=email, password=password)
    token = login_and_get_token(client, identifier=email, password=password)
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def get_user_id(client, email: str) -> int:
    """テスト用ヘルパー：メールアドレスからユーザーIDを取得する。"""
    with client.application.app_context():
        user = db.session.execute(
            db.select(User).filter_by(email=email)
        ).scalar_one()
        return user.id


def create_org(client, headers, name: str = "テスト組織") -> dict:
    """テスト用ヘルパー：組織を作成する。"""
    res = client.post(
        "/api/organizations",
        json={"name": name},
        headers=headers,
    )
    return res.get_json()["organization"]


def create_group(client, headers, org_id: int, name: str = "テストグループ", is_private: bool = False) -> dict:
    """テスト用ヘルパー：グループを作成する。"""
    res = client.post(
        f"/api/organizations/{org_id}/groups",
        json={"name": name, "is_private": is_private},
        headers=headers,
    )
    return res


###############################################
#  グループ作成テスト
###############################################
class TestGroupCreation:
    def test_create_group(self, client, auth_headers):
        """通常メンバーがグループを作成できる。"""
        org = create_org(client, auth_headers["headers"])
        org_id = org["id"]

        res = create_group(client, auth_headers["headers"], org_id)
        data = res.get_json()

        assert res.status_code == 201
        assert "group" in data
        group = data["group"]
        assert group["name"] == "テストグループ"
        assert group["is_private"] is False
        assert group["role"] == "admin"
        assert group["organization_id"] == org_id
        # デフォルトポリシーの確認
        assert group["policy"]["allow_private_notes"] is True
        assert group["policy"]["join_method"] == "invite_only"
        assert group["policy"]["is_notes_visible_to_org"] is False

    def test_create_private_group(self, client, auth_headers):
        """プライベートグループが作成できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        res = create_group(client, auth_headers["headers"], org_id, is_private=True)

        assert res.status_code == 201
        assert res.get_json()["group"]["is_private"] is True

    def test_create_group_no_name(self, client, auth_headers):
        """名前なしでグループ作成するとバリデーションエラー。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        res = client.post(
            f"/api/organizations/{org_id}/groups",
            json={},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_create_group_no_org_access(self, client, auth_headers):
        """組織に所属していないユーザーはグループを作成できない。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        other_headers = register_and_get_headers(client, "other", "other@example.com")

        res = client.post(
            f"/api/organizations/{org_id}/groups",
            json={"name": "不正なグループ"},
            headers=other_headers,
        )
        assert res.status_code == 403

    def test_create_group_restricted_by_policy(self, client, auth_headers):
        """ポリシーで制限されているロールではグループを作成できない。"""
        org_id = create_org(client, auth_headers["headers"])["id"]

        # ポリシーをsys_admin_onlyに変更
        client.patch(
            f"/api/organizations/{org_id}",
            json={"policy": {"who_can_create_groups": "sys_admin_only"}},
            headers=auth_headers["headers"],
        )

        # 通常memberを追加
        other_headers = register_and_get_headers(client, "member3", "member3@example.com")
        member_id = get_user_id(client, "member3@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": member_id, "role": "member"},
            headers=auth_headers["headers"],
        )

        res = client.post(
            f"/api/organizations/{org_id}/groups",
            json={"name": "作れないはず"},
            headers=other_headers,
        )
        assert res.status_code == 403

    def test_create_private_group_blocked_by_policy(self, client, auth_headers):
        """組織ポリシーでプライベートグループが禁止されている場合はエラー。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        client.patch(
            f"/api/organizations/{org_id}",
            json={"policy": {"allow_private_groups": False}},
            headers=auth_headers["headers"],
        )

        res = create_group(client, auth_headers["headers"], org_id, is_private=True)
        assert res.status_code == 403


###############################################
#  グループ一覧・詳細取得テスト
###############################################
class TestGroupRead:
    def test_list_groups(self, client, auth_headers):
        """作成したグループが一覧に表示される。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        create_group(client, auth_headers["headers"], org_id, "グループA")
        create_group(client, auth_headers["headers"], org_id, "グループB")

        res = client.get(
            f"/api/organizations/{org_id}/groups",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 2

    def test_list_groups_hides_private_from_non_members(self, client, auth_headers):
        """プライベートグループは所属していないユーザーには表示されない。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        create_group(client, auth_headers["headers"], org_id, "公開", is_private=False)
        create_group(client, auth_headers["headers"], org_id, "非公開", is_private=True)

        # 別の組織メンバーを追加（グループには所属させない）
        other_headers = register_and_get_headers(client, "viewer", "viewer@example.com")
        viewer_id = get_user_id(client, "viewer@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": viewer_id, "role": "member"},
            headers=auth_headers["headers"],
        )

        res = client.get(
            f"/api/organizations/{org_id}/groups",
            headers=other_headers,
        )
        assert res.status_code == 200
        data = res.get_json()
        # 公開グループのみ表示される
        assert len(data) == 1
        assert data[0]["name"] == "公開"

    def test_get_group_detail(self, client, auth_headers):
        """グループの詳細を取得できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        res = client.get(
            f"/api/organizations/{org_id}/groups/{group_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["id"] == group_id

    def test_get_private_group_denied_for_non_members(self, client, auth_headers):
        """プライベートグループは所属メンバー以外は詳細取得できない。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(
            client, auth_headers["headers"], org_id, is_private=True
        ).get_json()["group"]["id"]

        other_headers = register_and_get_headers(client, "nonmember", "nonmember@example.com")
        other_id = get_user_id(client, "nonmember@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": other_id, "role": "member"},
            headers=auth_headers["headers"],
        )

        res = client.get(
            f"/api/organizations/{org_id}/groups/{group_id}",
            headers=other_headers,
        )
        assert res.status_code == 403


###############################################
#  グループ更新テスト
###############################################
class TestGroupUpdate:
    def test_update_group_name(self, client, auth_headers):
        """グループadminはグループ名を変更できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}",
            json={"name": "変更後のグループ名"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["name"] == "変更後のグループ名"

    def test_update_group_policy(self, client, auth_headers):
        """グループadminはグループポリシーを変更できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}",
            json={"policy": {"is_notes_visible_to_org": True, "join_method": "open"}},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        policy = res.get_json()["policy"]
        assert policy["is_notes_visible_to_org"] is True
        assert policy["join_method"] == "open"

    def test_update_group_forbidden_for_viewer(self, client, auth_headers):
        """viewerロールはグループを更新できない。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        viewer_headers = register_and_get_headers(client, "viewer2", "viewer2@example.com")
        viewer_id = get_user_id(client, "viewer2@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": viewer_id, "role": "member"},
            headers=auth_headers["headers"],
        )
        client.post(
            f"/api/organizations/{org_id}/groups/{group_id}/members",
            json={"user_id": viewer_id, "role": "viewer"},
            headers=auth_headers["headers"],
        )

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}",
            json={"name": "変更しようとした"},
            headers=viewer_headers,
        )
        assert res.status_code == 403


###############################################
#  グループ削除テスト
###############################################
class TestGroupDeletion:
    def test_delete_group(self, client, auth_headers):
        """グループadminはグループを削除できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        res = client.delete(
            f"/api/organizations/{org_id}/groups/{group_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 204

        # 削除後は取得できない
        res2 = client.get(
            f"/api/organizations/{org_id}/groups/{group_id}",
            headers=auth_headers["headers"],
        )
        assert res2.status_code == 404


###############################################
#  グループメンバー管理テスト
###############################################
class TestGroupMembers:
    def test_add_group_member(self, client, auth_headers):
        """グループadminは組織メンバーをグループに追加できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        other_headers = register_and_get_headers(client, "gm1user", "gm1@example.com")
        gm1_id = get_user_id(client, "gm1@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": gm1_id, "role": "member"},
            headers=auth_headers["headers"],
        )

        res = client.post(
            f"/api/organizations/{org_id}/groups/{group_id}/members",
            json={"user_id": gm1_id, "role": "editor"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 201
        assert res.get_json()["member"]["role"] == "editor"

    def test_add_non_org_member_to_group_fails(self, client, auth_headers):
        """組織メンバーでないユーザーはグループに追加できない。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        register_and_get_headers(client, "outsider", "outsider@example.com")
        outsider_id = get_user_id(client, "outsider@example.com")

        res = client.post(
            f"/api/organizations/{org_id}/groups/{group_id}/members",
            json={"user_id": outsider_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_list_group_members(self, client, auth_headers):
        """グループメンバー一覧にadminが含まれる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        res = client.get(
            f"/api/organizations/{org_id}/groups/{group_id}/members",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]["role"] == "admin"

    def test_update_group_member_role(self, client, auth_headers):
        """グループadminはメンバーのロールを変更できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        other_headers = register_and_get_headers(client, "roletest", "roletest@example.com")
        rt_id = get_user_id(client, "roletest@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": rt_id},
            headers=auth_headers["headers"],
        )
        client.post(
            f"/api/organizations/{org_id}/groups/{group_id}/members",
            json={"user_id": rt_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}/members/{rt_id}",
            json={"role": "viewer"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["member"]["role"] == "viewer"

    def test_remove_group_member(self, client, auth_headers):
        """グループadminはメンバーを削除できる。"""
        org_id = create_org(client, auth_headers["headers"])["id"]
        group_id = create_group(client, auth_headers["headers"], org_id).get_json()["group"]["id"]

        other_headers = register_and_get_headers(client, "todel", "todel@example.com")
        del_id = get_user_id(client, "todel@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": del_id},
            headers=auth_headers["headers"],
        )
        client.post(
            f"/api/organizations/{org_id}/groups/{group_id}/members",
            json={"user_id": del_id},
            headers=auth_headers["headers"],
        )

        res = client.delete(
            f"/api/organizations/{org_id}/groups/{group_id}/members/{del_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 204
