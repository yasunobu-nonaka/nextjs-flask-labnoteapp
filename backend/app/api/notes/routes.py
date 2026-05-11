from flask import jsonify, request
from app.model.note import db, Note

from . import notes_bp


@notes_bp.route("/")
def notes_index():
    notes = db.session.execute(db.select(Note).order_by(Note.id)).scalars()
    notes_list = [
        {
            "id": note.id,
            "user_id": note.user_id,
            "title": note.title,
            "content_md": note.content_md,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }
        for note in notes
    ]
    print(len(notes_list))
    return jsonify(notes_list)


@notes_bp.route("/new", methods=["POST"])
def create_note():
    data = request.get_json()
    note = Note(
        user_id=data["user_id"], title=data["title"], content_md=data["content_md"]
    )
    db.session.add(note)
    db.session.commit()

    return jsonify(
        {
            "message": "Note created successfully!",
            "note": {
                "id": note.id,
                "user_id": note.user_id,
                "title": note.title,
                "content_md": note.content_md,
                "created_at": note.created_at,
                "updated_at": note.updated_at,
            },
        }
    )


@notes_bp.route("/<int:note_id>")
def get_note(note_id):
    note = db.get_or_404(Note, note_id)
    return jsonify(
        {
            "id": note.id,
            "user_id": note.user_id,
            "title": note.title,
            "content_md": note.content_md,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }
    )


@notes_bp.route("/<int:note_id>/edit", methods=["PATCH"])
def edit_note(note_id):
    data = request.get_json()
    note = db.get_or_404(Note, note_id)

    if "title" in data:
        note.title = data["title"]

    if "content_md" in data:
        note.content_md = data["content_md"]

    db.session.commit()

    return jsonify(
        {
            "message": "Note updated successfully!",
            "note": {
                "id": note.id,
                "user_id": note.user_id,
                "title": note.title,
                "content_md": note.content_md,
                "created_at": note.created_at,
                "updated_at": note.updated_at,
            },
        }
    )


@notes_bp.route("/<int:note_id>/delete", methods=["DELETE"])
def delete_note(note_id):
    note = db.get_or_404(Note, note_id)
    db.session.delete(note)
    db.session.commit()

    return jsonify(
        {
            "message": "Note deleted successfully!",
            "note": {
                "id": note.id,
                "user_id": note.user_id,
                "title": note.title,
                "content_md": note.content_md,
                "created_at": note.created_at,
                "updated_at": note.updated_at,
            },
        }
    )
