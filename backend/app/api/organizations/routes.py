from flask import jsonify, request
from flask_jwt_extended import current_user, jwt_required
from marshmallow import ValidationError

from app.schema import (
    OrganizationCreateSchema,
    OrganizationUpdateSchema,
    OrganizationMemberResponseSchema,
    AddOrgMemberSchema,
    UpdateOrgMemberRoleSchema,
    GroupCreateSchema,
    GroupUpdateSchema,
    GroupMemberResponseSchema,
    AddGroupMemberSchema,
    UpdateGroupMemberRoleSchema,
    JoinRequestActionSchema,
)
from app.api.organizations.organization_service import (
    create_organization,
    get_organizations_for_user,
    get_organization_or_404,
    check_org_membership,
    require_org_member,
    check_org_role,
    add_org_member,
    update_org_member_role,
    remove_org_member,
    update_organization,
    update_org_policy,
    delete_organization,
    build_member_response,
    build_org_response,
)
from app.api.organizations.group_service import (
    can_user_create_group,
    create_group,
    get_accessible_groups,
    get_group_or_404,
    check_group_membership,
    require_group_visible,
    get_any_membership,
    check_group_role,
    add_group_member,
    request_to_join,
    get_pending_join_requests,
    get_pending_join_request_count,
    approve_join_request,
    reject_join_request,
    cancel_join_request,
    update_group_member_role,
    remove_group_member,
    get_owned_private_notes_in_group,
    update_group,
    update_group_policy,
    delete_group,
    build_group_member_response,
    build_group_response,
)
from . import organizations_bp

# スキーマのインスタンス
org_create_schema = OrganizationCreateSchema()
org_update_schema = OrganizationUpdateSchema()
org_member_res_schema = OrganizationMemberResponseSchema()
org_member_res_many_schema = OrganizationMemberResponseSchema(many=True)
add_org_member_schema = AddOrgMemberSchema()
update_org_role_schema = UpdateOrgMemberRoleSchema()

group_create_schema = GroupCreateSchema()
group_update_schema = GroupUpdateSchema()
group_member_res_schema = GroupMemberResponseSchema()
group_member_res_many_schema = GroupMemberResponseSchema(many=True)
add_group_member_schema = AddGroupMemberSchema()
update_group_role_schema = UpdateGroupMemberRoleSchema()
join_request_action_schema = JoinRequestActionSchema()


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

    org = create_organization(data["name"], current_user.id, policy_data=data.get("policy"))
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


# ============================================================
#  グループ（Group）エンドポイント
# ============================================================


@organizations_bp.route("/<int:org_id>/groups", methods=["GET"])
@jwt_required()
def list_groups(org_id):
    """組織内のアクセス可能なグループ一覧を返す。組織メンバーのみアクセス可能。"""

    require_org_member(current_user.id, org_id)

    groups = get_accessible_groups(org_id, current_user.id)

    result = []
    for group in groups:
        membership = get_any_membership(current_user.id, group.id)
        user_role = membership.role.name if membership and membership.status == "active" else None
        join_status = membership.status if membership else None
        result.append(build_group_response(group, user_role, join_status))

    return jsonify(result)


@organizations_bp.route("/<int:org_id>/groups", methods=["POST"])
@jwt_required()
def create_grp(org_id):
    """グループを作成する。組織ポリシーに基づき権限を確認する。"""

    require_org_member(current_user.id, org_id)
    org = get_organization_or_404(org_id)

    if not org.policy:
        return jsonify({"message": "組織ポリシーが設定されていません"}), 500

    if not can_user_create_group(
        current_user.id, org_id, org.policy.who_can_create_groups
    ):
        return jsonify({"message": "グループを作成する権限がありません"}), 403

    # プライベートグループが禁止されている場合のチェック
    body = request.get_json() or {}
    if body.get("is_private") and not org.policy.allow_private_groups:
        return (
            jsonify({"message": "この組織ではプライベートグループを作成できません"}),
            403,
        )

    try:
        data = group_create_schema.load(body)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    group = create_group(
        org_id=org_id,
        name=data["name"],
        is_private=data.get("is_private", False),
        user_id=current_user.id,
        default_join_method=org.policy.default_join_method,
        policy_data=data.get("policy"),
        initial_members=data.get("initial_members"),
    )

    member = check_group_membership(current_user.id, group.id)
    return (
        jsonify(
            {
                "message": "グループを作成しました",
                "group": build_group_response(group, member.role.name if member else None),
            }
        ),
        201,
    )


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>", methods=["GET"])
@jwt_required()
def get_grp(org_id, group_id):
    """グループの詳細情報を返す。アクセス可能なグループのみ。"""

    require_org_member(current_user.id, org_id)

    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    member = check_group_membership(current_user.id, group_id)
    return jsonify(build_group_response(group, member.role.name if member else None))


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>", methods=["PATCH"])
@jwt_required()
def update_grp(org_id, group_id):
    """グループ情報・ポリシーを更新する。グループadminまたは組織sys_adminのみ可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    # グループadminまたは組織レベルの管理者
    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = group_update_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    # プライベート設定の変更時に組織ポリシーを確認
    org = get_organization_or_404(org_id)
    if data.get("is_private") and org.policy and not org.policy.allow_private_groups:
        return (
            jsonify({"message": "この組織ではプライベートグループを設定できません"}),
            403,
        )

    if "name" in data or "is_private" in data:
        update_group(group, {k: data[k] for k in ["name", "is_private"] if k in data})

    if "policy" in data and group.policy:
        update_group_policy(group.policy, data["policy"])

    member = check_group_membership(current_user.id, group_id)
    return jsonify(build_group_response(group, member.role.name if member else None))


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>", methods=["DELETE"])
@jwt_required()
def delete_grp(org_id, group_id):
    """グループを削除する。グループadminまたは組織sys_adminのみ可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    delete_group(group)
    return "", 204


# ============================================================
#  グループメンバー（GroupMember）エンドポイント
# ============================================================


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>/members", methods=["GET"])
@jwt_required()
def list_group_members(org_id, group_id):
    """グループのメンバー一覧を返す。グループメンバーのみアクセス可能。"""

    require_org_member(current_user.id, org_id)

    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    from app.model.group import GroupMember
    from app.extensions import db as _db
    active_members = _db.session.execute(
        _db.select(GroupMember).filter_by(group_id=group_id, status="active")
    ).scalars().all()
    result = [build_group_member_response(m) for m in active_members]
    return jsonify(group_member_res_many_schema.dump(result))


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>/members", methods=["POST"])
@jwt_required()
def add_grp_member(org_id, group_id):
    """グループにメンバーを追加する。グループadminのみ可能。追加対象は組織メンバーに限る。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = add_group_member_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    # 追加対象が組織のメンバーであることを確認
    from app.api.organizations.organization_service import (
        check_org_membership as _check_org,
    )

    if not _check_org(data["user_id"], org_id):
        return (
            jsonify(
                {"message": "追加対象のユーザーはこの組織のメンバーではありません"}
            ),
            400,
        )

    try:
        member = add_group_member(group_id, data["user_id"], data.get("role", "editor"))
    except ValueError as err:
        return jsonify({"message": str(err)}), 400

    return (
        jsonify(
            {
                "message": "グループメンバーを追加しました",
                "member": group_member_res_schema.dump(
                    build_group_member_response(member)
                ),
            }
        ),
        201,
    )


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/members/<int:member_user_id>",
    methods=["PATCH"],
)
@jwt_required()
def update_grp_member_role(org_id, group_id, member_user_id):
    """グループメンバーのロールを変更する。グループadminのみ可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = update_group_role_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    member = check_group_membership(member_user_id, group_id)
    if not member:
        return jsonify({"message": "グループメンバーが見つかりません"}), 404

    member = update_group_member_role(member, data["role"])
    return jsonify(
        {
            "message": "ロールを変更しました",
            "member": group_member_res_schema.dump(build_group_member_response(member)),
        }
    )


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/members/<int:member_user_id>",
    methods=["DELETE"],
)
@jwt_required()
def remove_grp_member(org_id, group_id, member_user_id):
    """グループメンバーを削除する。グループadminのみ可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    member = check_group_membership(member_user_id, group_id)
    if not member:
        return jsonify({"message": "グループメンバーが見つかりません"}), 404

    # オーナーであるプライベートノートが残っている場合は削除をブロックする
    owned_notes = get_owned_private_notes_in_group(member_user_id, group_id)
    if owned_notes:
        return jsonify({
            "message": "このメンバーがオーナーのプライベートノートが残っています。先にオーナーを移管してください。",
            "owned_notes": [{"id": n.id, "title": n.title} for n in owned_notes],
        }), 409

    remove_group_member(member)
    return "", 204


# ============================================================
#  グループ参加申請（Join Request）エンドポイント
# ============================================================


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>/join", methods=["POST"])
@jwt_required()
def join_group(org_id, group_id):
    """グループへの参加申請または即時参加。
    join_method='open' なら即時参加、'request' なら申請（pending）として登録する。
    'invite_only' の場合は 403 を返す。
    """

    require_org_member(current_user.id, org_id)

    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    try:
        member, result = request_to_join(group, current_user.id)
    except ValueError as err:
        code = str(err)
        if code == "already_member":
            return jsonify({"message": "すでにグループのメンバーです"}), 409
        if code == "already_pending":
            return jsonify({"message": "参加申請中です"}), 409
        if code == "invite_only":
            return jsonify({"message": "このグループは招待制です"}), 403
        return jsonify({"message": code}), 400

    return (
        jsonify({
            "result": result,
            "member": group_member_res_schema.dump(build_group_member_response(member)),
        }),
        201,
    )


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>/join", methods=["DELETE"])
@jwt_required()
def cancel_join(org_id, group_id):
    """自分自身の参加申請をキャンセルする。

    pending 申請が存在しない場合は 404 を返す。
    """

    require_org_member(current_user.id, org_id)

    get_group_or_404(group_id, org_id)

    try:
        cancel_join_request(group_id, current_user.id)
    except ValueError:
        return jsonify({"message": "キャンセルできる参加申請がありません"}), 404

    return "", 204


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>/join-requests", methods=["GET"])
@jwt_required()
def list_join_requests(org_id, group_id):
    """グループへの参加申請一覧を返す。グループadminまたは組織adminのみアクセス可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    pending = get_pending_join_requests(group_id)
    result = [build_group_member_response(m) for m in pending]
    return jsonify(group_member_res_many_schema.dump(result))


@organizations_bp.route("/<int:org_id>/groups/<int:group_id>/join-requests/count", methods=["GET"])
@jwt_required()
def count_join_requests(org_id, group_id):
    """グループの未承認参加申請数を返す（バッジ表示用）。グループadminのみアクセス可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    count = get_pending_join_request_count(group_id)
    return jsonify({"count": count})


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/join-requests/<int:target_user_id>",
    methods=["PATCH"],
)
@jwt_required()
def process_join_request(org_id, group_id, target_user_id):
    """参加申請を承認または拒否する。グループadminまたは組織adminのみ可能。"""

    require_org_member(current_user.id, org_id)
    group = get_group_or_404(group_id, org_id)
    require_group_visible(current_user.id, group)

    is_group_admin = check_group_role(current_user.id, group_id, ["admin"])
    is_org_admin = check_org_role(current_user.id, org_id, ["owner", "sys_admin"])

    if not (is_group_admin or is_org_admin):
        return jsonify({"message": "この操作を行う権限がありません"}), 403

    try:
        data = join_request_action_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    try:
        if data["action"] == "approve":
            member = approve_join_request(group_id, target_user_id)
            return jsonify({
                "message": "参加申請を承認しました",
                "member": group_member_res_schema.dump(build_group_member_response(member)),
            })
        else:
            reject_join_request(group_id, target_user_id)
            return "", 204
    except ValueError as err:
        return jsonify({"message": str(err)}), 404
