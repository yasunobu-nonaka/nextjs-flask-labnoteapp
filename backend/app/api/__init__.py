from flask import Blueprint
from .auth import auth_bp
from .notes import notes_bp
from .folders import folders_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")

api_bp.register_blueprint(auth_bp)
api_bp.register_blueprint(notes_bp)
api_bp.register_blueprint(folders_bp)
