"""
組織（Organization）APIのテスト。
組織のCRUD、メンバー管理、ポリシー更新を検証する。
"""

from conftest import register_user, login_and_get_token


def create_org(client, auth_headers, name: str = "テスト組織"):
    """テスト用ヘルパー：組織を作成する。"""
    return client.post(
        "/api/organizations",
        json={"name": name},
        headers=auth_headers["headers"],
    )


def register_and_get_headers(client, username: str, email: str, password: str = "password1234"):
    """テスト用ヘルパー：ユーザーを登録してAuthヘッダーを返す。"""
    register_user(client, username=username, email=email, password=password)
    token = login_and_get_token(client, identifier=email, password=password)
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


###############################################
#  組織の作成テスト
###############################################
class TestOrganizationCreation:
    def test_create_organization(self, client, auth_headers):
        """組織が正常に作成される。"""
        res = create_org(client, auth_headers)

        data = res.get_json()
        assert res.status_code == 201
        assert "organization" in data
        org = data["organization"]
        assert org["name"] == "テスト組織"
        assert org["role"] == "owner"
        assert "id" in org
        assert "policy" in org
        # デフォルトポリシーの確認
        assert org["policy"]["allow_private_groups"] is True
        assert org["policy"]["allow_private_notes"] is True
        assert org["policy"]["who_can_create_groups"] == "member"
        assert org["policy"]["default_join_method"] == "invite_only"

    def test_create_organization_no_name(self, client, auth_headers):
        """名前なしで組織作成するとバリデーションエラー。"""
        res = client.post(
            "/api/organizations",
            json={},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400
        assert res.get_json()["message"] == "validation error"

    def test_create_organization_empty_name(self, client, auth_headers):
        """空の名前で組織作成するとバリデーションエラー。"""
        res = client.post(
            "/api/organizations",
            json={"name": ""},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_create_organization_too_long_name(self, client, auth_headers):
        """200文字超の名前で組織作成するとバリデーションエラー。"""
        res = client.post(
            "/api/organizations",
            json={"name": "a" * 201},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_create_organization_requires_auth(self, client):
        """認証なしでは組織作成できない。"""
        res = client.post(
            "/api/organizations",
            json={"name": "テスト組織"},
        )
        assert res.status_code == 401


###############################################
#  組織の一覧・詳細取得テスト
###############################################
class TestOrganizationRead:
    def test_list_organizations_empty(self, client, auth_headers):
        """所属組織がない場合は空リストを返す。"""
        res = client.get("/api/organizations", headers=auth_headers["headers"])
        assert res.status_code == 200
        assert res.get_json() == []

    def test_list_organizations(self, client, auth_headers):
        """作成した組織が一覧に表示される。"""
        create_org(client, auth_headers, "組織A")
        create_org(client, auth_headers, "組織B")

        res = client.get("/api/organizations", headers=auth_headers["headers"])
        data = res.get_json()
        assert res.status_code == 200
        assert len(data) == 2
        names = {org["name"] for org in data}
        assert "組織A" in names
        assert "組織B" in names

    def test_get_organization_detail(self, client, auth_headers):
        """組織の詳細情報を取得できる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        res = client.get(f"/api/organizations/{org_id}", headers=auth_headers["headers"])
        assert res.status_code == 200
        data = res.get_json()
        assert data["id"] == org_id
        assert data["name"] == "テスト組織"

    def test_get_organization_not_found(self, client, auth_headers):
        """存在しない組織は404を返す。"""
        res = client.get("/api/organizations/99999", headers=auth_headers["headers"])
        assert res.status_code == 404

    def test_get_organization_no_membership(self, client, auth_headers):
        """所属していない組織は404を返す（組織の存在を漏洩させない）。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        other_headers = register_and_get_headers(client, "other", "other@example.com")
        res = client.get(f"/api/organizations/{org_id}", headers=other_headers)
        assert res.status_code == 404


###############################################
#  組織の更新テスト
###############################################
class TestOrganizationUpdate:
    def test_update_organization_name(self, client, auth_headers):
        """ownerは組織名を変更できる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        res = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "新しい組織名"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["name"] == "新しい組織名"

    def test_update_organization_policy(self, client, auth_headers):
        """ownerは組織ポリシーを変更できる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        res = client.patch(
            f"/api/organizations/{org_id}",
            json={"policy": {"allow_private_groups": False, "who_can_create_groups": "sys_admin_only"}},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        policy = res.get_json()["policy"]
        assert policy["allow_private_groups"] is False
        assert policy["who_can_create_groups"] == "sys_admin_only"

    def test_update_organization_forbidden_for_member(self, client, auth_headers):
        """通常メンバーは組織を更新できない。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        # 通常メンバーを追加
        other_headers = register_and_get_headers(client, "member2", "member2@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            user2 = db.session.execute(
                db.select(User).filter_by(email="member2@example.com")
            ).scalar_one()
            client.post(
                f"/api/organizations/{org_id}/members",
                json={"user_id": user2.id, "role": "member"},
                headers=auth_headers["headers"],
            )

        res = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "変更しようとした名前"},
            headers=other_headers,
        )
        assert res.status_code == 403


###############################################
#  組織メンバー管理テスト
###############################################
class TestOrganizationMembers:
    def test_add_member(self, client, auth_headers):
        """ownerはメンバーを追加できる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        other_headers = register_and_get_headers(client, "newmember", "newmember@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            other_user = db.session.execute(
                db.select(User).filter_by(email="newmember@example.com")
            ).scalar_one()
            other_user_id = other_user.id

        res = client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": other_user_id, "role": "member"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["member"]["role"] == "member"

    def test_add_duplicate_member(self, client, auth_headers):
        """同じユーザーを重複追加するとエラー。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        register_and_get_headers(client, "dupuser", "dup@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            dup_user = db.session.execute(
                db.select(User).filter_by(email="dup@example.com")
            ).scalar_one()
            dup_id = dup_user.id

        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": dup_id},
            headers=auth_headers["headers"],
        )
        res = client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": dup_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_list_members(self, client, auth_headers):
        """メンバー一覧にownerが含まれる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        res = client.get(
            f"/api/organizations/{org_id}/members",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]["role"] == "owner"

    def test_update_member_role(self, client, auth_headers):
        """ownerはメンバーのロールを変更できる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        register_and_get_headers(client, "target", "target@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            target = db.session.execute(
                db.select(User).filter_by(email="target@example.com")
            ).scalar_one()
            target_id = target.id

        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": target_id, "role": "member"},
            headers=auth_headers["headers"],
        )

        res = client.patch(
            f"/api/organizations/{org_id}/members/{target_id}",
            json={"role": "user_admin"},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["member"]["role"] == "user_admin"

    def test_remove_member(self, client, auth_headers):
        """ownerはメンバーを削除できる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        register_and_get_headers(client, "todelete", "todelete@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            del_user = db.session.execute(
                db.select(User).filter_by(email="todelete@example.com")
            ).scalar_one()
            del_id = del_user.id

        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": del_id},
            headers=auth_headers["headers"],
        )

        res = client.delete(
            f"/api/organizations/{org_id}/members/{del_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 204

    def test_remove_owner_fails(self, client, auth_headers):
        """ownerを削除しようとするとエラー。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        owner_id = auth_headers["user_id"]

        res = client.delete(
            f"/api/organizations/{org_id}/members/{owner_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400


###############################################
#  組織の自己脱退テスト
###############################################
class TestOrganizationLeave:
    def _add_member(self, client, auth_headers, org_id, username, email, role="member"):
        """ヘルパー: ユーザーを登録して組織に追加し、そのユーザーの ID と認証ヘッダーを返す。"""
        other_headers = register_and_get_headers(client, username, email)
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            other_user = db.session.execute(
                db.select(User).filter_by(email=email)
            ).scalar_one()
            other_id = other_user.id

        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": other_id, "role": role},
            headers=auth_headers["headers"],
        )
        return other_id, other_headers

    def test_member_can_leave_organization(self, client, auth_headers):
        """一般メンバーは自分自身を組織から脱退させることができる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        member_id, member_headers = self._add_member(
            client, auth_headers, org_id, "leaver", "leaver@example.com"
        )

        res = client.post(
            f"/api/organizations/{org_id}/leave", headers=member_headers
        )
        assert res.status_code == 204

        list_res = client.get(
            f"/api/organizations/{org_id}/members",
            headers=auth_headers["headers"],
        )
        member_ids = [m["user_id"] for m in list_res.get_json()]
        assert member_id not in member_ids

    def test_owner_cannot_leave_organization(self, client, auth_headers):
        """ownerは事前にオーナーを移譲しない限り組織を脱退できない。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        res = client.post(
            f"/api/organizations/{org_id}/leave", headers=auth_headers["headers"]
        )
        assert res.status_code == 409

    def test_leave_organization_returns_404_for_non_member(self, client, auth_headers):
        """組織メンバーでないユーザーが脱退しようとすると 404 を返す（存在を漏洩させない）。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        outside_headers = register_and_get_headers(
            client, "outsider4", "outsider4@example.com"
        )

        res = client.post(
            f"/api/organizations/{org_id}/leave", headers=outside_headers
        )
        assert res.status_code == 404


###############################################
#  非メンバーアクセスの 404 テスト
###############################################
class TestNonMemberAccessReturns404:
    """所属していない組織の管理系ルートは 404 を返す（存在を漏洩させない）。"""

    def _setup(self, client, auth_headers):
        """組織と非メンバーユーザーを用意する。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        outside_headers = register_and_get_headers(client, "outside", "outside@example.com")
        # outside ユーザーは組織に追加しない
        return org_id, outside_headers

    def test_update_org_returns_404_for_non_member(self, client, auth_headers):
        """非メンバーが組織名を変更しようとすると 404 を返す。"""
        org_id, outside_headers = self._setup(client, auth_headers)

        res = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "乗っ取り"},
            headers=outside_headers,
        )
        assert res.status_code == 404

    def test_add_member_returns_404_for_non_member(self, client, auth_headers):
        """非メンバーがメンバーを追加しようとすると 404 を返す。"""
        org_id, outside_headers = self._setup(client, auth_headers)

        register_and_get_headers(client, "target2", "target2@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            target = db.session.execute(
                db.select(User).filter_by(email="target2@example.com")
            ).scalar_one()
            target_id = target.id

        res = client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": target_id, "role": "member"},
            headers=outside_headers,
        )
        assert res.status_code == 404

    def test_update_member_role_returns_404_for_non_member(self, client, auth_headers):
        """非メンバーがメンバーのロールを変更しようとすると 404 を返す。"""
        org_id, outside_headers = self._setup(client, auth_headers)
        owner_id = auth_headers["user_id"]

        res = client.patch(
            f"/api/organizations/{org_id}/members/{owner_id}",
            json={"role": "member"},
            headers=outside_headers,
        )
        assert res.status_code == 404

    def test_remove_member_returns_404_for_non_member(self, client, auth_headers):
        """非メンバーがメンバーを削除しようとすると 404 を返す。"""
        org_id, outside_headers = self._setup(client, auth_headers)
        owner_id = auth_headers["user_id"]

        res = client.delete(
            f"/api/organizations/{org_id}/members/{owner_id}",
            headers=outside_headers,
        )
        assert res.status_code == 404


###############################################
#  組織削除テスト
###############################################
class TestOrganizationDeletion:
    def test_delete_organization_success(self, client, auth_headers):
        """ownerはグループがない組織を削除できる。削除後は 404 を返す。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        res = client.delete(
            f"/api/organizations/{org_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 204

        # 削除後は取得できない
        res2 = client.get(
            f"/api/organizations/{org_id}",
            headers=auth_headers["headers"],
        )
        assert res2.status_code == 404

    def test_delete_organization_blocked_when_groups_exist(self, client, auth_headers):
        """グループが残っている場合は 409 を返す。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        client.post(
            f"/api/organizations/{org_id}/groups",
            json={"name": "残っているグループ", "is_private": False},
            headers=auth_headers["headers"],
        )

        res = client.delete(
            f"/api/organizations/{org_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 409
        assert "グループ" in res.get_json()["message"]

    def test_delete_organization_forbidden_for_non_owner(self, client, auth_headers):
        """owner 以外のロール（sys_admin など）は組織を削除できない。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        # sys_admin を追加
        other_headers = register_and_get_headers(client, "sysadm", "sysadm@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            other_user = db.session.execute(
                db.select(User).filter_by(email="sysadm@example.com")
            ).scalar_one()
            other_id = other_user.id

        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": other_id, "role": "sys_admin"},
            headers=auth_headers["headers"],
        )

        res = client.delete(
            f"/api/organizations/{org_id}",
            headers=other_headers,
        )
        assert res.status_code == 403

    def test_delete_organization_returns_404_for_non_member(self, client, auth_headers):
        """非メンバーが削除しようとすると 404 を返す（存在を漏洩させない）。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        outside_headers = register_and_get_headers(client, "outside2", "outside2@example.com")

        res = client.delete(
            f"/api/organizations/{org_id}",
            headers=outside_headers,
        )
        assert res.status_code == 404


###############################################
#  オーナー移譲テスト
###############################################
class TestOrganizationOwnershipTransfer:
    def _add_member(self, client, auth_headers, org_id, username, email, role="member"):
        """ヘルパー: ユーザーを登録して組織に追加し、そのユーザーの ID と認証ヘッダーを返す。"""
        other_headers = register_and_get_headers(client, username, email)
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            other_user = db.session.execute(
                db.select(User).filter_by(email=email)
            ).scalar_one()
            other_id = other_user.id

        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": other_id, "role": role},
            headers=auth_headers["headers"],
        )
        return other_id, other_headers

    def test_transfer_ownership_success(self, client, auth_headers):
        """ownerが別のメンバーにオーナーを移譲できる。移譲後、元ownerはmemberになる。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        other_id, other_headers = self._add_member(
            client, auth_headers, org_id, "newowner", "newowner@example.com"
        )

        res = client.post(
            f"/api/organizations/{org_id}/transfer-ownership",
            json={"user_id": other_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        # 移譲後、元ownerのロールが member になっていることを確認
        assert res.get_json()["organization"]["role"] == "member"

        # 新オーナーがownerロールを持つことを確認
        res2 = client.get(
            f"/api/organizations/{org_id}",
            headers=other_headers,
        )
        assert res2.get_json()["role"] == "owner"

    def test_transfer_ownership_to_self_fails(self, client, auth_headers):
        """自分自身にオーナーを移譲しようとすると 400 を返す。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        owner_id = auth_headers["user_id"]

        res = client.post(
            f"/api/organizations/{org_id}/transfer-ownership",
            json={"user_id": owner_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_transfer_ownership_to_non_member_fails(self, client, auth_headers):
        """組織外のユーザーへの移譲は 400 を返す。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]

        # 組織に追加しないユーザー
        register_and_get_headers(client, "outsider", "outsider@example.com")
        from app.extensions import db
        from app.model import User
        with client.application.app_context():
            outsider = db.session.execute(
                db.select(User).filter_by(email="outsider@example.com")
            ).scalar_one()
            outsider_id = outsider.id

        res = client.post(
            f"/api/organizations/{org_id}/transfer-ownership",
            json={"user_id": outsider_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 400

    def test_transfer_ownership_forbidden_for_non_owner(self, client, auth_headers):
        """owner 以外のロールは移譲エンドポイントを呼べない。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        other_id, other_headers = self._add_member(
            client, auth_headers, org_id, "sysadm2", "sysadm2@example.com", role="sys_admin"
        )

        res = client.post(
            f"/api/organizations/{org_id}/transfer-ownership",
            json={"user_id": other_id},
            headers=other_headers,
        )
        assert res.status_code == 403

    def test_transfer_ownership_returns_404_for_non_member(self, client, auth_headers):
        """非メンバーが移譲エンドポイントを呼ぶと 404 を返す。"""
        org_id = create_org(client, auth_headers).get_json()["organization"]["id"]
        outside_headers = register_and_get_headers(client, "outside3", "outside3@example.com")

        other_id, _ = self._add_member(
            client, auth_headers, org_id, "target3", "target3@example.com"
        )

        res = client.post(
            f"/api/organizations/{org_id}/transfer-ownership",
            json={"user_id": other_id},
            headers=outside_headers,
        )
        assert res.status_code == 404
