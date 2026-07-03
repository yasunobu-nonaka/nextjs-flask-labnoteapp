from unittest.mock import patch

from conftest import register_user, login_user
from app.services.mail_service import (
    generate_email_verification_token,
    generate_reset_password_token,
    verify_email_verification_token,
    verify_reset_password_token,
    generate_email_change_token,
    hash_token,
)
from app.api.auth.auth_service import get_user_by_email
from app.extensions import db
from app.model import (
    User,
    Organization,
    OrganizationMember,
    Group,
    GroupMember,
    Note,
    Folder,
    RoleGlobal,
    RoleLocal,
)

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

    def test_resend_verification_success(self, client, test_user):
        """未認証ユーザーへの再送信が成功する。"""
        # test_user はデフォルトで verified=False
        response = client.post(
            "/api/auth/resend-verification", json={"email": test_user.email}
        )

        assert response.status_code == 200
        assert "再送信しました" in response.get_json()["message"]

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

        assert res.status_code == 200
        assert "access_token" in res.get_json()
        assert "refresh_token" in res.get_json()

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

    def test_wrong_password_login_failed(self, client):
        register_user(client)

        res = client.post(
            "/api/auth/login",
            json={"identifier": "testuser", "password": "wrongpassword1234"},
        )

        assert "access_token" not in res.get_json()
        assert res.status_code == 401

    def test_nonexistent_user_login_failed(self, client):
        res = client.post(
            "/api/auth/login",
            json={"identifier": "nobody", "password": "testuser1234"},
        )

        assert "access_token" not in res.get_json()
        assert res.status_code == 401


#############################################
# tests for token refresh
#############################################


class TestTokenRefresh:
    def test_refresh_returns_new_access_token(self, client):
        """リフレッシュトークンで新しいアクセストークンを取得できる。"""
        register_user(client)
        login_res = login_user(client)
        refresh_token = login_res.get_json()["refresh_token"]

        res = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )

        assert res.status_code == 200
        assert "access_token" in res.get_json()

    def test_refresh_new_token_works_for_protected_routes(self, client):
        """リフレッシュで取得した新しいアクセストークンで保護ルートにアクセスできる。"""
        register_user(client)
        login_res = login_user(client)
        refresh_token = login_res.get_json()["refresh_token"]

        # リフレッシュして新しいアクセストークンを取得
        refresh_res = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        new_access_token = refresh_res.get_json()["access_token"]

        # 新しいアクセストークンで保護されたルートにアクセスできることを確認
        res = client.get(
            "/api/organizations",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert res.status_code == 200

    def test_refresh_with_access_token_fails(self, client):
        """アクセストークンをリフレッシュエンドポイントに使うと失敗する。"""
        register_user(client)
        login_res = login_user(client)
        access_token = login_res.get_json()["access_token"]

        # リフレッシュエンドポイントにアクセストークンを渡す → 422
        res = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert res.status_code == 422

    def test_refresh_without_token_fails(self, client):
        """トークンなしでリフレッシュエンドポイントを叩くと401になる。"""
        res = client.post("/api/auth/refresh")
        assert res.status_code == 401


#############################################
# tests for user status
#############################################
class TestUserStatus:
    def test_get_user_status(self, client, test_user):
        res = client.get(f"/api/auth/user/status?email={test_user.email}")

        data = res.get_json()
        assert res.status_code == 200
        assert data["email"] == test_user.email
        assert data["verified"] == test_user.verified
        assert "created_at" in data

    def test_get_user_status_missing_email(self, client):
        res = client.get("/api/auth/user/status")

        assert res.status_code == 400
        assert res.get_json()["error"] == "メールアドレスが必要です"

    def test_get_user_status_nonexistent_user(self, client):
        res = client.get("/api/auth/user/status?email=nobody@example.com")

        assert res.status_code == 404
        assert "ユーザーが見つかりません" in res.get_json()["error"]


#############################################
# tests for password reset
#############################################


class TestPasswordReset:
    def test_send_reset_email(self, client, test_user):
        res = client.post(
            "/api/auth/forgot-password",
            json={"email": test_user.email},
        )

        assert res.status_code == 200
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

        # forgot-password ルートが行うハッシュ保存をテスト内で再現
        test_user.reset_token_hash = hash_token(token)
        db.session.commit()

        res = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "password": "updatedpassword1234",
                "confirm": "updatedpassword1234",
            },
        )

        assert res.status_code == 200
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


#############################################
# tests for password reset integration test
#############################################


class TestPasswordResetIntegration:
    """パスワードリセットの統合テスト"""

    def test_complete_reset_flow(self, client, test_user):
        """完全なパスワードリセットフローのテスト"""

        # Step 1: パスワードリセットをリクエスト
        # send_password_reset_email をモックし、ルートが生成したトークンを取得する
        with patch("app.api.auth.routes.send_password_reset_email") as mock_send:
            mock_send.return_value = True

            forgot_response = client.post(
                "/api/auth/forgot-password", json={"email": test_user.email}
            )
            assert forgot_response.status_code == 200
            assert mock_send.called

            # ルートが send_password_reset_email(user.email, token) を呼んでいるので
            # 第2引数（token）を取り出す
            token = mock_send.call_args.args[1]

        # Step 2: トークンの有効性を確認
        verify_response = client.get(f"/api/auth/reset-password/{token}")
        assert verify_response.status_code == 200

        # Step 3: 新しいパスワードを設定
        reset_response = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "password": "IntegrationTestPass123!",
                "confirm": "IntegrationTestPass123!",
            },
        )
        assert reset_response.status_code == 200

        # Step 4: 新しいパスワードでログインできることを確認
        login_response = client.post(
            "/api/auth/login",
            json={
                "identifier": test_user.email,
                "password": "IntegrationTestPass123!",
            },
        )
        assert login_response.status_code == 200

    def test_new_forgot_password_invalidates_old_token(self, client, test_user):
        """新しいリセットリクエストが古いトークンを無効化することを確認"""
        import time

        with patch("app.api.auth.routes.send_password_reset_email") as mock_send:
            mock_send.return_value = True

            # 1回目のリクエスト → 古いトークンを取得
            client.post("/api/auth/forgot-password", json={"email": test_user.email})
            old_token = mock_send.call_args.args[1]

            # itsdangerous は秒単位のタイムスタンプを使うため、
            # 異なるトークンを生成させるために1秒待機する
            time.sleep(1)

            # 2回目のリクエスト → 新しいトークンにハッシュが上書きされる
            client.post("/api/auth/forgot-password", json={"email": test_user.email})

        # 古いトークンでのリセットは失敗する
        res = client.post(
            "/api/auth/reset-password",
            json={
                "token": old_token,
                "password": "NewPassword1234!",
                "confirm": "NewPassword1234!",
            },
        )
        assert res.status_code == 400

    def test_reset_password_twice_with_same_token(self, client, test_user):
        """同じトークンで2回リセットしようとした場合のテスト"""
        token = generate_reset_password_token(test_user.email)

        # forgot-password ルートが行うハッシュ保存をテスト内で再現
        test_user.reset_token_hash = hash_token(token)
        db.session.commit()

        # 1回目のリセット（成功）
        response1 = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "password": "FirstPass123!",
                "confirm": "FirstPass123!",
            },
        )
        assert response1.status_code == 200

        # 2回目のリセット（同じトークン）→ ハッシュがクリア済みなので失敗
        response2 = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "password": "SecondPass123!",
                "confirm": "SecondPass123!",
            },
        )
        assert response2.status_code == 400


#############################################
# tests for GET /api/auth/me
#############################################


class TestGetMe:
    def test_get_me_returns_user_info(self, client, auth_headers):
        """認証済みユーザーの情報を返す。"""
        res = client.get("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 200
        data = res.get_json()
        assert data["username"] == "testuser"
        assert data["email"] == "testuser@example.com"
        assert "id" in data

    def test_get_me_without_token_returns_401(self, client):
        """トークンなしは 401 になる。"""
        res = client.get("/api/auth/me")

        assert res.status_code == 401

    def test_needs_onboarding_true_for_new_user(self, client, auth_headers):
        """組織に未所属のユーザーは needs_onboarding が true になる。"""
        res = client.get("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 200
        assert res.get_json()["needs_onboarding"] is True

    def test_needs_onboarding_false_after_joining_org(self, client, auth_headers):
        """組織を作成して所属すると needs_onboarding が false になる。"""
        client.post(
            "/api/organizations",
            json={"name": "テスト組織"},
            headers=auth_headers["headers"],
        )

        res = client.get("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 200
        assert res.get_json()["needs_onboarding"] is False


#############################################
# tests for PATCH /api/auth/me/username
#############################################


class TestUpdateUsername:
    def test_update_username_success(self, client, auth_headers):
        """ユーザー名を正常に変更できる。"""
        res = client.patch(
            "/api/auth/me/username",
            headers=auth_headers["headers"],
            json={"username": "newusername"},
        )

        assert res.status_code == 200
        assert res.get_json()["username"] == "newusername"

    def test_update_username_same_name_returns_200(self, client, auth_headers):
        """現在と同じユーザー名は変更なしで 200 を返す。"""
        res = client.patch(
            "/api/auth/me/username",
            headers=auth_headers["headers"],
            json={"username": "testuser"},
        )

        assert res.status_code == 200
        assert res.get_json()["username"] == "testuser"

    def test_update_username_duplicate_returns_409(self, client, auth_headers):
        """他ユーザーが使用中のユーザー名には 409 を返す。"""
        register_user(client, username="otherusr", email="other@example.com")

        res = client.patch(
            "/api/auth/me/username",
            headers=auth_headers["headers"],
            json={"username": "otherusr"},
        )

        assert res.status_code == 409

    def test_update_username_too_short_returns_400(self, client, auth_headers):
        """4文字未満のユーザー名はバリデーションエラーになる。"""
        res = client.patch(
            "/api/auth/me/username",
            headers=auth_headers["headers"],
            json={"username": "abc"},
        )

        assert res.status_code == 400
        assert "errors" in res.get_json()

    def test_update_username_without_token_returns_401(self, client):
        """トークンなしは 401 になる。"""
        res = client.patch("/api/auth/me/username", json={"username": "newname1234"})

        assert res.status_code == 401


#############################################
# tests for PATCH /api/auth/me/email
#############################################


class TestUpdateEmail:
    def test_initiate_email_change_success(self, client, auth_headers):
        """新しいメールアドレスへの確認メールを送信できる。"""
        with patch("app.api.auth.routes.send_email_change_confirmation") as mock_send:
            mock_send.return_value = True
            res = client.patch(
                "/api/auth/me/email",
                headers=auth_headers["headers"],
                json={"email": "newemail@example.com"},
            )

        assert res.status_code == 200
        assert mock_send.called
        # pending_email が保存されていることを確認
        user = db.session.get(User, auth_headers["user_id"])
        db.session.refresh(user)
        assert user.pending_email == "newemail@example.com"

    def test_initiate_email_change_same_email_returns_400(self, client, auth_headers):
        """現在と同じメールアドレスは 400 になる。"""
        res = client.patch(
            "/api/auth/me/email",
            headers=auth_headers["headers"],
            json={"email": "testuser@example.com"},
        )

        assert res.status_code == 400

    def test_initiate_email_change_duplicate_returns_409(self, client, auth_headers):
        """他ユーザーが使用中のメールアドレスは 409 になる。"""
        register_user(client, username="otherusr", email="other@example.com")

        res = client.patch(
            "/api/auth/me/email",
            headers=auth_headers["headers"],
            json={"email": "other@example.com"},
        )

        assert res.status_code == 409

    def test_initiate_email_change_without_token_returns_401(self, client):
        """トークンなしは 401 になる。"""
        res = client.patch("/api/auth/me/email", json={"email": "new@example.com"})

        assert res.status_code == 401


#############################################
# tests for GET /api/auth/verify-email-change/<token>
#############################################


class TestVerifyEmailChange:
    def test_verify_email_change_success(self, client, auth_headers):
        """有効なトークンでメールアドレスが確定される。"""
        user = db.session.get(User, auth_headers["user_id"])
        user.pending_email = "confirmed@example.com"
        db.session.commit()

        token = generate_email_change_token("confirmed@example.com")
        res = client.get(f"/api/auth/verify-email-change/{token}")

        assert res.status_code == 200
        db.session.refresh(user)
        assert user.email == "confirmed@example.com"
        assert user.pending_email is None

    def test_verify_email_change_invalid_token_returns_400(self, client):
        """無効なトークンは 400 になる。"""
        res = client.get("/api/auth/verify-email-change/invalid-token")

        assert res.status_code == 400

    def test_verify_email_change_no_pending_returns_404(self, client):
        """pending_email が存在しないトークンは 404 になる。"""
        token = generate_email_change_token("nobody@example.com")
        res = client.get(f"/api/auth/verify-email-change/{token}")

        assert res.status_code == 404

    def test_verify_email_change_already_taken_returns_409(self, client, auth_headers):
        """確認リンクを踏む前に同じアドレスが別アカウントで登録された場合は 409 になる。"""
        user = db.session.get(User, auth_headers["user_id"])
        user.pending_email = "taken@example.com"
        db.session.commit()

        # 別ユーザーが同じアドレスを登録する
        register_user(client, username="otherusr", email="taken@example.com")

        token = generate_email_change_token("taken@example.com")
        res = client.get(f"/api/auth/verify-email-change/{token}")

        assert res.status_code == 409


#############################################
# tests for POST /api/auth/me/password/verify
#############################################


class TestVerifyPassword:
    def test_verify_password_correct_returns_200(self, client, auth_headers):
        """正しい現在のパスワードで 200 を返す。"""
        res = client.post(
            "/api/auth/me/password/verify",
            headers=auth_headers["headers"],
            json={"current_password": "testuser1234"},
        )

        assert res.status_code == 200

    def test_verify_password_wrong_returns_401(self, client, auth_headers):
        """誤ったパスワードは 401 になる。"""
        res = client.post(
            "/api/auth/me/password/verify",
            headers=auth_headers["headers"],
            json={"current_password": "wrongpassword1234"},
        )

        assert res.status_code == 401

    def test_verify_password_too_short_returns_400(self, client, auth_headers):
        """12文字未満のパスワードはバリデーションエラーになる。"""
        res = client.post(
            "/api/auth/me/password/verify",
            headers=auth_headers["headers"],
            json={"current_password": "short"},
        )

        assert res.status_code == 400

    def test_verify_password_without_token_returns_401(self, client):
        """トークンなしは 401 になる。"""
        res = client.post(
            "/api/auth/me/password/verify",
            json={"current_password": "testuser1234"},
        )

        assert res.status_code == 401


#############################################
# tests for PATCH /api/auth/me/password
#############################################


class TestUpdatePassword:
    def test_update_password_success(self, client, auth_headers):
        """正しい現在のパスワードで新パスワードに変更できる。"""
        res = client.patch(
            "/api/auth/me/password",
            headers=auth_headers["headers"],
            json={
                "current_password": "testuser1234",
                "password": "newpassword1234",
                "confirm": "newpassword1234",
            },
        )

        assert res.status_code == 200

        # 新しいパスワードでログインできることを確認
        login_res = client.post(
            "/api/auth/login",
            json={"identifier": "testuser@example.com", "password": "newpassword1234"},
        )
        assert login_res.status_code == 200

    def test_update_password_wrong_current_returns_401(self, client, auth_headers):
        """誤った現在のパスワードは 401 になる。"""
        res = client.patch(
            "/api/auth/me/password",
            headers=auth_headers["headers"],
            json={
                "current_password": "wrongpassword1234",
                "password": "newpassword1234",
                "confirm": "newpassword1234",
            },
        )

        assert res.status_code == 401

    def test_update_password_mismatch_returns_400(self, client, auth_headers):
        """新パスワードと確認用が不一致は 400 になる。"""
        res = client.patch(
            "/api/auth/me/password",
            headers=auth_headers["headers"],
            json={
                "current_password": "testuser1234",
                "password": "newpassword1234",
                "confirm": "differentpassword1234",
            },
        )

        assert res.status_code == 400

    def test_update_password_too_short_returns_400(self, client, auth_headers):
        """12文字未満の新パスワードはバリデーションエラーになる。"""
        res = client.patch(
            "/api/auth/me/password",
            headers=auth_headers["headers"],
            json={
                "current_password": "testuser1234",
                "password": "short",
                "confirm": "short",
            },
        )

        assert res.status_code == 400

    def test_update_password_without_token_returns_401(self, client):
        """トークンなしは 401 になる。"""
        res = client.patch(
            "/api/auth/me/password",
            json={
                "current_password": "testuser1234",
                "password": "newpassword1234",
                "confirm": "newpassword1234",
            },
        )

        assert res.status_code == 401


#############################################
# tests for DELETE /api/auth/me
#############################################


class TestDeleteMe:
    """アカウント削除のテスト。"""

    # ---- ヘルパー: 削除テスト用の組織・グループをセットアップする ----

    def _setup_org_with_role(self, user_id, role_name):
        """指定ロールで組織メンバーシップを作成する。"""
        org = Organization(name="Test Org", created_by_user_id=user_id)
        db.session.add(org)
        db.session.flush()

        role = db.session.query(RoleGlobal).filter_by(name=role_name).first()
        db.session.add(OrganizationMember(user_id=user_id, organization_id=org.id, role_id=role.id))
        db.session.flush()
        return org

    def _setup_group_with_role(self, user_id, org_id, role_name):
        """指定ロールでグループメンバーシップを作成する。"""
        group = Group(organization_id=org_id, name="Test Group", created_by_user_id=user_id)
        db.session.add(group)
        db.session.flush()

        role = db.session.query(RoleLocal).filter_by(name=role_name).first()
        db.session.add(GroupMember(user_id=user_id, group_id=group.id, role_id=role.id))
        db.session.flush()
        return group

    # ---- テスト ----

    def test_delete_account_success(self, client, auth_headers):
        """メンバーシップもノートもないユーザーは削除できる。"""
        user_id = auth_headers["user_id"]

        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 204
        db.session.expire_all()
        assert db.session.get(User, user_id) is None

    def test_delete_account_without_token_returns_401(self, client):
        """トークンなしは 401 になる。"""
        res = client.delete("/api/auth/me")

        assert res.status_code == 401

    def test_delete_blocked_by_non_member_org_role(self, client, auth_headers):
        """通常メンバー以外の組織ロール（owner 等）を持つと 409 になる。"""
        user_id = auth_headers["user_id"]
        self._setup_org_with_role(user_id, "owner")
        db.session.commit()

        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 409
        assert "オーナー" in res.get_json()["message"]

    def test_delete_blocked_by_group_admin(self, client, auth_headers):
        """グループ管理者（admin）は 409 になる。"""
        user_id = auth_headers["user_id"]
        org = self._setup_org_with_role(user_id, "member")
        self._setup_group_with_role(user_id, org.id, "admin")
        db.session.commit()

        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 409
        assert "管理者" in res.get_json()["message"]

    def test_delete_blocked_by_private_note_ownership(self, client, auth_headers):
        """プライベートノートのオーナーは 409 になる。"""
        user_id = auth_headers["user_id"]
        org = self._setup_org_with_role(user_id, "member")
        group = self._setup_group_with_role(user_id, org.id, "editor")

        db.session.add(Note(
            group_id=group.id,
            created_by_user_id=user_id,
            title="Secret",
            content_md="secret content",
            is_private=True,
        ))
        db.session.commit()

        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 409
        assert "プライベートノート" in res.get_json()["message"]

    def test_delete_blocked_by_existing_notes(self, client, auth_headers):
        """作成したノートが残っていると 409 になる。"""
        user_id = auth_headers["user_id"]
        org = self._setup_org_with_role(user_id, "member")
        group = self._setup_group_with_role(user_id, org.id, "editor")

        db.session.add(Note(
            group_id=group.id,
            created_by_user_id=user_id,
            title="My Note",
            content_md="content",
            is_private=False,
        ))
        db.session.commit()

        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 409
        assert "ノート" in res.get_json()["message"]

    def test_delete_blocked_by_existing_folders(self, client, auth_headers):
        """作成したフォルダが残っていると 409 になる。"""
        user_id = auth_headers["user_id"]
        org = self._setup_org_with_role(user_id, "member")
        group = self._setup_group_with_role(user_id, org.id, "editor")

        db.session.add(Folder(
            group_id=group.id,
            created_by_user_id=user_id,
            name="My Folder",
        ))
        db.session.commit()

        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 409
        assert "フォルダ" in res.get_json()["message"]

    def test_delete_removes_memberships_automatically(self, client, auth_headers):
        """通常メンバー・editor ロールのメンバーシップは自動削除されてユーザーが削除される。"""
        user_id = auth_headers["user_id"]
        org = self._setup_org_with_role(user_id, "member")
        self._setup_group_with_role(user_id, org.id, "editor")
        db.session.commit()

        # ノートなし → 削除できる
        res = client.delete("/api/auth/me", headers=auth_headers["headers"])

        assert res.status_code == 204
        db.session.expire_all()
        assert db.session.get(User, user_id) is None
