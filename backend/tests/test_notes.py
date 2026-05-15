def test_note_creation(client, auth_headers):
    res = client.post(
        "/api/notes",
        json={"title": "My Note", "content_md": "Note Content Here!"},
        headers=auth_headers,
    )

    assert res.get_json()["message"] == "Note created successfully!"
    assert res.status_code == 201
