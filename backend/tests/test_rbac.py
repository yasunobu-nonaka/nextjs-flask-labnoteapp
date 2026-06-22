"""
RBACシステムのテスト。
Permission・RoleGlobal・RoleLocal のシードデータ検証と、
パーミッションチェック関数の動作を検証する。
"""

import pytest
from conftest import register_user, login_and_get_token
from app.extensions import db
from app.model import User
from app.model.rbac import Permission, RoleGlobal, RoleLocal


def register_and_get_headers(client, username: str, email: str, password: str = "password1234"):
    """テスト用ヘルパー：ユーザーを登録してAuthヘッダーを返す。"""
    register_user(client, username=username, email=email, password=password)
    token = login_and_get_token(client, identifier=email, password=password)
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


###############################################
#  シードデータの検証
###############################################
class TestRbacSeedData:
    def test_all_org_permissions_seeded(self, app):
        """組織レベルのパーミッションが全て投入されている。"""
        with app.app_context():
            expected_codes = [
                "org:read", "org:edit", "org:delete",
                "org:member_add", "org:member_remove", "org:member_role_assign",
                "org:group_create", "org:group_manage_any",
            ]
            for code in expected_codes:
                perm = db.session.execute(
                    db.select(Permission).filter_by(code=code)
                ).scalar_one_or_none()
                assert perm is not None, f"パーミッション '{code}' がDBに存在しない"

    def test_all_group_permissions_seeded(self, app):
        """グループレベルのパーミッションが全て投入されている。"""
        with app.app_context():
            expected_codes = [
                "group:read", "group:edit", "group:delete",
                "group:member_add", "group:member_remove", "group:member_role_assign",
                "note:create", "note:read", "note:edit", "note:delete",
            ]
            for code in expected_codes:
                perm = db.session.execute(
                    db.select(Permission).filter_by(code=code)
                ).scalar_one_or_none()
                assert perm is not None, f"パーミッション '{code}' がDBに存在しない"

    def test_all_org_roles_seeded(self, app):
        """組織ロール（owner/sys_admin/user_admin/member）が全て投入されている。"""
        with app.app_context():
            for role_name in ["owner", "sys_admin", "user_admin", "member"]:
                role = db.session.execute(
                    db.select(RoleGlobal).filter_by(name=role_name)
                ).scalar_one_or_none()
                assert role is not None, f"組織ロール '{role_name}' がDBに存在しない"

    def test_all_group_roles_seeded(self, app):
        """グループロール（admin/editor/viewer）が全て投入されている。"""
        with app.app_context():
            for role_name in ["admin", "editor", "viewer"]:
                role = db.session.execute(
                    db.select(RoleLocal).filter_by(name=role_name)
                ).scalar_one_or_none()
                assert role is not None, f"グループロール '{role_name}' がDBに存在しない"


###############################################
#  RoleGlobal パーミッション検証
###############################################
class TestRoleGlobalPermissions:
    def test_owner_has_all_org_permissions(self, app):
        """ownerは全ての組織パーミッションを持つ。"""
        with app.app_context():
            owner = db.session.execute(
                db.select(RoleGlobal).filter_by(name="owner")
            ).scalar_one()

            assert owner.has_permission("org:read")
            assert owner.has_permission("org:edit")
            assert owner.has_permission("org:delete")
            assert owner.has_permission("org:member_add")
            assert owner.has_permission("org:member_remove")
            assert owner.has_permission("org:member_role_assign")
            assert owner.has_permission("org:group_create")
            assert owner.has_permission("org:group_manage_any")

    def test_sys_admin_cannot_delete_org(self, app):
        """sys_adminはorg:deleteを持たない。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleGlobal).filter_by(name="sys_admin")
            ).scalar_one()
            assert not role.has_permission("org:delete")

    def test_user_admin_cannot_edit_org_settings(self, app):
        """user_adminはorg:editを持たない（設定変更不可）。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleGlobal).filter_by(name="user_admin")
            ).scalar_one()
            assert not role.has_permission("org:edit")
            assert not role.has_permission("org:member_role_assign")

    def test_member_has_only_read_and_group_create(self, app):
        """memberはorg:readとorg:group_createのみを持つ。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleGlobal).filter_by(name="member")
            ).scalar_one()
            assert role.has_permission("org:read")
            assert role.has_permission("org:group_create")
            assert not role.has_permission("org:edit")
            assert not role.has_permission("org:member_add")
            assert not role.has_permission("org:delete")


###############################################
#  RoleLocal パーミッション検証
###############################################
class TestRoleLocalPermissions:
    def test_admin_has_all_group_permissions(self, app):
        """グループadminは全てのグループパーミッションを持つ。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleLocal).filter_by(name="admin")
            ).scalar_one()

            assert role.has_permission("group:read")
            assert role.has_permission("group:edit")
            assert role.has_permission("group:delete")
            assert role.has_permission("group:member_add")
            assert role.has_permission("group:member_remove")
            assert role.has_permission("group:member_role_assign")
            assert role.has_permission("note:create")
            assert role.has_permission("note:read")
            assert role.has_permission("note:edit")
            assert role.has_permission("note:delete")

    def test_editor_cannot_manage_group(self, app):
        """editorはグループ設定・メンバー管理権限を持たない。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleLocal).filter_by(name="editor")
            ).scalar_one()
            assert not role.has_permission("group:edit")
            assert not role.has_permission("group:delete")
            assert not role.has_permission("group:member_add")

    def test_editor_can_manage_notes(self, app):
        """editorはノートの全CRUD権限を持つ。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleLocal).filter_by(name="editor")
            ).scalar_one()
            assert role.has_permission("note:create")
            assert role.has_permission("note:read")
            assert role.has_permission("note:edit")
            assert role.has_permission("note:delete")

    def test_viewer_can_only_read(self, app):
        """viewerはgroup:readとnote:readのみを持つ。"""
        with app.app_context():
            role = db.session.execute(
                db.select(RoleLocal).filter_by(name="viewer")
            ).scalar_one()
            assert role.has_permission("group:read")
            assert role.has_permission("note:read")
            assert not role.has_permission("note:create")
            assert not role.has_permission("note:edit")
            assert not role.has_permission("note:delete")
            assert not role.has_permission("group:edit")


###############################################
#  API 経由のパーミッションチェック
###############################################
class TestPermissionCheckViaApi:
    def test_check_org_permission_owner(self, client, auth_headers):
        """ownerはorg:editパーミッションを持つ（API経由で組織編集が成功する）。"""
        res = client.post(
            "/api/organizations",
            json={"name": "テスト組織"},
            headers=auth_headers["headers"],
        )
        org_id = res.get_json()["organization"]["id"]

        # ownerとして組織設定を変更できる
        res2 = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "変更後の名前"},
            headers=auth_headers["headers"],
        )
        assert res2.status_code == 200

    def test_check_org_permission_member_cannot_edit(self, client, auth_headers):
        """memberはorg:editパーミッションを持たない（API経由で組織編集が403になる）。"""
        res = client.post(
            "/api/organizations",
            json={"name": "テスト組織"},
            headers=auth_headers["headers"],
        )
        org_id = res.get_json()["organization"]["id"]

        member_headers = register_and_get_headers(client, "memtest", "memtest@example.com")
        from app.extensions import db as _db
        from app.model import User
        with client.application.app_context():
            user = _db.session.execute(
                _db.select(User).filter_by(email="memtest@example.com")
            ).scalar_one()
            client.post(
                f"/api/organizations/{org_id}/members",
                json={"user_id": user.id, "role": "member"},
                headers=auth_headers["headers"],
            )

        res2 = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "変更しようとした"},
            headers=member_headers,
        )
        assert res2.status_code == 403

    def test_check_group_permission_viewer_cannot_update_group(self, client, auth_headers):
        """viewerはgroup:editパーミッションを持たない（グループ更新が403になる）。"""
        org_res = client.post(
            "/api/organizations",
            json={"name": "テスト組織"},
            headers=auth_headers["headers"],
        )
        org_id = org_res.get_json()["organization"]["id"]

        grp_res = client.post(
            f"/api/organizations/{org_id}/groups",
            json={"name": "テストグループ"},
            headers=auth_headers["headers"],
        )
        group_id = grp_res.get_json()["group"]["id"]

        viewer_headers = register_and_get_headers(client, "viewtest", "viewtest@example.com")
        from app.extensions import db as _db
        from app.model import User
        with client.application.app_context():
            user = _db.session.execute(
                _db.select(User).filter_by(email="viewtest@example.com")
            ).scalar_one()
            client.post(
                f"/api/organizations/{org_id}/members",
                json={"user_id": user.id},
                headers=auth_headers["headers"],
            )
            client.post(
                f"/api/organizations/{org_id}/groups/{group_id}/members",
                json={"user_id": user.id, "role": "viewer"},
                headers=auth_headers["headers"],
            )

        res = client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}",
            json={"name": "変更しようとした"},
            headers=viewer_headers,
        )
        assert res.status_code == 403
