from flask import Flask, jsonify
from datetime import datetime

app = Flask(__name__)

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


@app.route("/api/notes")
def notes_index():
    return jsonify(notes)


if __name__ == "__main__":
    app.run(debug=True)
