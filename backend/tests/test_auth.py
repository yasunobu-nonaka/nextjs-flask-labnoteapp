from conftest import register_user, login_user

#############################################
# tests for register
#############################################


def test_register(client):
    res = register_user(client)

    assert res.get_json()["message"] == "User registration success"
    assert res.get_json()["username"] == "testuser"
    assert res.status_code == 200


def test_no_username_register_failed(client):
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


def test_no_email_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )
    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["email"][0] == "メールアドレスを入力してください"
    assert res.status_code == 400


def test_no_confirm_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "testuser@example.com",
            "password": "testuser1234",
        },
    )
    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["confirm"][0] == "パスワード確認を入力してください"
    assert res.status_code == 400


def test_too_short_username_register_failed(client):
    res = register_user(client, username="tes")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["username"][0]
        == "ユーザー名は4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_too_long_username_register_failed(client):
    res = register_user(client, username="testuser12" * 10 + "x")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["username"][0]
        == "ユーザー名は4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_invalid_email_register_failed(client):
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


def test_too_long_email_register_failed(client):
    res = register_user(client, email="testuser12" * 8 + "mailaddre" + "@example.com")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["email"][0]
        == "メールアドレスは4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_too_short_password_register_failed(client):
    res = register_user(client, password="testuser123")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["password"][0]
        == "パスワードは12文字以上64字以下にしてください"
    )
    assert res.status_code == 400


def test_too_long_password_register_failed(client):
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
# tests for login
#############################################


def test_login(client):
    register_user(client)

    res = login_user(client)

    assert "access_token" in res.get_json()
    assert res.status_code == 200


def test_no_identifier_login_failed(client):
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


def test_no_password_login_failed(client):
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
