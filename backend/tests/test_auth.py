from unittest.mock import patch

from conftest import register_user, login_user
from app.services.mail_service import (
    generate_email_verification_token,
    generate_reset_password_token,
    verify_email_verification_token,
    verify_reset_password_token,
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
        token = generate_email_verification_token(test_user.email)

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

        token = generate_email_verification_token(test_user.email)
        res = client.get(f"/api/auth/verify/{token}")

        assert res.status_code == 200
        assert "既に認証済み" in res.get_json()["message"]

    def test_verification_expired_token(self, client):
        """期限切れトークンのテスト"""
        with patch(
            "app.api.auth.routes.verify_email_verification_token"
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
        token = generate_email_verification_token("nonexistent@example.com")

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
            token = generate_email_verification_token(email)

            # トークンが文字列であることを確認
            assert isinstance(token, str)
            assert len(token) > 0

            # トークンの検証
            verified_email = verify_email_verification_token(token)
            assert verified_email == email

    def test_verify_expired_token(self, app):
        """期限切れトークンの検証テスト"""
        with app.app_context():
            email = "testuser@example.com"
            token = generate_email_verification_token(email)

            # トークンを期限切れとして検証（0秒後に期限切れ）
            verified_email = verify_email_verification_token(token, expiration=-1)
            assert verified_email is None

    def test_verify_invalid_token(self, app):
        """無効なトークンの検証テスト"""
        with app.app_context():
            verified_email = verify_email_verification_token("invalid-token-xyz")
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

    def test_forgot_password_nonexisting_email(self, client):
        """存在しないメールアドレスでのリクエストテスト"""
        res = client.post(
            "/api/auth/forgot-password", json={"email": "nonexistent@example.com"}
        )

        # セキュリティのため、成功したかのように応答する
        assert res.status_code == 200
        assert "パスワードリセット用のメールを送信しました" in res.get_json()["message"]

    def test_forgot_password_missing_email(self, client):
        """メールアドレスなしのリクエストテスト"""
        res = client.post("/api/auth/forgot-password", json={})

        assert res.status_code == 400
        assert (
            res.get_json()["errors"]["email"][0] == "メールアドレスを入力してください"
        )

    def test_reset_password(self, client, test_user):
        token = generate_reset_password_token(test_user.email)

        res = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "password": "updatedpassword1234",
                "confirm": "updatedpassword1234",
            },
        )

        assert res.status_code == 201
        assert res.get_json()["message"] == "パスワードを更新しました"

        # パスワードが実際に変更されたことを確認
        user = get_user_by_email(test_user.email)

        # 新しいパスワードで認証できることを確認
        assert user.check_password("updatedpassword1234") == True
        # 古いパスワードでは認証できないことを確認
        assert user.check_password("testuser1234") == False

    def test_reset_password_expired_token(self, client, test_user):
        """期限切れトークンでのリセットテスト"""
        token = generate_reset_password_token(test_user.email)

        # トークンを期限切れとして検証
        with patch("app.api.auth.routes.verify_reset_password_token") as mock_verify:
            mock_verify.return_value = None

            res = client.post(
                "/api/auth/reset-password",
                json={
                    "token": token,
                    "password": "updatedpassword1234",
                    "confirm": "updatedpassword1234",
                },
            )

            assert res.status_code == 400
            assert "有効期限が切れている" in res.get_json()["error"]

    def test_reset_password_invalid_token(self, client):
        """無効なトークンでのリセットテスト"""
        res = client.post(
            "/api/auth/reset-password",
            json={
                "token": "invalid-token-xyz",
                "password": "updatedpassword1234",
                "confirm": "updatedpassword1234",
            },
        )

        assert res.status_code == 400
        assert "リンクの有効期限が切れているか、無効です" in res.get_json()["error"]

    def test_reset_password_weak_password(self, client, test_user):
        """弱いパスワードでのリセットテスト"""
        token = generate_reset_password_token("test_user.email")

        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "password": "weak",
                "confirm": "weak",
            },
        )

        assert response.status_code == 400
        assert (
            response.get_json()["errors"]["password"][0]
            == "パスワードは12文字以上64字以下にしてください"
        )

    def test_reset_password_missing_fields(self, client):
        """必須フィールド欠落のテスト"""
        # トークンなし
        response1 = client.post(
            "/api/auth/reset-password",
            json={"password": "updatedpassword1234", "confirm": "updatedpassword1234"},
        )
        assert response1.status_code == 400

        # 新しいパスワードなし
        response2 = client.post(
            "/api/auth/reset-password", json={"token": "some-token"}
        )
        assert response2.status_code == 400

    def test_verify_reset_token_endpoint(self, client, test_user):
        """トークン検証エンドポイントのテスト"""
        token = generate_reset_password_token(test_user.email)

        response = client.get(f"/api/auth/reset-password/{token}")

        assert response.status_code == 200
        assert response.get_json()["message"] == "トークンは有効です"
        assert response.get_json()["email"] == test_user.email
        assert response.get_json()["token"] == token

    def test_verify_reset_token_invalid(self, client):
        """無効なトークンの検証テスト"""
        response = client.get("/api/auth/reset-password/invalid-token")

        assert response.status_code == 400
        assert (
            "リンクの有効期限が切れているか、無効です" in response.get_json()["error"]
        )

    def test_validate_reset_token_endpoint(self, client, test_user):
        """トークン有効性確認テストエンドポイントのテスト"""
        token = generate_reset_password_token(test_user.email)
        response = client.post(
            f"/api/auth/reset-password/validate-token", json={"token": token}
        )

        assert response.status_code == 200
        assert response.get_json()["valid"] == True
        assert response.get_json()["email"] == test_user.email
