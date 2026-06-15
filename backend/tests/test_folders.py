from conftest import register_user, login_and_get_token


def create_folder(client, auth_headers, name: str, parent_id: int | None = None):
    return client.post(
        "/api/folders",
        json={"name": name, "parent_id": parent_id},
        headers=auth_headers["headers"],
    )


#############################################
# tests for folder creation
#############################################
class TestFolderCreation:
    def test_folder_creation(self, client, auth_headers):
        res = create_folder(client, auth_headers, "My Folder")

        data = res.get_json()
        assert res.status_code == 201
        assert data["name"] == "My Folder"
        assert data["parent_id"] is None
        assert "id" in data

    def test_folder_creation_with_parent(self, client, auth_headers):
        # 親フォルダーを作成
        parent_res = create_folder(client, auth_headers, "Parent Folder")
        parent_id = parent_res.get_json()["id"]

        # 子フォルダーを作成
        res = create_folder(client, auth_headers, "Child Folder", parent_id)

        data = res.get_json()
        assert res.status_code == 201
        assert data["name"] == "Child Folder"
        assert data["parent_id"] == parent_id

    def test_no_name_folder_creation_failed(self, client, auth_headers):
        res = client.post(
            "/api/folders",
            json={},
            headers=auth_headers["headers"],
        )

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Missing data for required field."
        assert res.status_code == 400

    def test_empty_name_folder_creation_failed(self, client, auth_headers):
        res = create_folder(client, auth_headers, "")

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."
        assert res.status_code == 400

    def test_too_long_name_folder_creation_failed(self, client, auth_headers):
        res = create_folder(client, auth_headers, "a" * 101)

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."
        assert res.status_code == 400

    def test_nonexistent_parent_folder_creation_failed(self, client, auth_headers):
        # 存在しない parent_id を指定した場合は 404
        res = create_folder(client, auth_headers, "Child Folder", parent_id=99999)

        assert res.status_code == 404
        assert res.get_json()["message"] == "親フォルダーが見つかりません"

    def test_other_users_folder_as_parent_failed(self, client, auth_headers):
        # 他ユーザーのフォルダーを parent_id に指定した場合も 404
        register_user(
            client,
            username="seconduser",
            email="seconduser@example.com",
            password="seconduser1234",
        )
        token_2nd_user = login_and_get_token(
            client, identifier="seconduser", password="seconduser1234"
        )
        res_parent = client.post(
            "/api/folders",
            json={"name": "2nd User's Folder"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token_2nd_user}",
            },
        )
        other_folder_id = res_parent.get_json()["id"]

        # testuser が他ユーザーのフォルダーを親として子フォルダーを作ろうとする
        res = create_folder(client, auth_headers, "Child Folder", parent_id=other_folder_id)

        assert res.status_code == 404
        assert res.get_json()["message"] == "親フォルダーが見つかりません"

    def test_no_token_folder_creation_failed(self, client):
        res = client.post(
            "/api/folders",
            json={"name": "My Folder"},
            headers={"Content-Type": "application/json"},
        )

        assert res.get_json()["msg"] == "Missing Authorization Header"
        assert res.status_code == 401


#############################################
# tests for folder index
#############################################
class TestFolderIndex:
    def test_folder_index(self, client, auth_headers):
        create_folder(client, auth_headers, "Folder A")
        create_folder(client, auth_headers, "Folder B")

        res = client.get("/api/folders", headers=auth_headers["headers"])
        data = res.get_json()

        assert res.status_code == 200
        assert len(data) == 2
        # フォルダーは name の昇順で返される
        assert data[0]["name"] == "Folder A"
        assert data[1]["name"] == "Folder B"

    def test_no_header_rejected_in_folder_index(self, client):
        res = client.get("/api/folders")

        assert res.get_json()["msg"] == "Missing Authorization Header"
        assert res.status_code == 401

    def test_folder_ownership_in_folder_index(self, client, auth_headers):
        # 2nd ユーザーを登録してトークンを取得
        register_user(
            client,
            username="seconduser",
            email="seconduser@example.com",
            password="seconduser1234",
        )
        token_2nd_user = login_and_get_token(
            client, identifier="seconduser", password="seconduser1234"
        )
        header_2nduser = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token_2nd_user}",
        }

        # 各ユーザーがフォルダーを作成
        create_folder(client, auth_headers, "Testuser's Folder")
        client.post(
            "/api/folders",
            json={"name": "2nd User's Folder"},
            headers=header_2nduser,
        )

        # testuser は自分のフォルダーのみ取得できる
        res_testuser = client.get("/api/folders", headers=auth_headers["headers"])
        folders = res_testuser.get_json()
        assert res_testuser.status_code == 200
        assert len(folders) == 1
        assert folders[0]["name"] == "Testuser's Folder"

        # 2nd ユーザーは自分のフォルダーのみ取得できる
        res_2nduser = client.get("/api/folders", headers=header_2nduser)
        folders = res_2nduser.get_json()
        assert res_2nduser.status_code == 200
        assert len(folders) == 1
        assert folders[0]["name"] == "2nd User's Folder"


#############################################
# tests for folder rename
#############################################
class TestFolderRename:
    def test_rename_folder(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "Old Name")
        folder_id = res_creation.get_json()["id"]

        res = client.patch(
            f"/api/folders/{folder_id}",
            json={"name": "New Name"},
            headers=auth_headers["headers"],
        )

        data = res.get_json()
        assert res.status_code == 200
        assert data["name"] == "New Name"
        assert data["id"] == folder_id

    def test_no_token_rename_failed(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "My Folder")
        folder_id = res_creation.get_json()["id"]

        res = client.patch(
            f"/api/folders/{folder_id}",
            json={"name": "New Name"},
            headers={"Content-Type": "application/json"},
        )

        assert res.get_json()["msg"] == "Missing Authorization Header"
        assert res.status_code == 401

    def test_no_name_rename_failed(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "My Folder")
        folder_id = res_creation.get_json()["id"]

        res = client.patch(
            f"/api/folders/{folder_id}",
            json={},
            headers=auth_headers["headers"],
        )

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Missing data for required field."
        assert res.status_code == 400

    def test_empty_name_rename_failed(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "My Folder")
        folder_id = res_creation.get_json()["id"]

        res = client.patch(
            f"/api/folders/{folder_id}",
            json={"name": ""},
            headers=auth_headers["headers"],
        )

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."
        assert res.status_code == 400

    def test_too_long_name_rename_failed(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "My Folder")
        folder_id = res_creation.get_json()["id"]

        res = client.patch(
            f"/api/folders/{folder_id}",
            json={"name": "a" * 101},
            headers=auth_headers["headers"],
        )

        assert res.get_json()["message"] == "validation error"
        assert res.get_json()["errors"]["name"][0] == "Length must be between 1 and 100."
        assert res.status_code == 400

    def test_nonexistent_folder_rename_failed(self, client, auth_headers):
        res = client.patch(
            "/api/folders/99999",
            json={"name": "New Name"},
            headers=auth_headers["headers"],
        )

        assert res.status_code == 404

    def test_others_folder_cannot_rename(self, client, auth_headers):
        # 2nd ユーザーを登録してフォルダーを作成
        register_user(
            client,
            username="seconduser",
            email="seconduser@example.com",
            password="seconduser1234",
        )
        token_2nd_user = login_and_get_token(
            client, identifier="seconduser", password="seconduser1234"
        )

        res_creation = client.post(
            "/api/folders",
            json={"name": "2nd User's Folder"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token_2nd_user}",
            },
        )
        folder_id = res_creation.get_json()["id"]

        # testuser が他ユーザーのフォルダーをリネームしようとする
        res = client.patch(
            f"/api/folders/{folder_id}",
            json={"name": "Renamed"},
            headers=auth_headers["headers"],
        )

        assert "404 Not Found" in res.text
        assert res.status_code == 404


#############################################
# tests for folder delete
#############################################
class TestFolderDelete:
    def test_delete_folder(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "My Folder")
        folder_id = res_creation.get_json()["id"]

        res_delete = client.delete(
            f"/api/folders/{folder_id}",
            headers=auth_headers["headers"],
        )

        assert res_delete.status_code == 204
        assert res_delete.data == b""

        # フォルダー一覧から消えたことを確認
        res_index = client.get("/api/folders", headers=auth_headers["headers"])
        folder_ids = [f["id"] for f in res_index.get_json()]
        assert folder_id not in folder_ids

    def test_delete_folder_cascades_to_children(self, client, auth_headers):
        # 親フォルダーと子フォルダーを作成
        parent_res = create_folder(client, auth_headers, "Parent Folder")
        parent_id = parent_res.get_json()["id"]

        child_res = create_folder(client, auth_headers, "Child Folder", parent_id)
        child_id = child_res.get_json()["id"]

        # 親フォルダーを削除すると子フォルダーも削除される
        client.delete(
            f"/api/folders/{parent_id}",
            headers=auth_headers["headers"],
        )

        res_index = client.get("/api/folders", headers=auth_headers["headers"])
        folder_ids = [f["id"] for f in res_index.get_json()]
        assert parent_id not in folder_ids
        assert child_id not in folder_ids

    def test_no_token_delete_failed(self, client, auth_headers):
        res_creation = create_folder(client, auth_headers, "My Folder")
        folder_id = res_creation.get_json()["id"]

        res = client.delete(
            f"/api/folders/{folder_id}",
            headers={"Content-Type": "application/json"},
        )

        assert res.get_json()["msg"] == "Missing Authorization Header"
        assert res.status_code == 401

    def test_nonexistent_folder_delete_failed(self, client, auth_headers):
        res = client.delete(
            "/api/folders/99999",
            headers=auth_headers["headers"],
        )

        assert res.status_code == 404

    def test_others_folder_cannot_delete(self, client, auth_headers):
        # 2nd ユーザーを登録してフォルダーを作成
        register_user(
            client,
            username="seconduser",
            email="seconduser@example.com",
            password="seconduser1234",
        )
        token_2nd_user = login_and_get_token(
            client, identifier="seconduser", password="seconduser1234"
        )

        res_creation = client.post(
            "/api/folders",
            json={"name": "2nd User's Folder"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token_2nd_user}",
            },
        )
        folder_id = res_creation.get_json()["id"]

        # testuser が他ユーザーのフォルダーを削除しようとする
        res = client.delete(
            f"/api/folders/{folder_id}",
            headers=auth_headers["headers"],
        )

        assert "404 Not Found" in res.text
        assert res.status_code == 404
