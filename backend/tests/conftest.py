from dotenv import load_dotenv

load_dotenv()

import pytest
from app import create_app
from app.extensions import db
from app.model import User


def register_user(client, username="testuser", password="testuser1234"):
    res = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": password,
            "confirm": password,
        },
    )

    return res


def login_and_get_token(client, username="testuser", password="password"):
    res = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )

    return res.get_json()["access_token"]


@pytest.fixture()
def app():
    app = create_app(config_name="testing")

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testuser1234",
            "confirm": "testuser1234",
        },
    )

    res = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "testuser1234"}
    )

    token = res.get_json()["access_token"]

    user = db.session.execute(
        db.select(User).filter_by(username="testuser")
    ).scalar_one_or_none()

    return {
        "user_id": user.id,
        "headers": {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    }
