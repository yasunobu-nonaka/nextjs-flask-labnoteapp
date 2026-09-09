from flask import Blueprint

organizations_bp = Blueprint("organizations", __name__, url_prefix="/organizations")

# 各サブパッケージの routes.py を import して @organizations_bp.route(...) を登録させる。
# リソースごとに organization/ group/ note/ folder/ invitation/ のサブパッケージに分割し、
# それぞれ routes.py + service.py を同居させている（権限チェックの共通部品は permissions.py）。
from .organization import routes as organization_routes  # noqa: E402, F401
from .group import routes as group_routes  # noqa: E402, F401
from .note import routes as note_routes  # noqa: E402, F401
from .folder import routes as folder_routes  # noqa: E402, F401
from .invitation import routes as invitation_routes  # noqa: E402, F401
