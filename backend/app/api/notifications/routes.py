from flask import jsonify
from flask_jwt_extended import current_user, jwt_required

from app.api.notifications.notification_service import get_join_request_notifications
from . import notifications_bp


@notifications_bp.route("", methods=["GET"])
@jwt_required()
def list_notifications():
    """ログインユーザー宛の通知一覧を返す。

    現在は「自分が管理者を務めるグループへの参加申請」のみを通知対象とする。
    ポーリング（30秒間隔）を前提とした設計で、pending 申請が存在する間は毎回返す。
    """

    notifications = get_join_request_notifications(current_user.id)
    return jsonify(notifications)
