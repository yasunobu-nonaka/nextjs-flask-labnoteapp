from flask import jsonify, request
from app.extensions import db
from app.model import Note
from app.schema import NoteSchema

from . import notes_bp


@notes_bp.route("/", methods=["GET"])
def notes_index():
    notes = db.session.execute(db.select(Note).order_by(Note.id)).scalars()

    schema = NoteSchema(many=True)
    result = schema.dump(notes)

    return result


@notes_bp.route("/", methods=["POST"])
def create_note():
    data = request.get_json()
    note = Note(
        user_id=data["user_id"], title=data["title"], content_md=data["content_md"]
    )
    db.session.add(note)
    db.session.commit()

    schema = NoteSchema()
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
    data = request.get_json()
    note = db.get_or_404(Note, note_id)

    if "title" in data:
        note.title = data["title"]

    if "content_md" in data:
        note.content_md = data["content_md"]

    db.session.commit()

    schema = NoteSchema()
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
