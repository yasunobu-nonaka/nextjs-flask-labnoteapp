"""
グループスコープのノート API テスト。
URL: /api/organizations/<org_id>/groups/<group_id>/notes/...
"""
from conftest import register_user, login_and_get_token


# ─────────────────────────────────────────────
# テストヘルパー
# ─────────────────────────────────────────────

def setup_org_and_group(client, headers):
    """ユーザーに組織とグループを作成してIDを返す。"""
    org_id = client.post(
        "/api/organizations",
        json={"name": "テスト組織"},
        headers=headers,
    ).get_json()["organization"]["id"]

    group_id = client.post(
        f"/api/organizations/{org_id}/groups",
        json={"name": "テストグループ"},
        headers=headers,
    ).get_json()["group"]["id"]

    return org_id, group_id


def notes_url(org_id, group_id, note_id=None):
    base = f"/api/organizations/{org_id}/groups/{group_id}/notes"
    return f"{base}/{note_id}" if note_id else base


def create_note(client, headers, org_id, group_id, title, content_md="content", tags=None):
    return client.post(
        notes_url(org_id, group_id),
        json={"title": title, "content_md": content_md, "tags": tags or []},
        headers=headers,
    )


def create_folder(client, headers, org_id, group_id, name):
    return client.post(
        f"/api/organizations/{org_id}/groups/{group_id}/folders",
        json={"name": name},
        headers=headers,
    )


def create_private_note(client, headers, org_id, group_id, title, content_md="content"):
    """プライベートノートを作成するヘルパー。"""
    return client.post(
        notes_url(org_id, group_id),
        json={"title": title, "content_md": content_md, "is_private": True},
        headers=headers,
    )


def add_second_member(client, owner_headers, org_id, group_id):
    """2ユーザー目を組織とグループに editor として追加してそのユーザーのヘッダーを返す。"""
    return _add_member(client, owner_headers, org_id, group_id,
                       username="member2", email="member2@example.com", group_role="editor")


def add_second_member_as_viewer(client, owner_headers, org_id, group_id):
    """2ユーザー目を組織とグループに viewer として追加してそのユーザーのヘッダーを返す。"""
    return _add_member(client, owner_headers, org_id, group_id,
                       username="member2", email="member2@example.com", group_role="viewer")


def _add_member(client, owner_headers, org_id, group_id, *, username, email, group_role):
    """ユーザーを登録して組織・グループに指定ロールで追加する共通ヘルパー。"""
    register_user(client, username=username, email=email)
    token = login_and_get_token(client, identifier=email)

    # user_id を取得するため自分のプロフィールを /api/auth/me で取得する
    res = client.get(
        "/api/auth/me",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    user_id = res.get_json()["id"]

    # 組織メンバーに追加する
    client.post(
        f"/api/organizations/{org_id}/members",
        json={"user_id": user_id, "role": "member"},
        headers=owner_headers,
    )

    # グループメンバーに指定ロールで追加する
    client.post(
        f"/api/organizations/{org_id}/groups/{group_id}/members",
        json={"user_id": user_id, "role": group_role},
        headers=owner_headers,
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    return user_id, headers


#############################################
# tests for note creation
#############################################
class TestNoteCreation:
    def test_note_creation(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_note(
            client, auth_headers["headers"], org_id, group_id,
            "My Note", "Note Content Here!", ["tag 1", "tag 2", "tag 3"],
        )

        data = res.get_json()
        assert res.status_code == 201
        assert data["message"] == "Note created successfully!"
        assert data["note"]["title"] == "My Note"
        assert data["note"]["content_md"] == "Note Content Here!"
        assert data["note"]["tags"] == ["tag 1", "tag 2", "tag 3"]
        assert data["note"]["group_id"] == group_id
        assert data["note"]["created_by_user_id"] == auth_headers["user_id"]

    def test_note_creation_without_tag(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_note(client, auth_headers["headers"], org_id, group_id, "My Note")

        assert res.status_code == 201
        assert res.get_json()["message"] == "Note created successfully!"

    def test_note_creation_with_folder_id(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.post(
            notes_url(org_id, group_id),
            json={"title": "Folder Note", "content_md": "Note in folder", "folder_id": folder_id},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 201
        assert res.get_json()["note"]["folder_id"] == folder_id

    def test_no_title_note_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.post(
            notes_url(org_id, group_id),
            json={"content_md": "content"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["title"][0] == "Missing data for required field."

    def test_no_content_note_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.post(
            notes_url(org_id, group_id),
            json={"title": "Note Title"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["errors"]["content_md"][0] == "Missing data for required field."

    def test_empty_title_note_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_note(client, auth_headers["headers"], org_id, group_id, "", "content")

        assert res.status_code == 400
        assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."

    def test_too_long_title_note_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_note(
            client, auth_headers["headers"], org_id, group_id, "x" * 201, "content"
        )

        assert res.status_code == 400
        assert res.get_json()["errors"]["title"][0] == "Length must be between 1 and 200."

    def test_null_tag_note_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.post(
            notes_url(org_id, group_id),
            json={"title": "My Note", "content_md": "content", "tags": None},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["errors"]["tags"][0] == "Field may not be null."

    def test_no_token_note_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.post(
            notes_url(org_id, group_id),
            json={"title": "My Note", "content_md": "content"},
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401
        assert res.get_json()["msg"] == "Missing Authorization Header"

    def test_non_member_cannot_create_note(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")
        non_member_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

        res = create_note(client, non_member_headers, org_id, group_id, "Sneaky Note", "content")

        assert res.status_code == 404


#############################################
# tests for note index
#############################################
class TestNoteIndex:
    def test_note_index(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 1", "content 1")
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 2", "content 2")

        res = client.get(notes_url(org_id, group_id), headers=auth_headers["headers"])
        data = res.get_json()

        assert res.status_code == 200
        assert data["total"] == 2
        assert data["page"] == 1
        assert data["per_page"] == 10
        assert data["total_pages"] == 1
        assert len(data["notes"]) == 2

    def test_no_token_rejected_in_note_index(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.get(
            notes_url(org_id, group_id),
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401
        assert res.get_json()["msg"] == "Missing Authorization Header"

    def test_note_search_by_query(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Flask Note", "flask")
        create_note(client, auth_headers["headers"], org_id, group_id, "React Note", "react")

        res = client.get(
            notes_url(org_id, group_id) + "?q=Flask", headers=auth_headers["headers"]
        )
        data = res.get_json()

        assert res.status_code == 200
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Flask Note"

    def test_note_filter_by_tag(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Tagged", "c", ["python"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Other", "c", ["java"])

        res = client.get(
            notes_url(org_id, group_id) + "?tag=python", headers=auth_headers["headers"]
        )
        data = res.get_json()

        assert res.status_code == 200
        assert data["total"] == 1
        assert data["notes"][0]["title"] == "Tagged"

    def test_note_filter_by_folder_id(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "Folder"
        ).get_json()["id"]

        client.post(
            notes_url(org_id, group_id),
            json={"title": "In Folder", "content_md": "c", "folder_id": folder_id},
            headers=auth_headers["headers"],
        )
        create_note(client, auth_headers["headers"], org_id, group_id, "No Folder", "c")

        res = client.get(
            notes_url(org_id, group_id) + f"?folder_id={folder_id}",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json()["total"] == 1
        assert res.get_json()["notes"][0]["title"] == "In Folder"

    def test_note_filter_by_null_folder_id(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "Folder"
        ).get_json()["id"]

        client.post(
            notes_url(org_id, group_id),
            json={"title": "In Folder", "content_md": "c", "folder_id": folder_id},
            headers=auth_headers["headers"],
        )
        create_note(client, auth_headers["headers"], org_id, group_id, "No Folder", "c")

        # folder_id=null でフォルダー未所属ノートのみ取得できる
        res = client.get(
            notes_url(org_id, group_id) + "?folder_id=null",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json()["total"] == 1
        assert res.get_json()["notes"][0]["title"] == "No Folder"

    def test_note_pagination(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 1", "c")
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 2", "c")

        # per_page=10 のためページ2は空になる
        res = client.get(
            notes_url(org_id, group_id) + "?page=2", headers=auth_headers["headers"]
        )
        data = res.get_json()

        assert res.status_code == 200
        assert data["page"] == 2
        assert data["total"] == 2
        assert data["notes"] == []

    def test_non_member_cannot_list_notes(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.get(
            notes_url(org_id, group_id),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 404


#############################################
# tests for note detail
#############################################
class TestNoteDetail:
    def test_note_detail(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id,
            "My Note", "Note Content Here!", ["tag 1", "tag 2"],
        ).get_json()["note"]["id"]

        res = client.get(notes_url(org_id, group_id, note_id), headers=auth_headers["headers"])
        data = res.get_json()

        assert res.status_code == 200
        assert data["title"] == "My Note"
        assert data["content_md"] == "Note Content Here!"
        assert data["tags"] == ["tag 1", "tag 2"]
        assert data["group_id"] == group_id

    def test_no_token_note_detail_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "My Note", "content"
        ).get_json()["note"]["id"]

        res = client.get(
            notes_url(org_id, group_id, note_id),
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401

    def test_nonexistent_note_detail_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.get(notes_url(org_id, group_id, 99999), headers=auth_headers["headers"])

        assert res.status_code == 404

    def test_non_member_cannot_see_note(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "Secret Note", "content"
        ).get_json()["note"]["id"]

        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.get(
            notes_url(org_id, group_id, note_id),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 404


#############################################
# tests for note edit
#############################################
class TestNoteEdit:
    def test_note_edit(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "Old Title", "old content"
        ).get_json()["note"]["id"]

        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "Updated Title", "content_md": "updated content", "tags": ["new tag"]},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json()["message"] == "Note updated successfully!"
        assert res.get_json()["note"]["title"] == "Updated Title"
        assert res.get_json()["note"]["tags"] == ["new tag"]

    def test_no_token_note_edit_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "My Note", "content"
        ).get_json()["note"]["id"]

        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "Updated"},
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401

    def test_nonexistent_note_edit_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.patch(
            notes_url(org_id, group_id, 99999),
            json={"title": "Updated"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 404

    def test_non_member_cannot_edit_note(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "My Note", "content"
        ).get_json()["note"]["id"]

        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "Hacked"},
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 404


#############################################
# tests for note delete
#############################################
class TestNoteDelete:
    def test_delete_note(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "My Note", "content"
        ).get_json()["note"]["id"]

        res = client.delete(notes_url(org_id, group_id, note_id), headers=auth_headers["headers"])

        assert res.status_code == 204
        assert res.data == b""

        # 削除されたことを確認
        res_get = client.get(notes_url(org_id, group_id, note_id), headers=auth_headers["headers"])
        assert res_get.status_code == 404

    def test_no_token_note_delete_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "My Note", "content"
        ).get_json()["note"]["id"]

        res = client.delete(
            notes_url(org_id, group_id, note_id),
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401

    def test_nonexistent_note_delete_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.delete(notes_url(org_id, group_id, 99999), headers=auth_headers["headers"])

        assert res.status_code == 404

    def test_non_member_cannot_delete_note(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "My Note", "content"
        ).get_json()["note"]["id"]

        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.delete(
            notes_url(org_id, group_id, note_id),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 404


#############################################
# tests for tags index
#############################################
class TestTagsIndex:
    def test_tags_index(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 1", "c", ["python", "flask"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 2", "c", ["react"])

        res = client.get(
            notes_url(org_id, group_id) + "/tags", headers=auth_headers["headers"]
        )

        assert res.status_code == 200
        # タグは tagname の昇順で返される
        assert res.get_json() == ["flask", "python", "react"]

    def test_tags_index_deduplication(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        # 複数ノートで同じタグを使っても重複しない
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 1", "c", ["python"])
        create_note(client, auth_headers["headers"], org_id, group_id, "Note 2", "c", ["python"])

        res = client.get(
            notes_url(org_id, group_id) + "/tags", headers=auth_headers["headers"]
        )

        assert res.status_code == 200
        assert res.get_json() == ["python"]

    def test_no_token_rejected_in_tags_index(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.get(
            notes_url(org_id, group_id) + "/tags",
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401

    def test_non_member_cannot_list_tags(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.get(
            notes_url(org_id, group_id) + "/tags",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 404


#############################################
# tests for private notes
#############################################
class TestPrivateNotes:
    def test_create_private_note_returns_is_private_and_is_owner(self, client, auth_headers):
        """プライベートノートを作成すると is_private=True・is_owner=True が返る。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_private_note(client, auth_headers["headers"], org_id, group_id, "秘密のノート")

        data = res.get_json()
        assert res.status_code == 201
        assert data["note"]["is_private"] is True
        assert data["note"]["is_owner"] is True

    def test_private_note_not_visible_to_other_group_member(self, client, auth_headers):
        """プライベートノートは他のグループメンバーの一覧に含まれない。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_private_note(client, auth_headers["headers"], org_id, group_id, "秘密のノート")

        _, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        res = client.get(notes_url(org_id, group_id), headers=headers2)
        assert res.status_code == 200
        titles = [n["title"] for n in res.get_json()["notes"]]
        assert "秘密のノート" not in titles

    def test_private_note_detail_returns_404_for_non_member(self, client, auth_headers):
        """プライベートノートは共有されていないメンバーには 404 を返す（存在を隠す）。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "秘密のノート"
        ).get_json()["note"]["id"]

        _, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        res = client.get(notes_url(org_id, group_id, note_id), headers=headers2)
        assert res.status_code == 404

    def test_private_note_visible_after_sharing(self, client, auth_headers):
        """プライベートノートを共有すると、招待メンバーの一覧に表示される。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "共有後に見えるノート"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # オーナーが共有する
        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "viewer"},
            headers=auth_headers["headers"],
        )

        # 共有後は一覧に表示される
        res = client.get(notes_url(org_id, group_id), headers=headers2)
        titles = [n["title"] for n in res.get_json()["notes"]]
        assert "共有後に見えるノート" in titles

        # 詳細も取得できる
        res2 = client.get(notes_url(org_id, group_id, note_id), headers=headers2)
        assert res2.status_code == 200

    def test_viewer_cannot_edit_private_note(self, client, auth_headers):
        """viewer 権限のメンバーはプライベートノートを編集できない。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "編集不可ノート"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "viewer"},
            headers=auth_headers["headers"],
        )

        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "勝手に変えた"},
            headers=headers2,
        )
        assert res.status_code == 403

    def test_non_owner_cannot_delete_private_note(self, client, auth_headers):
        """editor 権限のメンバーはプライベートノートを削除できない。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "削除不可ノート"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        res = client.delete(notes_url(org_id, group_id, note_id), headers=headers2)
        assert res.status_code == 403

    def test_only_owner_can_add_members(self, client, auth_headers):
        """editor はメンバーを招待できない（オーナーのみ）。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "招待テストノート"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # オーナーが user2 を editor として招待
        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        # user2（editor）が自分以外を招待しようとしても 403
        register_user(client, username="member3", email="member3@example.com")
        token3 = login_and_get_token(client, identifier="member3@example.com")
        res3 = client.get(
            "/api/auth/me",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token3}"},
        )
        user3_id = res3.get_json()["id"]

        res = client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user3_id, "role": "viewer"},
            headers=headers2,
        )
        assert res.status_code == 403

    def test_allow_private_notes_false_rejects_creation(self, client, auth_headers):
        """グループポリシーで allow_private_notes=False のときプライベートノート作成を拒否する。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])

        # グループポリシーを allow_private_notes=False に更新する
        client.patch(
            f"/api/organizations/{org_id}/groups/{group_id}",
            json={"policy": {"allow_private_notes": False}},
            headers=auth_headers["headers"],
        )

        res = create_private_note(client, auth_headers["headers"], org_id, group_id, "作れないノート")
        assert res.status_code == 403

    def test_public_to_private_conversion_allows_subsequent_edit(self, client, auth_headers):
        """publicで作成したノートをprivateに変更後、再度編集できる（バグ修正確認）。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        # 1. public で作成
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "最初はpublic"
        ).get_json()["note"]["id"]

        # 2. is_private=True に変更して保存
        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"is_private": True},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["note"]["is_private"] is True

        # 3. 再度内容を編集して保存できることを確認する
        res2 = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "privateになったあとも編集できる"},
            headers=auth_headers["headers"],
        )
        assert res2.status_code == 200
        assert res2.get_json()["note"]["title"] == "privateになったあとも編集できる"

    def test_non_creator_cannot_convert_public_to_private(self, client, auth_headers):
        """ノートの作成者以外はpublic→private変換を行えない。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_note(
            client, auth_headers["headers"], org_id, group_id, "作成者以外は変更できない"
        ).get_json()["note"]["id"]

        _, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"is_private": True},
            headers=headers2,
        )
        assert res.status_code == 403

    def test_shared_member_can_edit_private_note(self, client, auth_headers):
        """ユーザー1がprivateノートを作成し、ユーザー2に共有後、ユーザー2が編集できる。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])

        # ユーザー1: プライベートノートを作成する
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "共有テストノート", "元の内容"
        ).get_json()["note"]["id"]

        # ユーザー2をグループに追加する
        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # ユーザー1: ユーザー2を editor として招待する
        res_share = client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )
        assert res_share.status_code == 201

        # ユーザー2: ノートを編集できることを確認する
        res_edit = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "ユーザー2が編集", "content_md": "編集後の内容"},
            headers=headers2,
        )
        assert res_edit.status_code == 200
        edited = res_edit.get_json()["note"]
        assert edited["title"] == "ユーザー2が編集"
        assert edited["content_md"] == "編集後の内容"
        # ユーザー2は is_owner=False であること
        assert edited["is_owner"] is False

    def test_group_viewer_with_note_editor_role_can_edit_private_note(self, client, auth_headers):
        """グループ viewer ロールのユーザーでも、プライベートノートの editor として招待されれば編集できる。

        これは note_routes.py の PATCH ルートがグループレベル note:edit をバイパスし、
        PrivateNoteMember のロールで編集可否を判断するための回帰テスト。
        """
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])

        # ユーザー1: プライベートノートを作成する
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "viewerユーザーへ共有", "元の内容"
        ).get_json()["note"]["id"]

        # ユーザー2をグループに viewer として追加する（note:edit グループ権限なし）
        user2_id, headers2 = add_second_member_as_viewer(
            client, auth_headers["headers"], org_id, group_id
        )

        # ユーザー1: ユーザー2を private note editor として招待する
        res_share = client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )
        assert res_share.status_code == 201

        # ユーザー2（グループ viewer）がプライベートノートを編集できる
        res_edit = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"title": "viewerユーザーが編集", "content_md": "編集後の内容"},
            headers=headers2,
        )
        assert res_edit.status_code == 200
        assert res_edit.get_json()["note"]["title"] == "viewerユーザーが編集"

    def test_editor_cannot_convert_private_to_public(self, client, auth_headers):
        """editor 権限のメンバーはプライベートノートを公開に戻せない（オーナーのみ可）。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "公開に戻せないノート"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # user2 を editor として招待する
        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        # editor が private → public 変換を試みる → 403
        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"is_private": False},
            headers=headers2,
        )
        assert res.status_code == 403

    def test_owner_can_convert_private_to_public(self, client, auth_headers):
        """オーナーはプライベートノートを公開に戻せる。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "公開に戻すノート"
        ).get_json()["note"]["id"]

        res = client.patch(
            notes_url(org_id, group_id, note_id),
            json={"is_private": False},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200
        assert res.get_json()["note"]["is_private"] is False

    def test_owner_can_transfer_ownership(self, client, auth_headers):
        """オーナーは共有メンバーにオーナーを移管できる。移管後に自分は editor になる。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "移管テストノート"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # user2 を editor として招待する
        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        # user1 が user2 にオーナーを移管する
        res = client.patch(
            notes_url(org_id, group_id, note_id) + "/transfer-owner",
            json={"new_owner_user_id": user2_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 200

        # user2 は is_owner=True になる
        res2 = client.get(notes_url(org_id, group_id, note_id), headers=headers2)
        assert res2.status_code == 200
        assert res2.get_json()["is_owner"] is True

        # user1 は is_owner=False になる（editor に降格）
        res3 = client.get(notes_url(org_id, group_id, note_id), headers=auth_headers["headers"])
        assert res3.status_code == 200
        assert res3.get_json()["is_owner"] is False

    def test_non_owner_cannot_transfer_ownership(self, client, auth_headers):
        """オーナー以外はオーナー移管を実行できない。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "移管不可テスト"
        ).get_json()["note"]["id"]

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # user2 を editor として招待する
        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": user2_id, "role": "editor"},
            headers=auth_headers["headers"],
        )

        # user2（editor）が自分宛てに移管しようとしても 403
        res = client.patch(
            notes_url(org_id, group_id, note_id) + "/transfer-owner",
            json={"new_owner_user_id": auth_headers["user_id"]},
            headers=headers2,
        )
        assert res.status_code == 403

    def test_transfer_to_non_member_returns_404(self, client, auth_headers):
        """共有されていないユーザーへの移管は 404 を返す。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        note_id = create_private_note(
            client, auth_headers["headers"], org_id, group_id, "移管先未共有テスト"
        ).get_json()["note"]["id"]

        user2_id, _ = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # user2 を共有メンバーにしないまま移管しようとする → 404
        res = client.patch(
            notes_url(org_id, group_id, note_id) + "/transfer-owner",
            json={"new_owner_user_id": user2_id},
            headers=auth_headers["headers"],
        )
        assert res.status_code == 404

    def test_remove_group_member_blocked_if_owns_private_notes(self, client, auth_headers):
        """プライベートノートのオーナーであるメンバーは 409 でグループ削除をブロックされる。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # user2 がプライベートノートを作成する
        note_title = "user2のプライベートノート"
        create_private_note(client, headers2, org_id, group_id, note_title)

        # user1（管理者）が user2 をグループから削除しようとする → 409
        res = client.delete(
            f"/api/organizations/{org_id}/groups/{group_id}/members/{user2_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 409
        data = res.get_json()
        assert "owned_notes" in data
        assert any(n["title"] == note_title for n in data["owned_notes"])

    def test_remove_group_member_succeeds_after_transfer(self, client, auth_headers):
        """オーナー移管後はグループメンバーを削除できる。"""
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])

        user2_id, headers2 = add_second_member(client, auth_headers["headers"], org_id, group_id)

        # user2 がプライベートノートを作成する
        note_id = create_private_note(
            client, headers2, org_id, group_id, "移管後に削除テスト"
        ).get_json()["note"]["id"]

        # user2 が user1 を editor として共有する
        client.post(
            notes_url(org_id, group_id, note_id) + "/members",
            json={"user_id": auth_headers["user_id"], "role": "editor"},
            headers=headers2,
        )

        # user2 が user1 にオーナーを移管する
        client.patch(
            notes_url(org_id, group_id, note_id) + "/transfer-owner",
            json={"new_owner_user_id": auth_headers["user_id"]},
            headers=headers2,
        )

        # オーナー移管後は user2 をグループから削除できる
        res = client.delete(
            f"/api/organizations/{org_id}/groups/{group_id}/members/{user2_id}",
            headers=auth_headers["headers"],
        )
        assert res.status_code == 204
