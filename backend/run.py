from dotenv import load_dotenv

load_dotenv()

from flask import Flask
from app.api import api_bp
from app.extensions import db
from app.model import Note
import os

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")

db.init_app(app)

app.register_blueprint(api_bp)

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)
