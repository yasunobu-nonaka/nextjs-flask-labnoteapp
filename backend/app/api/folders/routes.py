from flask import jsonify, request
from flask_jwt_extended import current_user, jwt_required
from marshmallow import ValidationError

from app.schema import FolderCreateSchema, FolderRenameSchema, FolderResponseSchema
from app.api.folders.folder_service import (
    get_folders_service,
    get_folder_or_404_service,
    create_folder_service,
    rename_folder_service,
    delete_folder_service,
)
from . import folders_bp

create_schema = FolderCreateSchema()
rename_schema = FolderRenameSchema()
res_schema = FolderResponseSchema()
res_schema_many = FolderResponseSchema(many=True)


@folders_bp.route("", methods=["GET"])
@jwt_required()
def list_folders():
    folders = get_folders_service(current_user.id)
    return jsonify(res_schema_many.dump(folders))


@folders_bp.route("", methods=["POST"])
@jwt_required()
def create_folder():
    try:
        data = create_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    try:
        folder = create_folder_service(data["name"], data.get("parent_id"), current_user.id)
    except ValueError as err:
        return jsonify({"message": str(err)}), 404

    return jsonify(res_schema.dump(folder)), 201


@folders_bp.route("/<int:folder_id>", methods=["PATCH"])
@jwt_required()
def rename_folder(folder_id):
    try:
        data = rename_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    folder = get_folder_or_404_service(folder_id, current_user.id)
    folder = rename_folder_service(folder, data["name"])
    return jsonify(res_schema.dump(folder))


@folders_bp.route("/<int:folder_id>", methods=["DELETE"])
@jwt_required()
def delete_folder(folder_id):
    folder = get_folder_or_404_service(folder_id, current_user.id)
    delete_folder_service(folder)
    return "", 204
