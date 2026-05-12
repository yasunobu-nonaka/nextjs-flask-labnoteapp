from flask import Blueprint
from .notes import notes_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")

api_bp.register_blueprint(notes_bp)
