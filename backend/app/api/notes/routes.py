from flask import jsonify, request
from sqlalchemy.orm import selectinload
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, current_user

from app.extensions import db
from app.model import Note, Tag
from app.schema import NoteCreateSchema, NoteResponseSchema

from . import notes_bp


@notes_bp.route("", methods=["GET"])
@jwt_required()
def notes_index():
    query_word = request.args.get("q")

    query = (
        db.select(Note)
        .filter_by(user_id=current_user.id)
        .options(selectinload(Note.tags))
    )

    if query_word:
        query = query.filter(Note.title.ilike(f"%{query_word}%"))

    notes = db.session.execute(query.order_by(Note.id)).scalars()

    res_schema = NoteResponseSchema(many=True)
    result = res_schema.dump(notes)

    return result


@notes_bp.route("", methods=["POST"])
@jwt_required()
def create_note():
    # 入力のバリデーション
    create_schema = NoteCreateSchema()
    try:
        data = create_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    # ノートモデル作成
    note = Note(
        user_id=current_user.id, title=data["title"], content_md=data["content_md"]
    )

    for tagname in data["tags"]:
        stripped_tagname = (tagname or "").strip()

        if not stripped_tagname:
            continue

        # 同名のタグの存在を確認
        tag = db.session.execute(
            db.select(Tag).filter_by(user_id=current_user.id, tagname=stripped_tagname)
        ).scalar_one_or_none()

        # なければ新しく作成
        if not tag:
            tag = Tag(user_id=current_user.id, tagname=stripped_tagname)

        note.tags.append(tag)

    # 保存
    db.session.add(note)
    db.session.commit()

    res_schema = NoteResponseSchema()
    result = res_schema.dump(note)

    return (
        jsonify(
            {
                "message": "Note created successfully!",
                "note": result,
            }
        ),
        201,
    )


@notes_bp.route("/<int:note_id>", methods=["GET"])
@jwt_required()
def get_note(note_id):
    note = db.one_or_404(
        db.select(Note)
        .filter_by(id=note_id, user_id=current_user.id)
        .options(selectinload(Note.tags))
    )

    res_schema = NoteResponseSchema()
    result = res_schema.dump(note)

    return result


@notes_bp.route("/<int:note_id>", methods=["PATCH"])
@jwt_required()
def edit_note(note_id):
    # 入力のバリデーション
    create_schema = NoteCreateSchema()
    try:
        data = create_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    note = db.one_or_404(db.select(Note).filter_by(id=note_id, user_id=current_user.id))

    if note is None:
        return jsonify({"message": "Note not found"}), 404

    if "title" in data:
        note.title = data["title"]

    if "content_md" in data:
        note.content_md = data["content_md"]

    # tags 更新
    if "tags" in data:
        new_tag_names = data["tags"]

        new_tags = []

        for new_tag_name in new_tag_names:
            # 同名タグを探す
            tag = db.session.execute(
                db.select(Tag).filter_by(user_id=current_user.id, tagname=new_tag_name)
            ).scalar_one_or_none()

            # 見つからなければ新たに作成
            if tag is None:
                tag = Tag(
                    user_id=current_user.id,
                    tagname=new_tag_name,
                )
                db.session.add(tag)

            new_tags.append(tag)

        # 新しいタグをノートに適用
        note.tags = new_tags

    db.session.commit()

    res_schema = NoteResponseSchema()
    result = res_schema.dump(note)

    return jsonify(
        {
            "message": "Note updated successfully!",
            "note": result,
        }
    )


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    note = db.one_or_404(db.select(Note).filter_by(id=note_id, user_id=current_user.id))

    db.session.delete(note)
    db.session.commit()

    res_schema = NoteResponseSchema()
    result = res_schema.dump(note)

    return (
        jsonify(
            {
                "message": "Note deleted successfully!",
                "note": result,
            }
        ),
        204,
    )
