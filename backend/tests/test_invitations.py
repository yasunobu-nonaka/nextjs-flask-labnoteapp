"""
招待（Invitation）APIのテスト。
招待送信・トークン取得・招待承認を検証する。
メール送信は unittest.mock でモックし実際には送信しない。
"""

from unittest.mock import patch

from conftest import register_user, login_and_get_token


# ------------------------------------------------------------------ helpers --

def register_and_get_headers(client, username: str, email: str, password: str = "password1234"):
    """ユーザーを登録してAuthヘッダーを返す。"""
    register_user(client, username=username, email=email, password=password)
    token = login_and_get_token(client, identifier=email, password=password)
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def create_org(client, headers, name: str = "テスト組織"):
    """組織を作成してIDを返す。"""
    res = client.post("/api/organizations", json={"name": name}, headers=headers)
    return res.get_json()["organization"]["id"]


def send_invitation(client, headers, org_id: int, email: str, role: str = "member"):
    """招待を送信する（メール送信はモック）。"""
    with patch("app.api.organizations.invitation_service.mail.send"):
        return client.post(
            f"/api/organizations/{org_id}/invitations",
            json={"email": email, "role": role},
            headers=headers,
        )


# --------------------------------------------------------- send invitation ---

class TestSendInvitation:
    def test_send_invitation_success(self, client, auth_headers):
        """owner が招待を送信すると 201 が返る。"""
        org_id = create_org(client, auth_headers["headers"])

        res = send_invitation(client, auth_headers["headers"], org_id, "invitee@example.com")

        assert res.status_code == 201
        data = res.get_json()
        assert data["email"] == "invitee@example.com"
        assert data["role"] == "member"
        assert data["status"] == "pending"
        assert "token" in data

    def test_send_invitation_default_role_is_member(self, client, auth_headers):
        """role を省略すると member になる。"""
        org_id = create_org(client, auth_headers["headers"])

        with patch("app.api.organizations.invitation_service.mail.send"):
            res = client.post(
                f"/api/organizations/{org_id}/invitations",
                json={"email": "invitee@example.com"},
                headers=auth_headers["headers"],
            )

        assert res.status_code == 201
        assert res.get_json()["role"] == "member"

    def test_send_invitation_invalid_email(self, client, auth_headers):
        """不正なメールアドレスは 422 を返す。"""
        org_id = create_org(client, auth_headers["headers"])

        res = send_invitation(client, auth_headers["headers"], org_id, "not-an-email")

        assert res.status_code == 422

    def test_send_invitation_invalid_role(self, client, auth_headers):
        """無効なロールは 422 を返す。"""
        org_id = create_org(client, auth_headers["headers"])

        res = send_invitation(client, auth_headers["headers"], org_id, "invitee@example.com", role="owner")

        assert res.status_code == 422

    def test_send_invitation_requires_auth(self, client, auth_headers):
        """認証なしでは 401 を返す。"""
        org_id = create_org(client, auth_headers["headers"])

        with patch("app.api.organizations.invitation_service.mail.send"):
            res = client.post(
                f"/api/organizations/{org_id}/invitations",
                json={"email": "invitee@example.com"},
            )

        assert res.status_code == 401

    def test_send_invitation_requires_permission(self, client, auth_headers):
        """member ロールのユーザーは招待を送れない（403）。"""
        org_id = create_org(client, auth_headers["headers"])

        # 別ユーザーを member として組織に追加する
        member_headers = register_and_get_headers(client, "member_user", "member@example.com")
        client.post(
            f"/api/organizations/{org_id}/members",
            json={"user_id": 2, "role": "member"},
            headers=auth_headers["headers"],
        )

        res = send_invitation(client, member_headers, org_id, "invitee@example.com")

        assert res.status_code == 403

    def test_send_invitation_duplicate_returns_existing(self, client, auth_headers):
        """同じメールへの pending 招待が既にあれば 201 で既存招待を返す。"""
        org_id = create_org(client, auth_headers["headers"])

        res1 = send_invitation(client, auth_headers["headers"], org_id, "invitee@example.com")
        res2 = send_invitation(client, auth_headers["headers"], org_id, "invitee@example.com")

        assert res1.status_code == 201
        assert res2.status_code == 201
        assert res1.get_json()["token"] == res2.get_json()["token"]


# --------------------------------------------------------- get invitation ----

class TestGetInvitation:
    def test_get_invitation_success(self, client, auth_headers):
        """有効なトークンで招待詳細が取得できる。"""
        org_id = create_org(client, auth_headers["headers"])
        token = send_invitation(
            client, auth_headers["headers"], org_id, "invitee@example.com"
        ).get_json()["token"]

        res = client.get(f"/api/invitations/{token}")

        assert res.status_code == 200
        data = res.get_json()
        assert data["email"] == "invitee@example.com"
        assert data["status"] == "pending"
        assert data["organization_id"] == org_id

    def test_get_invitation_invalid_token(self, client):
        """存在しないトークンは 404 を返す。"""
        res = client.get("/api/invitations/00000000-0000-0000-0000-000000000000")

        assert res.status_code == 404

    def test_get_invitation_no_auth_required(self, client, auth_headers):
        """認証なしでもトークンで招待詳細を取得できる。"""
        org_id = create_org(client, auth_headers["headers"])
        token = send_invitation(
            client, auth_headers["headers"], org_id, "invitee@example.com"
        ).get_json()["token"]

        res = client.get(f"/api/invitations/{token}")

        assert res.status_code == 200


# ------------------------------------------------------- accept invitation ---

class TestAcceptInvitation:
    def test_accept_invitation_success(self, client, auth_headers):
        """正しいメールのユーザーが承認すると組織メンバーになる。"""
        org_id = create_org(client, auth_headers["headers"])
        token = send_invitation(
            client, auth_headers["headers"], org_id, "invitee@example.com"
        ).get_json()["token"]

        # 招待先メールのユーザーとしてログイン
        invitee_headers = register_and_get_headers(client, "invitee", "invitee@example.com")

        res = client.post(f"/api/invitations/{token}/accept", headers=invitee_headers)

        assert res.status_code == 200
        assert res.get_json()["organization_id"] == org_id

    def test_accept_invitation_wrong_email(self, client, auth_headers):
        """招待先と異なるメールのユーザーは承認できない（403）。"""
        org_id = create_org(client, auth_headers["headers"])
        token = send_invitation(
            client, auth_headers["headers"], org_id, "invitee@example.com"
        ).get_json()["token"]

        other_headers = register_and_get_headers(client, "other_user", "other@example.com")

        res = client.post(f"/api/invitations/{token}/accept", headers=other_headers)

        assert res.status_code == 403

    def test_accept_invitation_invalid_token(self, client, auth_headers):
        """存在しないトークンは 404 を返す。"""
        invitee_headers = register_and_get_headers(client, "invitee", "invitee@example.com")

        res = client.post(
            "/api/invitations/00000000-0000-0000-0000-000000000000/accept",
            headers=invitee_headers,
        )

        assert res.status_code == 404

    def test_accept_invitation_already_accepted(self, client, auth_headers):
        """承認済みのトークンは 400 を返す。"""
        org_id = create_org(client, auth_headers["headers"])
        token = send_invitation(
            client, auth_headers["headers"], org_id, "invitee@example.com"
        ).get_json()["token"]

        invitee_headers = register_and_get_headers(client, "invitee", "invitee@example.com")
        client.post(f"/api/invitations/{token}/accept", headers=invitee_headers)

        # 2回目の承認
        res = client.post(f"/api/invitations/{token}/accept", headers=invitee_headers)

        assert res.status_code == 400

    def test_accept_invitation_requires_auth(self, client, auth_headers):
        """認証なしでは承認できない（401）。"""
        org_id = create_org(client, auth_headers["headers"])
        token = send_invitation(
            client, auth_headers["headers"], org_id, "invitee@example.com"
        ).get_json()["token"]

        res = client.post(f"/api/invitations/{token}/accept")

        assert res.status_code == 401
