from flask import jsonify, request
from flask_jwt_extended import current_user, jwt_required
from marshmallow import ValidationError

from app.schema.invitation_schema import InvitationCreateSchema, InvitationResponseSchema
from app.api.organizations.organization_service import (
    get_organization_or_404,
    check_org_permission,
)
from app.api.organizations.invitation_service import (
    create_invitation,
    build_invitation_response,
)
from . import organizations_bp

invitation_create_schema = InvitationCreateSchema()
invitation_res_schema = InvitationResponseSchema()


@organizations_bp.route("/<int:org_id>/invitations", methods=["POST"])
@jwt_required()
def send_invitation(org_id: int):
    """組織への招待メールを送信する。org:member_add 権限が必要。"""

    org = get_organization_or_404(org_id)

    if not check_org_permission(current_user.id, org_id, "org:member_add"):
        return jsonify({"message": "権限がありません"}), 403

    try:
        data = invitation_create_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"message": "入力値が不正です", "errors": e.messages}), 422

    try:
        invitation = create_invitation(
            org=org,
            email=data["email"],
            role_name=data["role"],
            invited_by_user_id=current_user.id,
        )
    except ValueError as e:
        return jsonify({"message": str(e)}), 400

    return jsonify(build_invitation_response(invitation)), 201
