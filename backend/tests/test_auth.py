from app.extensions import db
from app.model import User


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
