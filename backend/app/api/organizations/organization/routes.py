from flask import jsonify, request
from flask_jwt_extended import current_user, jwt_required
from marshmallow import ValidationError

from app.schema import (
    OrganizationCreateSchema,
    OrganizationUpdateSchema,
    OrganizationMemberResponseSchema,
    AddOrgMemberSchema,
    UpdateOrgMemberRoleSchema,
)
from app.api.organizations.permissions import (
    check_org_membership,
    require_org_member,
    check_org_role,
    get_organization_or_404,
)
from app.api.organizations.organization.service import (
    create_organization,
    get_organizations_for_user,
    add_org_member,
    update_org_member_role,
    remove_org_member,
    update_organization,
    update_org_policy,
    delete_organization,
    transfer_org_ownership,
    build_member_response,
    build_org_response,
)
from .. import organizations_bp

# スキーマのインスタンス
org_create_schema = OrganizationCreateSchema()
org_update_schema = OrganizationUpdateSchema()
org_member_res_schema = OrganizationMemberResponseSchema()
org_member_res_many_schema = OrganizationMemberResponseSchema(many=True)
add_org_member_schema = AddOrgMemberSchema()
update_org_role_schema = UpdateOrgMemberRoleSchema()


# ============================================================
#  組織（Organization）エンドポイント
# ============================================================


@organizations_bp.route("", methods=["GET"])
@jwt_required()
def list_organizations():
    """ログインユーザーが所属する組織一覧を返す。"""

    orgs = get_organizations_for_user(current_user.id)

    result = []
    for org in orgs:
        member = check_org_membership(current_user.id, org.id)
        result.append(build_org_response(org, member.role.name if member else None))

    return jsonify(result)


@organizations_bp.route("", methods=["POST"])
@jwt_required()
def create_org():
    """新規組織を作成する。作成者が自動的にownerになる。"""

    try:
        data = org_create_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    org = create_organization(
        data["name"], current_user.id, policy_data=data.get("policy")
    )
    member = check_org_membership(current_user.id, org.id)

    return (
        jsonify(
            {
                "message": "組織を作成しました",
                "organization": build_org_response(org, member.role.name),
            }
        ),
        201,
    )


@organizations_bp.route("/<int:org_id>", methods=["GET"])
@jwt_required()
def get_org(org_id):
    """組織の詳細情報を返す。メンバーのみアクセス可能。"""

    org = get_organization_or_404(org_id)
    member = require_org_member(current_user.id, org_id)

    return jsonify(build_org_response(org, member.role.name))


@organizations_bp.route("/<int:org_id>", methods=["PATCH"])
@jwt_required()
def update_org(org_id):
    """組織名・ポリシーを更新する。owner または sys_admin のみ可能。"""

    require_org_member(current_user.id, org_id)
    if not check_org_role(current_user.id, org_id, ["owner", "sys_admin"]):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = org_update_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    org = get_organization_or_404(org_id)

    if "name" in data:
        update_organization(org, {"name": data["name"]})

    if "policy" in data:
        if org.policy:
            update_org_policy(org.policy, data["policy"])

    member = check_org_membership(current_user.id, org_id)
    return jsonify(build_org_response(org, member.role.name if member else None))


@organizations_bp.route("/<int:org_id>/transfer-ownership", methods=["POST"])
@jwt_required()
def transfer_ownership(org_id):
    """組織のオーナー権限を別のメンバーに移譲する。現在のオーナーのみ実行可能。"""

    require_org_member(current_user.id, org_id)
    if not check_org_role(current_user.id, org_id, ["owner"]):
        return jsonify({"message": "この操作はオーナーのみ行えます"}), 403

    data = request.get_json() or {}
    new_owner_id = data.get("user_id")
    if not new_owner_id:
        return jsonify({"message": "user_id は必須です"}), 400

    try:
        transfer_org_ownership(org_id, new_owner_id, current_user.id)
    except ValueError as err:
        return jsonify({"message": str(err)}), 400

    # 移譲後の呼び出し元のロールは member に変わっているため、更新後の状態を返す
    org = get_organization_or_404(org_id)
    member = check_org_membership(current_user.id, org_id)
    return jsonify(
        {
            "message": "オーナーを移譲しました",
            "organization": build_org_response(
                org, member.role.name if member else None
            ),
        }
    )


@organizations_bp.route("/<int:org_id>", methods=["DELETE"])
@jwt_required()
def delete_org(org_id):
    """組織を削除する。ownerのみ可能。グループ・メンバー・ノートを含むすべてのデータが削除される。"""

    require_org_member(current_user.id, org_id)
    if not check_org_role(current_user.id, org_id, ["owner"]):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    org = get_organization_or_404(org_id)
    try:
        delete_organization(org)
    except ValueError as err:
        return jsonify({"message": str(err)}), 409
    return "", 204


# ============================================================
#  組織メンバー（OrganizationMember）エンドポイント
# ============================================================


@organizations_bp.route("/<int:org_id>/members", methods=["GET"])
@jwt_required()
def list_org_members(org_id):
    """組織のメンバー一覧を返す。メンバーのみアクセス可能。"""

    require_org_member(current_user.id, org_id)

    org = get_organization_or_404(org_id)
    result = [build_member_response(m) for m in org.members]

    return jsonify(org_member_res_many_schema.dump(result))


@organizations_bp.route("/<int:org_id>/members", methods=["POST"])
@jwt_required()
def add_member(org_id):
    """組織にメンバーを追加する。sys_admin または user_admin のみ可能。"""

    require_org_member(current_user.id, org_id)
    if not check_org_role(
        current_user.id, org_id, ["owner", "sys_admin", "user_admin"]
    ):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = add_org_member_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    try:
        member = add_org_member(org_id, data["user_id"], data.get("role", "member"))
    except ValueError as err:
        return jsonify({"message": str(err)}), 400

    return (
        jsonify(
            {
                "message": "メンバーを追加しました",
                "member": org_member_res_schema.dump(build_member_response(member)),
            }
        ),
        201,
    )


@organizations_bp.route("/<int:org_id>/members/<int:member_user_id>", methods=["PATCH"])
@jwt_required()
def update_member_role(org_id, member_user_id):
    """組織メンバーのロールを変更する。sys_admin のみ可能。"""

    require_org_member(current_user.id, org_id)
    if not check_org_role(current_user.id, org_id, ["owner", "sys_admin"]):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = update_org_role_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    from app.model.organization import OrganizationMember
    from app.extensions import db

    member = db.session.execute(
        db.select(OrganizationMember).filter_by(
            user_id=member_user_id, organization_id=org_id
        )
    ).scalar_one_or_none()

    if not member:
        return jsonify({"message": "メンバーが見つかりません"}), 404

    try:
        member = update_org_member_role(member, data["role"])
    except ValueError as err:
        return jsonify({"message": str(err)}), 400

    return jsonify(
        {
            "message": "ロールを変更しました",
            "member": org_member_res_schema.dump(build_member_response(member)),
        }
    )


@organizations_bp.route(
    "/<int:org_id>/members/<int:member_user_id>", methods=["DELETE"]
)
@jwt_required()
def remove_member(org_id, member_user_id):
    """組織メンバーを削除する。sys_admin または user_admin のみ可能。"""

    require_org_member(current_user.id, org_id)
    if not check_org_role(
        current_user.id, org_id, ["owner", "sys_admin", "user_admin"]
    ):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    from app.model.organization import OrganizationMember
    from app.extensions import db

    member = db.session.execute(
        db.select(OrganizationMember).filter_by(
            user_id=member_user_id, organization_id=org_id
        )
    ).scalar_one_or_none()

    if not member:
        return jsonify({"message": "メンバーが見つかりません"}), 404

    try:
        remove_org_member(member)
    except ValueError as err:
        return jsonify({"message": str(err)}), 400

    return "", 204


@organizations_bp.route("/<int:org_id>/leave", methods=["POST"])
@jwt_required()
def leave_organization(org_id):
    """自分自身をこの組織から脱退させる。ownerは事前にオーナー移譲が必要。"""
    member = require_org_member(current_user.id, org_id)
    try:
        remove_org_member(member)  # role.name == "owner" なら ValueError
    except ValueError as err:
        return jsonify({"message": str(err)}), 409
    return "", 204
