from flask import Blueprint, jsonify
from datetime import datetime

from . import notes_bp

notes = [
    {
        "id": 1,
        "user_id": 1,
        "title": "note1",
        "content_md": "note content 1",
        "created_at": datetime(2026, 4, 1),
        "updated_at": datetime(2026, 4, 2),
    },
    {
        "id": 2,
        "user_id": 2,
        "title": "note1",
        "content_md": "note content 2",
        "created_at": datetime(2026, 4, 10),
        "updated_at": datetime(2026, 4, 11),
    },
    {
        "id": 3,
        "user_id": 1,
        "title": "note1",
        "content_md": "note content 3",
        "created_at": datetime(2026, 5, 1),
        "updated_at": datetime(2026, 5, 2),
    },
]


@notes_bp.route("/")
def notes_index():
    return jsonify(notes)
