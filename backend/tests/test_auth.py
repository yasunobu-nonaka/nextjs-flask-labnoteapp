from conftest import register_user, login_and_get_token

#############################################
# tests for register
#############################################


def test_register(client):
    res = register_user(client, "testuser", "testuser1234")

    assert res.get_json()["message"] == "User registration success"
    assert res.get_json()["username"] == "testuser"
    assert res.status_code == 200


def test_no_username_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )
    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["username"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_no_confirm_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser1234",
        },
    )
    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["confirm"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_too_short_username_register_failed(client):
    res = register_user(client, "tes", "testuser1234")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["username"][0]
        == "ユーザー名は4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_too_long_username_register_failed(client):
    res = register_user(client, "testuser12" * 10 + "x", "testuser1234")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["username"][0]
        == "ユーザー名は4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_too_short_password_register_failed(client):
    res = register_user(client, "testuser", "testuser123")

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["password"][0]
        == "パスワードは12文字以上64字以下にしてください"
    )
    assert res.status_code == 400


def test_too_long_password_register_failed(client):
    res = register_user(client, "testuser", "testuser" * 8 + "1")

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
    register_user(client, "testuser", "testuser1234")

    res = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "testuser1234"}
    )

    assert "access_token" in res.get_json()
    assert res.status_code == 200


def test_no_username_login_failed(client):
    register_user(client, "testuser", "testuser1234")

    res = client.post("/api/auth/login", json={"password": "testuser1234"})

    assert "access_token" not in res.get_json()
    assert res.get_json()["errors"]["username"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_no_password_login_failed(client):
    register_user(client, "testuser", "testuser1234")

    res = client.post("/api/auth/login", json={"username": "testuser"})

    assert "access_token" not in res.get_json()
    assert res.get_json()["errors"]["password"][0] == "Missing data for required field."
    assert res.status_code == 400
