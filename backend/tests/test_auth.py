from app.extensions import db
from app.model import User

#############################################
# tests for register
#############################################


def test_register(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )
    assert res.json["message"] == "User registration success"
    assert res.json["username"] == "testuser"
    assert res.status_code == 200


def test_no_username_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )
    assert res.json["message"] == "validation error"
    assert res.json["errors"]["username"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_no_confirm_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser1234",
        },
    )
    assert res.json["message"] == "validation error"
    assert res.json["errors"]["confirm"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_too_short_username_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "tes",
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )
    assert res.json["message"] == "validation error"
    assert (
        res.json["errors"]["username"][0]
        == "ユーザー名は4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_too_long_username_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser12" * 10 + "x",
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )
    assert res.json["message"] == "validation error"
    assert (
        res.json["errors"]["username"][0]
        == "ユーザー名は4文字以上100字以下にしてください"
    )
    assert res.status_code == 400


def test_too_short_password_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser123",
            "confirm": "testuser123",
        },
    )
    assert res.json["message"] == "validation error"
    assert (
        res.json["errors"]["password"][0]
        == "パスワードは12文字以上64字以下にしてください"
    )
    assert res.status_code == 400


def test_too_long_password_register_failed(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser" * 8 + "1",
            "confirm": "testuser" * 8 + "1",
        },
    )
    assert res.json["message"] == "validation error"
    assert (
        res.json["errors"]["password"][0]
        == "パスワードは12文字以上64字以下にしてください"
    )
    assert res.status_code == 400
