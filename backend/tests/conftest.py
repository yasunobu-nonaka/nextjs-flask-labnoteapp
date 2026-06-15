from dotenv import load_dotenv

load_dotenv(".env.development")

import pytest
from sqlalchemy import or_
from app import create_app
from app.extensions import db
from app.model import User
from app.model.seed_rbac import seed_rbac


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
        seed_rbac()  # RBAC初期データ（ロール・権限）を投入する
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture
def db_session(app):
    """データベースセッションのフィクスチャ"""
    with app.app_context():
        yield db.session
        db.session.rollback()


@pytest.fixture
def test_user(db_session):
    """テストユーザーを作成するフィクスチャ"""
    user = User(username="testuser", email="testuser@example.com")
    user.set_password("testuser1234")
    user.verified = False
    db_session.add(user)
    db_session.commit()
    return user


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
