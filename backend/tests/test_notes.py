#############################################
# tests for note creation
#############################################


def test_note_creation(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "My Note", "content_md": "Note Content Here!"},
        headers=auth_headers,
    )

    assert res.get_json()["message"] == "Note created successfully!"
    assert res.status_code == 201


def test_no_title_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"content_md": "Note Content Here!"},
        headers=auth_headers,
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Missing data for required field."
    assert res.status_code == 400


def test_no_content_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "Note Title"},
        headers=auth_headers,
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
        headers=auth_headers,
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."
    assert res.status_code == 400


def test_empty_content_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "Note Title", "content_md": ""},
        headers=auth_headers,
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["content_md"][0] == "Shorter than minimum length 1."
    assert res.status_code == 400


def test_too_long_title_note_creation_failed(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "note title" * 20 + "x", "content_md": "Note Content Here!"},
        headers=auth_headers,
    )

    assert res.get_json()["message"] == "validation error"
    assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."
    assert res.status_code == 400
