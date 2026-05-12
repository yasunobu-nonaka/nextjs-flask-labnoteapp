from flask import jsonify, request
from app.extensions import db
from app.model import Note
from app.schema import NoteSchema

from . import notes_bp


@notes_bp.route("/", methods=["GET"])
def notes_index():
    query_word = request.args.get("q")

    if query_word:
        query = db.select(Note).filter(Note.title.ilike(f"%{query_word}%"))
    else:
        query = db.select(Note)

    notes = db.session.execute(query.order_by(Note.id)).scalars()

    schema = NoteSchema(many=True)
    result = schema.dump(notes)

    return result


@notes_bp.route("/", methods=["POST"])
def create_note():
    schema = NoteSchema()

    data = schema.load(request.get_json())
    note = Note(**data)

    db.session.add(note)
    db.session.commit()

    result = schema.dump(note)

    return jsonify(
        {
            "message": "Note created successfully!",
            "note": result,
        }
    )


@notes_bp.route("/<int:note_id>", methods=["GET"])
def get_note(note_id):
    note = db.get_or_404(Note, note_id)

    schema = NoteSchema()
    result = schema.dump(note)

    return result


@notes_bp.route("/<int:note_id>", methods=["PATCH"])
def edit_note(note_id):
    note = db.get_or_404(Note, note_id)

    schema = NoteSchema()
    data = schema.load(request.get_json(), partial=True)

    for key, value in data.items():
        setattr(note, key, value)

    db.session.commit()

    result = schema.dump(note)

    return jsonify(
        {
            "message": "Note updated successfully!",
            "note": result,
        }
    )


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    note = db.get_or_404(Note, note_id)
    db.session.delete(note)
    db.session.commit()

    schema = NoteSchema()
    result = schema.dump(note)

    return jsonify(
        {
            "message": "Note deleted successfully!",
            "note": result,
        }
    )
