from flask import Blueprint

folders_bp = Blueprint("folders", __name__, url_prefix="/folders")

from . import routes
