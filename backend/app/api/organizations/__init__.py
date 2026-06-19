from flask import Blueprint

organizations_bp = Blueprint("organizations", __name__, url_prefix="/organizations")

from . import routes, note_routes, folder_routes, invitation_routes  # noqa: E402, F401
