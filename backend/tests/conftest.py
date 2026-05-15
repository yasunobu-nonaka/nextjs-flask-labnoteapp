from dotenv import load_dotenv

load_dotenv()

import pytest
from app import create_app
from app.extensions import db


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

    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
