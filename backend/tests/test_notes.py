from app.extensions import db
from app.model import User

#############################################
# tests for note creation
#############################################


def test_note_creation(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "My Note", "content_md": "Note Content Here!"},
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "Note created successfully!"
    assert res.status_code == 201


def test_no_title_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"content_md": "Note Content Here!"},
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_no_content_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "Note Title"},
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["content_md"][0] == "Missing data for required field."
    )
    assert res.status_code == 400


def test_empty_title_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "", "content_md": "Note Content Here!"},
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."
    assert res.status_code == 400


def test_empty_content_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "Note Title", "content_md": ""},
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["content_md"][0] == "Shorter than minimum length 1."
    assert res.status_code == 400


def test_too_long_title_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "note title" * 20 + "x", "content_md": "Note Content Here!"},
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."
    assert res.status_code == 400


#############################################
# tests for note index
#############################################
def test_note_index(client, auth_headers):
    client.post(
        "/api/notes",
        json={"title": "My Note", "content_md": "Note Content Here!"},
        headers=auth_headers["headers"],
    )

    res = client.get("/api/notes", headers=auth_headers["headers"])

    assert res.get_json()[0]["user_id"] == auth_headers["user_id"]
    assert res.get_json()[0]["title"] == "My Note"
    assert res.get_json()[0]["content_md"] == "Note Content Here!"
    assert res.status_code == 200


def test_no_header_rejected_in_note_index(client):
    res = client.get("/api/notes")

    assert res.get_json()["msg"] == "Missing Authorization Header"
    assert res.status_code == 401


def test_no_token_rejected_in_note_index(client):
    res = client.get("/api/notes", headers={"Content-Type": "application/json"})

    assert res.get_json()["msg"] == "Missing Authorization Header"
    assert res.status_code == 401


def test_note_ownership_in_note_index(client, auth_headers):
    # register 2nd user
    client.post(
        "/api/auth/register",
        json={
            "username": "seconduser",
            "password": "seconduser1234",
            "confirm": "seconduser1234",
        },
    )

    # get 2nd user's token
    res_2nd_user_login = client.post(
        "/api/auth/login", json={"username": "seconduser", "password": "seconduser1234"}
    )

    token_2nd_user = res_2nd_user_login.get_json()["access_token"]

    # get 2nd uesr's id
    second_user_id = (
        db.session.execute(db.select(User).filter_by(username="testuser"))
        .scalar_one_or_none()
        .id
    )

    # create note by testuser and 2nd user
    client.post(
        "/api/notes",
        json={
            "title": "Testuser's Note",
            "content_md": "Testuser's Note Content Here!",
        },
        headers=auth_headers["headers"],
    )

    client.post(
        "/api/notes",
        json={
            "title": "2nd User's Note",
            "content_md": "2nd User's Note Content Here!",
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token_2nd_user}",
        },
    )

    # get note index as testuser
    res = client.get("/api/notes", headers=auth_headers["headers"])

    assert res.status_code == 200

    notes = res.get_json()
    for note in notes:
        assert note["user_id"] == auth_headers["user_id"]
        assert note["title"] == "Testuser's Note"
        assert note["content_md"] == "Testuser's Note Content Here!"
