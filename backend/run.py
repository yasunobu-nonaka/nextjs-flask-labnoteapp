from dotenv import load_dotenv

load_dotenv()

from flask import Flask
from app.api import api_bp
from app.model.note import db, Note
import os

app = Flask(__name__)
app.register_blueprint(api_bp)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
print(os.environ.get("DATABASE_URL"))

db.init_app(app)

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    with app.app_context():
        note1 = Note(
            user_id=1,
            title="note1",
            content_md="note content 1",
        )
        note2 = Note(
            user_id=2,
            title="note2",
            content_md="note content 2",
        )
        note3 = Note(
            user_id=3,
            title="note3",
            content_md="note content 3",
        )

        db.session.add_all([note1, note2, note3])
        db.session.commit()

    app.run(debug=True)
