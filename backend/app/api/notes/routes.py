from flask import jsonify, request
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, current_user

from app.schema import NoteCreateSchema, NoteResponseSchema

# from app.api.notes.service import check_and_create_tag
from app.api.notes.tag_service import get_user_tags
from app.api.notes.note_service import (
    get_notes_service,
    get_note_or_404_service,
    create_note_service,
    update_note_service,
    delete_note_service,
)

from . import notes_bp

create_schema = NoteCreateSchema()
res_schema_note = NoteResponseSchema()
res_schema_notes = NoteResponseSchema(many=True)


@notes_bp.route("/tags", methods=["GET"])
@jwt_required()
def list_tags():
    tags = get_user_tags(current_user.id)
    return jsonify(tags)


@notes_bp.route("", methods=["GET"])
@jwt_required()
def notes_index():
    query_word = request.args.get("q")
    tag_name = request.args.get("tag")

    # ノート一覧取得
    notes = get_notes_service(current_user.id, query_word, tag_name)

    result = res_schema_notes.dump(notes)

    return result


@notes_bp.route("", methods=["POST"])
@jwt_required()
def create_note():
    # 入力のバリデーション
    try:
        data = create_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    note = create_note_service(data, current_user.id)

    result = res_schema_note.dump(note)

    return jsonify({"message": "Note created successfully!", "note": result}), 201


@notes_bp.route("/<int:note_id>", methods=["GET"])
@jwt_required()
def get_note(note_id):
    note = get_note_or_404_service(note_id, current_user.id)

    result = res_schema_note.dump(note)

    return result


@notes_bp.route("/<int:note_id>", methods=["PATCH"])
@jwt_required()
def edit_note(note_id):
    # 入力のバリデーション
    try:
        data = create_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    note = get_note_or_404_service(note_id, current_user.id)

    note = update_note_service(note, data, current_user.id)

    result = res_schema_note.dump(note)

    return jsonify(
        {
            "message": "Note updated successfully!",
            "note": result,
        }
    )


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    note = get_note_or_404_service(note_id, current_user.id)

    delete_note_service(note)

    return "Note deleted successfully!", 204
