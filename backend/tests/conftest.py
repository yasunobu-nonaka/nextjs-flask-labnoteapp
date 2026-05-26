from dotenv import load_dotenv

load_dotenv()

import pytest
from sqlalchemy import or_
from app import create_app
from app.extensions import db
from app.model import User


def register_user(
    client, username="testuser", email="testuser@example.com", password="testuser1234"
):
    res = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "confirm": password,
        },
    )

    return res


def login_user(client, identifier="testuser@example.com", password="testuser1234"):
    res = client.post(
        "/api/auth/login", json={"identifier": identifier, "password": password}
    )

    return res


def login_and_get_token(
    client, identifier="testuser@example.com", password="testuser1234"
):
    res = login_user(client, identifier, password)

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
    register_user(client)

    token = login_and_get_token(client)

    user = db.session.execute(
        db.select(User).filter(
            or_(User.username == "testuser", User.email == "testuser@example.com")
        )
    ).scalar_one_or_none()

    return {
        "user_id": user.id,
        "headers": {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    }
