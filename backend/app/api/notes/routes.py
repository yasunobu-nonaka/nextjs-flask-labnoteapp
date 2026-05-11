from flask import jsonify
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
