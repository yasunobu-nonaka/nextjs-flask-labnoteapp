from flask import jsonify
from flask_jwt_extended import current_user, jwt_required

from app.api.notifications.notification_service import (
    get_join_request_notifications,
    get_member_result_notifications,
    dismiss_rejected_notifications,
)
from . import notifications_bp


@notifications_bp.route("", methods=["GET"])
@jwt_required()
def list_notifications():
    """ログインユーザー宛の通知一覧を返す。

    - 管理者向け: 自分が admin を務めるグループへの参加申請（type: join_request）
    - 申請者向け: 自分の申請が承認・拒否された結果（type: join_request_approved / join_request_rejected）

    ポーリング（30秒間隔）を前提とした設計。
    """

    admin_notifications = get_join_request_notifications(current_user.id)
    member_notifications = get_member_result_notifications(current_user.id)
    return jsonify(admin_notifications + member_notifications)


@notifications_bp.route("/rejected", methods=["DELETE"])
@jwt_required()
def dismiss_rejected():
    """拒否通知を確認済みとして削除する。

    ユーザーがベルを開いて rejected 通知を確認したタイミングで呼ぶ。
    対象レコードを削除することで次回ポーリング時に通知が出なくなる。
    """

    dismiss_rejected_notifications(current_user.id)
    return "", 204
