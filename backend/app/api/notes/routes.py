from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user, get_jwt_identity

from app.extensions import db
from app.model import Note
from app.schema import NoteCreateSchema, NoteResponseSchema

from . import notes_bp


@notes_bp.route("/", methods=["GET"])
@jwt_required()
def notes_index():
    query_word = request.args.get("q")

    query = db.select(Note).filter_by(user_id=current_user.id)

    if query_word:
        query = query.filter(Note.title.ilike(f"%{query_word}%"))

    notes = db.session.execute(query.order_by(Note.id)).scalars()

    res_schema = NoteResponseSchema(many=True)
    result = res_schema.dump(notes)

    return result


@notes_bp.route("/", methods=["POST"])
@jwt_required()
def create_note():
    create_schema = NoteCreateSchema()

    data = create_schema.load(request.get_json())
    note = Note(
        user_id=current_user.id, title=data["title"], content_md=data["content_md"]
    )

    db.session.add(note)
    db.session.commit()

    res_schema = NoteResponseSchema()
    result = res_schema.dump(note)

    return jsonify(
        {
            "message": "Note created successfully!",
            "note": result,
        }
    )


@notes_bp.route("/<int:note_id>", methods=["GET"])
@jwt_required()
def get_note(note_id):
    note = db.one_or_404(db.select(Note).filter_by(id=note_id, user_id=current_user.id))

    res_schema = NoteResponseSchema()
    result = res_schema.dump(note)

    return result


@notes_bp.route("/<int:note_id>", methods=["PATCH"])
@jwt_required()
def edit_note(note_id):
    note = db.one_or_404(db.select(Note).filter_by(id=note_id, user_id=current_user.id))

    create_schema = NoteCreateSchema()
    data = create_schema.load(request.get_json(), partial=True)

    for key, value in data.items():
        setattr(note, key, value)

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

    return jsonify(
        {
            "message": "Note deleted successfully!",
            "note": result,
        }
    )
