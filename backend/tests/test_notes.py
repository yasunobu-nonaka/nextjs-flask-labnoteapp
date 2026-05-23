from app.extensions import db
from app.model import User
from conftest import register_user, login_and_get_token


def create_note(
    client,
    auth_headers,
    title: str | None = None,
    content_md: str | None = None,
    tags: list | None = None,
):
    if tags is None:
        tags = []

    res = client.post(
        "/api/notes",
        json={
            "title": title,
            "content_md": content_md,
            "tags": tags,
        },
        headers=auth_headers["headers"],
    )
    return res


#############################################
# tests for note creation
#############################################
def test_note_creation(client, auth_headers):
    res = create_note(
        client,
        auth_headers,
        "My Note",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )

    data = res.get_json()
    assert data["message"] == "Note created successfully!"
    assert data["note"]["title"] == "My Note"
    assert data["note"]["content_md"] == "Note Content Here!"
    assert data["note"]["tags"] == ["tag 1", "tag 2", "tag 3"]
    assert res.status_code == 201


def test_note_creation_without_tag(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={
            "title": "My Note",
            "content_md": "Note Content Here!",
        },
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "Note created successfully!"
    assert res.status_code == 201


def test_no_title_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={
            "content_md": "Note Content Here!",
            "tags": ["tag 1", "tag 2", "tag 3"],
        },
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_no_content_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={
            "title": "Note Title",
            "tags": ["tag 1", "tag 2", "tag 3"],
        },
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert (
        res.get_json()["errors"]["content_md"][0] == "Missing data for required field."
    )
    assert res.status_code == 400


def test_empty_title_note_creation_failed(client, auth_headers):
    res = create_note(
        client, auth_headers, "", "Note Content Here!", ["tag 1", "tag 2", "tag 3"]
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."
    assert res.status_code == 400


def test_empty_content_note_creation_failed(client, auth_headers):
    res = create_note(client, auth_headers, "My Note", "", ["tag 1", "tag 2", "tag 3"])

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["content_md"][0] == "Shorter than minimum length 1."
    assert res.status_code == 400


def test_too_long_title_note_creation_failed(client, auth_headers):
    res = create_note(
        client,
        auth_headers,
        "note title" * 20 + "x",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."
    assert res.status_code == 400


def test_null_tag_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={
            "title": "My Note",
            "content_md": "Note Content Here!",
            "tags": None,
        },
        headers=auth_headers["headers"],
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["tags"][0] == "Field may not be null."
    assert res.status_code == 400


#############################################
# tests for note index
#############################################
def test_note_index(client, auth_headers):
    create_note(
        client,
        auth_headers,
        "My Note 1",
        "Note Content 1",
        ["tag 1-1", "tag 1-2", "tag 1-3"],
    )

    create_note(
        client,
        auth_headers,
        "My Note 2",
        "Note Content 2",
        ["tag 2-1", "tag 2-2", "tag 2-3"],
    )

    res = client.get("/api/notes", headers=auth_headers["headers"])
    data = res.get_json()
    assert res.status_code == 200
    assert len(data) == 2

    assert data[0]["user_id"] == auth_headers["user_id"]
    assert data[0]["title"] == "My Note 1"
    assert data[0]["content_md"] == "Note Content 1"
    assert data[0]["tags"] == ["tag 1-1", "tag 1-2", "tag 1-3"]

    assert data[1]["user_id"] == auth_headers["user_id"]
    assert data[1]["title"] == "My Note 2"
    assert data[1]["content_md"] == "Note Content 2"
    assert data[1]["tags"] == ["tag 2-1", "tag 2-2", "tag 2-3"]


def test_no_header_rejected_in_note_index(client):
    res = client.get("/api/notes")

    assert res.get_json()["msg"] == "Missing Authorization Header"
    assert res.status_code == 401


def test_no_token_rejected_in_note_index(client):
    res = client.get("/api/notes", headers={"Content-Type": "application/json"})

    assert res.get_json()["msg"] == "Missing Authorization Header"
    assert res.status_code == 401


def test_note_ownership_in_note_index(client, auth_headers):
    # register 2nd user and get token
    register_user(client, "seconduser", "seconduser1234")
    token_2nd_user = login_and_get_token(client, "seconduser", "seconduser1234")

    # get 2nd uesr's id
    second_user_id = (
        db.session.execute(db.select(User).filter_by(username="seconduser"))
        .scalar_one_or_none()
        .id
    )

    # create note by testuser and 2nd user
    create_note(
        client,
        auth_headers,
        "Testuser's Note",
        "Testuser's Note Content Here!",
        ["test tag 1", "test tag 2", "test tag 3"],
    )

    header_2nduser = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token_2nd_user}",
    }
    client.post(
        "/api/notes",
        json={
            "title": "2nd User's Note",
            "content_md": "2nd User's Note Content Here!",
            "tags": ["test tag 1", "test tag 2", "test tag 3"],
        },
        headers=header_2nduser,
    )

    # get note index as testuser
    res_testuser = client.get("/api/notes", headers=auth_headers["headers"])

    assert res_testuser.status_code == 200

    notes = res_testuser.get_json()
    assert len(notes) != 0
    for note in notes:
        assert note["user_id"] == auth_headers["user_id"]
        assert note["title"] == "Testuser's Note"
        assert note["content_md"] == "Testuser's Note Content Here!"

    # get note index as 2nd user
    res_2nduser = client.get("/api/notes", headers=header_2nduser)

    assert res_2nduser.status_code == 200

    notes = res_2nduser.get_json()
    assert len(notes) != 0
    for note in notes:
        assert note["user_id"] == second_user_id
        assert note["title"] == "2nd User's Note"
        assert note["content_md"] == "2nd User's Note Content Here!"


#############################################
# tests for note detail
#############################################
def test_note_detail(client, auth_headers):
    # ノートを作成
    res_note_creation = create_note(
        client,
        auth_headers,
        "My Note",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # ノートの詳細を取得
    res_note_detail = client.get(
        f"/api/notes/{note_id}",
        headers=auth_headers["headers"],
    )

    data = res_note_detail.get_json()

    # ノートのユーザーIDを確認
    assert data["user_id"] == auth_headers["user_id"]

    assert data["title"] == "My Note"
    assert data["content_md"] == "Note Content Here!"
    assert data["tags"] == ["tag 1", "tag 2", "tag 3"]
    assert res_note_detail.status_code == 200


def test_no_header_note_detail_failed(client, auth_headers):
    # ノートを作成
    res_note_creation = create_note(
        client,
        auth_headers,
        "My Note",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # ノートの詳細を取得
    res_note_detail = client.get(
        f"/api/notes/{note_id}",
        headers={"Content-Type": "application/json"},
    )

    assert res_note_detail.get_json()["msg"] == "Missing Authorization Header"
    assert res_note_detail.status_code == 401


def test_others_note_cannot_see(client, auth_headers):
    # register 2nd user and get token
    register_user(client, "seconduser", "seconduser1234")
    token_2nd_user = login_and_get_token(client, "seconduser", "seconduser1234")

    # create note by 2nd user
    res_note_creation = client.post(
        "/api/notes",
        json={
            "title": "2nd User's Note",
            "content_md": "2nd User's Note Content Here!",
            "tags": ["tag 1", "tag 2", "tag 3"],
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token_2nd_user}",
        },
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # try to get note as testuser
    res = client.get(f"api/notes/{note_id}", headers=auth_headers["headers"])

    assert "404 Not Found" in res.text


#############################################
# tests for note edit
#############################################
def test_note_edit(client, auth_headers):
    # ノートを作成
    res_note_creation = create_note(
        client,
        auth_headers,
        "My Note",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # ノートを編集
    res_note_edit = client.patch(
        f"/api/notes/{note_id}",
        json={
            "title": "Updated Title",
            "content_md": "updated note content",
            "tags": ["updated 1", "updated 2", "updated 3", "added 1"],
        },
        headers=auth_headers["headers"],
    )

    assert res_note_edit.get_json()["message"] == "Note updated successfully!"
    assert res_note_edit.get_json()["note"]["title"] == "Updated Title"
    assert res_note_edit.get_json()["note"]["content_md"] == "updated note content"
    assert res_note_edit.get_json()["note"]["tags"] == [
        "updated 1",
        "updated 2",
        "updated 3",
        "added 1",
    ]
    assert res_note_edit.status_code == 200


def test_no_token_note_edit_failed(client, auth_headers):
    # ノートを作成
    res_note_creation = create_note(
        client,
        auth_headers,
        "My Note",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # ノートを編集
    res = client.patch(
        f"/api/notes/{note_id}",
        json={"title": "Updated Title", "content_md": "updated note content"},
        headers={
            "Content-Type": "application/json",
        },
    )

    assert res.get_json()["msg"] == "Missing Authorization Header"
    assert res.status_code == 401


def test_others_note_cannot_edit(client, auth_headers):
    # register 2nd user and get token
    register_user(client, "seconduser", "seconduser1234")
    token_2nd_user = login_and_get_token(client, "seconduser", "seconduser1234")

    # create note by 2nd user
    res_note_creation = client.post(
        "/api/notes",
        json={
            "title": "2nd User's Note",
            "content_md": "2nd User's Note Content Here!",
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token_2nd_user}",
            "tags": ["tag 1", "tag 2", "tag 3"],
        },
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # try to edit note as testuser
    res_note_edit = client.patch(
        f"/api/notes/{note_id}",
        json={
            "title": "Updated 2nd User's Note",
            "content_md": "Updated 2nd User's Note Content Here!",
        },
        headers=auth_headers["headers"],
    )

    assert "404 Not Found" in res_note_edit.text
    assert res_note_edit.status_code == 404


#############################################
# tests for delete note
#############################################
def test_delete_note(client, auth_headers):
    # ノートを作成
    res_note_creation = create_note(
        client,
        auth_headers,
        "My Note",
        "Note Content Here!",
        ["tag 1", "tag 2", "tag 3"],
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # ノートを削除
    res_delete_note = client.delete(
        f"/api/notes/{note_id}",
        headers=auth_headers["headers"],
    )

    assert res_delete_note.status_code == 204
    assert res_delete_note.data == b""

    # 削除されたことを確認
    res_get_note = client.get(f"/api/notes/{note_id}", headers=auth_headers["headers"])

    assert "404 Not Found" in res_get_note.text
    assert res_get_note.status_code == 404


def test_others_note_cannot_delete(client, auth_headers):
    # register 2nd user and get token
    register_user(client, "seconduser", "seconduser1234")
    token_2nd_user = login_and_get_token(client, "seconduser", "seconduser1234")

    # create note by 2nd user
    res_note_creation = client.post(
        "/api/notes",
        json={
            "title": "2nd User's Note",
            "content_md": "2nd User's Note Content Here!",
            "tags": ["tag 1", "tag 2", "tag 3"],
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token_2nd_user}",
        },
    )
    note_id = res_note_creation.get_json()["note"]["id"]

    # try to edit note as testuser
    res_note_delete = client.delete(
        f"/api/notes/{note_id}",
        headers=auth_headers["headers"],
    )

    assert "404 Not Found" in res_note_delete.text
    assert res_note_delete.status_code == 404
