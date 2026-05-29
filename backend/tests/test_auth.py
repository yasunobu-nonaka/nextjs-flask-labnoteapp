from unittest.mock import patch

from conftest import register_user, login_user
from app.services.mail_service import (
    generate_verification_token,
    verify_verification_token,
)
from app.api.auth.auth_service import get_user_by_email
from app.extensions import db
from app.model import User

#############################################
# tests for register
#############################################


class TestUserRegistration:
    def test_register(self, client):
        res = register_user(client)

        assert (
            res.get_json()["message"]
            == "ユーザー登録が完了しました。確認メールを送信しました。"
        )
        assert res.get_json()["username"] == "testuser"
        assert res.status_code == 201

    def test_duplicate_username_registration_failed(self, client):
        register_user(client)
        res = register_user(client, email="testuser2@example.com")

        assert res.get_json()["message"] == "ユーザー名はすでに存在します"
        assert res.status_code == 409

    def test_duplicate_email_registration_failed(self, client):
        register_user(client)
        res = register_user(client, username="testuser2")

        assert res.get_json()["message"] == "メールアドレスはすでに存在します"
        assert res.status_code == 409

    def test_no_username_register_failed(self, client):
        res = client.post(
            "/api/auth/register",
            json={
                "email": "testuser@example.com",
                "password": "testuser1234",
                "confirm": "testuser1234",
            },
        )
        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["username"][0] == "ユーザー名を入力してください"
        assert res.status_code == 400

    def test_no_email_register_failed(self, client):
        res = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "password": "testuser1234",
                "confirm": "testuser1234",
            },
        )
        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["email"][0] == "メールアドレスを入力してください"
        )
        assert res.status_code == 400

    def test_no_confirm_register_failed(self, client):
        res = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "testuser@example.com",
                "password": "testuser1234",
            },
        )
        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["confirm"][0] == "パスワード確認を入力してください"
        )
        assert res.status_code == 400

    def test_too_short_username_register_failed(self, client):
        res = register_user(client, username="tes")

        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["username"][0]
            == "ユーザー名は4文字以上100字以下にしてください"
        )
        assert res.status_code == 400

    def test_too_long_username_register_failed(self, client):
        res = register_user(client, username="testuser12" * 10 + "x")

        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["username"][0]
            == "ユーザー名は4文字以上100字以下にしてください"
        )
        assert res.status_code == 400

    def test_invalid_email_register_failed(self, client):
        res = register_user(client, email="@com")

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["email"][0] == "Not a valid email address."
        assert res.status_code == 400

        res = register_user(client, email="@example.com")

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["email"][0] == "Not a valid email address."
        assert res.status_code == 400

        res = register_user(client, email="testuser@")

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["email"][0] == "Not a valid email address."
        assert res.status_code == 400

        res = register_user(client, email="testuser@example")

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["email"][0] == "Not a valid email address."
        assert res.status_code == 400

    def test_too_long_email_register_failed(self, client):
        res = register_user(
            client, email="testuser12" * 8 + "mailaddre" + "@example.com"
        )

        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["email"][0]
            == "メールアドレスは4文字以上100字以下にしてください"
        )
        assert res.status_code == 400

    def test_too_short_password_register_failed(self, client):
        res = register_user(client, password="testuser123")

        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["password"][0]
            == "パスワードは12文字以上64字以下にしてください"
        )
        assert res.status_code == 400

    def test_too_long_password_register_failed(self, client):
        res = register_user(
            client,
            password="testuser" * 8 + "1",
        )

        assert res.get_json()["message"] == "validation error"
        assert (
            res.get_json()["errors"]["password"][0]
            == "パスワードは12文字以上64字以下にしてください"
        )
        assert res.status_code == 400


#############################################
# tests for Email verification
#############################################


class TestEmailVerification:
    def test_successful_verification(self, client, test_user):
        """正常なメール認証のテスト"""
        token = generate_verification_token(test_user.email)

        res = client.get(f"/api/auth/verify/{token}")

        assert res.status_code == 200
        assert "メールアドレスが確認されました" in res.get_json()["message"]

        # ユーザーが認証済みになったことを確認
        user = get_user_by_email(test_user.email)
        assert user.verified == True

    def test_verification_already_verified(self, client, test_user):
        """既に認証済みユーザーの認証テスト"""
        # まずユーザーを認証済みに設定
        test_user.verified = True

        db.session.commit()

        token = generate_verification_token(test_user.email)
        res = client.get(f"/api/auth/verify/{token}")

        assert res.status_code == 200
        assert "既に認証済み" in res.get_json()["message"]

    def test_verification_expired_token(self, client, test_user):
        """期限切れトークンのテスト"""
        with patch(
            "app.services.mail_service.verify_verification_token"
        ) as mock_verify:
            mock_verify.return_value = None

            res = client.get("/api/auth/verify/invalid-token")

            assert res.status_code == 400
            assert "有効期限が切れている" in res.get_json()["error"]

    def test_verification_invalid_token(self, client):
        """無効なトークンのテスト"""
        res = client.get("/api/auth/verify/definitely-invalid-token")

        assert res.status_code == 400
        assert "無効です" in res.get_json()["error"]

    def test_verification_nonexistent_user(self, client):
        """存在しないユーザーの認証テスト"""
        token = generate_verification_token("nonexistent@example.com")

        res = client.get(f"/api/auth/verify/{token}")

        assert res.status_code == 404
        assert "ユーザーが見つかりません" in res.get_json()["error"]


#############################################
# tests for resend verification token
#############################################
class TestResendVerification:
    """認証メール再送信のテスト"""

    def test_resend_verification_missing_email(self, client):
        """メールアドレスなしの再送信テスト"""
        response = client.post("/api/auth/resend-verification", json={})

        assert response.status_code == 400
        assert (
            response.get_json()["errors"]["email"][0]
            == "メールアドレスを入力してください"
        )

    def test_resend_verification_nonexistent_user(self, client):
        """存在しないユーザーの再送信テスト"""
        response = client.post(
            "/api/auth/resend-verification", json={"email": "doesnotexist@example.com"}
        )

        assert response.status_code == 404
        assert "ユーザーが見つかりません" in response.get_json()["error"]

    def test_resend_verification_already_verified(self, client, test_user):
        """既に認証済みユーザーの再送信テスト"""
        test_user.verified = True

        db.session.commit()

        response = client.post(
            "/api/auth/resend-verification", json={"email": "testuser@example.com"}
        )

        assert response.status_code == 200
        assert "既に認証済み" in response.get_json()["message"]


#############################################
# tests for token generation
#############################################
class TestTokenGeneration:
    """トークン生成・検証のテスト"""

    def test_generate_and_verify_token(self, app):
        """トークン生成と検証の正常系テスト"""
        with app.app_context():
            email = "testuser@example.com"
            token = generate_verification_token(email)

            # トークンが文字列であることを確認
            assert isinstance(token, str)
            assert len(token) > 0

            # トークンの検証
            verified_email = verify_verification_token(token)
            assert verified_email == email

    def test_verify_expired_token(self, app):
        """期限切れトークンの検証テスト"""
        with app.app_context():
            email = "testuser@example.com"
            token = generate_verification_token(email)

            # トークンを期限切れとして検証（0秒後に期限切れ）
            verified_email = verify_verification_token(token, expiration=-1)
            assert verified_email is None

    def test_verify_invalid_token(self, app):
        """無効なトークンの検証テスト"""
        with app.app_context():
            verified_email = verify_verification_token("invalid-token-xyz")
            assert verified_email is None


#############################################
# tests for login
#############################################


class TestUserLogin:
    def test_login(self, client):
        register_user(client)

        res = login_user(client)

        assert "access_token" in res.get_json()
        assert res.status_code == 200

    def test_no_identifier_login_failed(self, client):
        register_user(client)

        res = client.post(
            "/api/auth/login",
            json={"password": "testuser1234"},
        )

        assert "access_token" not in res.get_json()
        assert (
            res.get_json()["errors"]["identifier"][0]
            == "ユーザー名またはメールアドレスを入力してください"
        )
        assert res.status_code == 400

    def test_no_password_login_failed(self, client):
        register_user(client)

        res = client.post(
            "/api/auth/login",
            json={
                "identifier": "testuser@example.com",
                "email": "testuser@example.com",
            },
        )

        assert "access_token" not in res.get_json()
        assert res.get_json()["errors"]["password"][0] == "パスワードを入力してください"
        assert res.status_code == 400


class TestPasswordReset:
    def test_send_reset_email(self, client, test_user):
        res = client.post(
            "/api/auth/forgot-password",
            json={"email": test_user.email},
        )

        assert res.status_code == 201
        assert (
            res.get_json()["message"] == "パスワードリセット用のメールを送信しました。"
        )
