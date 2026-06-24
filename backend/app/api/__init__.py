from flask import Blueprint
from .auth import auth_bp
from .organizations import organizations_bp
from .invitations import invitations_bp
from .notifications import notifications_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")

api_bp.register_blueprint(auth_bp)
# Phase 3: notes_bp / folders_bp は /api/organizations/<org_id>/groups/<group_id>/notes へ移行済み
api_bp.register_blueprint(organizations_bp)
# Phase 5: 招待トークンの詳細取得・承認
api_bp.register_blueprint(invitations_bp)
# 通知 API（参加申請などのポーリング用）
api_bp.register_blueprint(notifications_bp)
