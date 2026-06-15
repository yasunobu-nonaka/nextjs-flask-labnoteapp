"""
グループスコープのフォルダー API テスト。
URL: /api/organizations/<org_id>/groups/<group_id>/folders/...
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


def folders_url(org_id, group_id, folder_id=None):
    base = f"/api/organizations/{org_id}/groups/{group_id}/folders"
    return f"{base}/{folder_id}" if folder_id else base


def create_folder(client, headers, org_id, group_id, name, parent_id=None):
    return client.post(
        folders_url(org_id, group_id),
        json={"name": name, "parent_id": parent_id},
        headers=headers,
    )


#############################################
# tests for folder creation
#############################################
class TestFolderCreation:
    def test_folder_creation(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_folder(client, auth_headers["headers"], org_id, group_id, "My Folder")

        data = res.get_json()
        assert res.status_code == 201
        assert data["name"] == "My Folder"
        assert data["parent_id"] is None
        assert data["group_id"] == group_id
        assert "id" in data

    def test_folder_creation_with_parent(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        parent_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "Parent Folder"
        ).get_json()["id"]

        res = create_folder(client, auth_headers["headers"], org_id, group_id, "Child Folder", parent_id)

        data = res.get_json()
        assert res.status_code == 201
        assert data["name"] == "Child Folder"
        assert data["parent_id"] == parent_id

    def test_no_name_folder_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.post(
            folders_url(org_id, group_id),
            json={},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Missing data for required field."

    def test_empty_name_folder_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_folder(client, auth_headers["headers"], org_id, group_id, "")

        assert res.status_code == 400
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."

    def test_too_long_name_folder_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_folder(client, auth_headers["headers"], org_id, group_id, "a" * 101)

        assert res.status_code == 400
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."

    def test_nonexistent_parent_folder_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = create_folder(client, auth_headers["headers"], org_id, group_id, "Child", 99999)

        assert res.status_code == 404
        assert res.get_json()["message"] == "親フォルダーが見つかりません"

    def test_no_token_folder_creation_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.post(
            folders_url(org_id, group_id),
            json={"name": "My Folder"},
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401
        assert res.get_json()["msg"] == "Missing Authorization Header"

    def test_non_member_cannot_create_folder(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = create_folder(
            client,
            {"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            org_id, group_id, "Sneaky Folder",
        )

        assert res.status_code == 403


#############################################
# tests for folder index
#############################################
class TestFolderIndex:
    def test_folder_index(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        create_folder(client, auth_headers["headers"], org_id, group_id, "Folder A")
        create_folder(client, auth_headers["headers"], org_id, group_id, "Folder B")

        res = client.get(folders_url(org_id, group_id), headers=auth_headers["headers"])
        data = res.get_json()

        assert res.status_code == 200
        assert len(data) == 2
        # フォルダーは name の昇順で返される
        assert data[0]["name"] == "Folder A"
        assert data[1]["name"] == "Folder B"

    def test_no_token_rejected_in_folder_index(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.get(
            folders_url(org_id, group_id),
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401
        assert res.get_json()["msg"] == "Missing Authorization Header"

    def test_non_member_cannot_list_folders(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.get(
            folders_url(org_id, group_id),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 403


#############################################
# tests for folder rename
#############################################
class TestFolderRename:
    def test_rename_folder(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "Old Name"
        ).get_json()["id"]

        res = client.patch(
            folders_url(org_id, group_id, folder_id),
            json={"name": "New Name"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 200
        assert res.get_json()["name"] == "New Name"
        assert res.get_json()["id"] == folder_id

    def test_no_token_rename_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.patch(
            folders_url(org_id, group_id, folder_id),
            json={"name": "New Name"},
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401

    def test_no_name_rename_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.patch(
            folders_url(org_id, group_id, folder_id),
            json={},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["errors"]["name"][0] == "Missing data for required field."

    def test_empty_name_rename_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.patch(
            folders_url(org_id, group_id, folder_id),
            json={"name": ""},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."

    def test_too_long_name_rename_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.patch(
            folders_url(org_id, group_id, folder_id),
            json={"name": "a" * 101},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 400
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."

    def test_nonexistent_folder_rename_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.patch(
            folders_url(org_id, group_id, 99999),
            json={"name": "New Name"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 404

    def test_non_member_cannot_rename_folder(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.patch(
            folders_url(org_id, group_id, folder_id),
            json={"name": "Hacked Name"},
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 403


#############################################
# tests for folder delete
#############################################
class TestFolderDelete:
    def test_delete_folder(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.delete(folders_url(org_id, group_id, folder_id), headers=auth_headers["headers"])

        assert res.status_code == 204
        assert res.data == b""

        # フォルダー一覧から消えたことを確認
        res_index = client.get(folders_url(org_id, group_id), headers=auth_headers["headers"])
        folder_ids = [f["id"] for f in res_index.get_json()]
        assert folder_id not in folder_ids

    def test_delete_folder_cascades_to_children(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        parent_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "Parent"
        ).get_json()["id"]
        child_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "Child", parent_id
        ).get_json()["id"]

        client.delete(folders_url(org_id, group_id, parent_id), headers=auth_headers["headers"])

        res_index = client.get(folders_url(org_id, group_id), headers=auth_headers["headers"])
        folder_ids = [f["id"] for f in res_index.get_json()]
        assert parent_id not in folder_ids
        assert child_id not in folder_ids

    def test_no_token_delete_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        res = client.delete(
            folders_url(org_id, group_id, folder_id),
            headers={"Content-Type": "application/json"},
        )

        assert res.status_code == 401

    def test_nonexistent_folder_delete_failed(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        res = client.delete(folders_url(org_id, group_id, 99999), headers=auth_headers["headers"])

        assert res.status_code == 404

    def test_non_member_cannot_delete_folder(self, client, auth_headers):
        org_id, group_id = setup_org_and_group(client, auth_headers["headers"])
        folder_id = create_folder(
            client, auth_headers["headers"], org_id, group_id, "My Folder"
        ).get_json()["id"]

        register_user(client, username="outsider", email="outsider@example.com")
        token = login_and_get_token(client, identifier="outsider@example.com")

        res = client.delete(
            folders_url(org_id, group_id, folder_id),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        )

        assert res.status_code == 403
