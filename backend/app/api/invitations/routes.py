from flask import jsonify
from flask_jwt_extended import current_user, jwt_required

from app.api.organizations.invitation_service import (
    get_invitation_by_token,
    accept_invitation,
    build_invitation_response,
)
from . import invitations_bp


@invitations_bp.route("/<token>", methods=["GET"])
def get_invitation(token: str):
    """招待トークンの詳細を返す。認証不要（招待受け入れページの表示用）。"""

    invitation = get_invitation_by_token(token)
    if not invitation:
        return jsonify({"message": "招待が見つかりません"}), 404

    if not invitation.is_valid():
        return jsonify({"message": "この招待は期限切れか、すでに使用済みです"}), 400

    return jsonify(build_invitation_response(invitation)), 200


@invitations_bp.route("/<token>/accept", methods=["POST"])
@jwt_required()
def accept_invitation_route(token: str):
    """招待を承認してログインユーザーを組織に追加する。"""

    invitation = get_invitation_by_token(token)
    if not invitation:
        return jsonify({"message": "招待が見つかりません"}), 404

    if not invitation.is_valid():
        return jsonify({"message": "この招待は期限切れか、すでに使用済みです"}), 400

    # 招待先メールアドレスとログインユーザーのメールが一致するか確認する
    if current_user.email.lower() != invitation.email.lower():
        return jsonify({"message": "この招待はあなた宛ではありません"}), 403

    accept_invitation(invitation, current_user)
    return jsonify({"message": "組織に参加しました", "organization_id": invitation.organization_id}), 200
