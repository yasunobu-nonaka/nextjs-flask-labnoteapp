"""
グループスコープのフォルダー API。
URL: /api/organizations/<org_id>/groups/<group_id>/folders/...
"""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from app.schema import FolderCreateSchema, FolderRenameSchema, FolderResponseSchema
from app.api.folders.folder_service import (
    get_folders_service,
    get_folder_or_404_service,
    create_folder_service,
    rename_folder_service,
    delete_folder_service,
)
from app.api.organizations.organization_service import check_org_permission
from app.api.organizations.group_service import get_group_or_404, check_group_permission

from . import organizations_bp

create_schema = FolderCreateSchema()
rename_schema = FolderRenameSchema()
res_schema = FolderResponseSchema()
res_schema_many = FolderResponseSchema(many=True)


def _check_access(org_id: int, group_id: int, permission_code: str):
    """組織メンバーシップとグループ権限をまとめて確認するヘルパー。

    org_id とのネスト整合性（group.organization_id == org_id）も検証する。
    権限不足の場合は (response, status_code) タプルを返す。問題なければ None を返す。
    """
    if not check_org_permission(current_user.id, org_id, "org:read"):
        return jsonify({"message": "この組織へのアクセス権がありません"}), 403

    get_group_or_404(group_id, org_id)  # 存在しなければ 404

    if not check_group_permission(current_user.id, group_id, permission_code):
        return jsonify({"message": "権限がありません"}), 403

    return None


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/folders", methods=["GET"]
)
@jwt_required()
def list_folders(org_id, group_id):
    """グループ内のフォルダー一覧を返す。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    return jsonify(res_schema_many.dump(get_folders_service(group_id)))


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/folders", methods=["POST"]
)
@jwt_required()
def create_folder(org_id, group_id):
    """グループ内にフォルダーを作成する。"""
    err = _check_access(org_id, group_id, "note:create")
    if err:
        return err

    try:
        data = create_schema.load(request.get_json())
    except ValidationError as e:
        return jsonify({"message": "validation error", "errors": e.messages}), 400

    try:
        folder = create_folder_service(
            data["name"], data.get("parent_id"), group_id, current_user.id
        )
    except ValueError as e:
        return jsonify({"message": str(e)}), 404

    return jsonify(res_schema.dump(folder)), 201


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/folders/<int:folder_id>", methods=["PATCH"]
)
@jwt_required()
def rename_folder(org_id, group_id, folder_id):
    """フォルダーをリネームする。"""
    err = _check_access(org_id, group_id, "note:edit")
    if err:
        return err

    try:
        data = rename_schema.load(request.get_json())
    except ValidationError as e:
        return jsonify({"message": "validation error", "errors": e.messages}), 400

    folder = get_folder_or_404_service(folder_id, group_id)
    folder = rename_folder_service(folder, data["name"])
    return jsonify(res_schema.dump(folder))


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/folders/<int:folder_id>", methods=["DELETE"]
)
@jwt_required()
def delete_folder(org_id, group_id, folder_id):
    """フォルダーを削除する（子フォルダーと所属ノートもカスケード削除）。"""
    err = _check_access(org_id, group_id, "note:delete")
    if err:
        return err

    folder = get_folder_or_404_service(folder_id, group_id)
    delete_folder_service(folder)
    return "", 204
