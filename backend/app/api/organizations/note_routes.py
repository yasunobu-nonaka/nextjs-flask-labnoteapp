"""
グループスコープのノート・タグ API。
URL: /api/organizations/<org_id>/groups/<group_id>/notes/...
"""
import math

from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from app.schema import NoteCreateSchema, NoteResponseSchema, NoteShareSchema, PrivateNoteMemberSchema
from app.api.notes.note_service import (
    get_notes_service,
    get_note_or_404_service,
    create_note_service,
    update_note_service,
    delete_note_service,
    get_private_note_members_service,
    add_private_note_member_service,
    remove_private_note_member_service,
)
from app.api.notes.tag_service import get_group_tags
from flask import abort

from app.api.organizations.organization_service import check_org_permission
from app.api.organizations.group_service import get_group_or_404, check_group_permission
from app.api.notifications.notification_service import (
    create_private_note_invitation_notification,
)

from . import organizations_bp

create_schema = NoteCreateSchema()
res_schema_note = NoteResponseSchema()
res_schema_notes = NoteResponseSchema(many=True)
share_schema = NoteShareSchema()
res_schema_members = PrivateNoteMemberSchema(many=True)


def _check_access(org_id: int, group_id: int, permission_code: str):
    """組織メンバーシップとグループ権限をまとめて確認するヘルパー。

    org_id とのネスト整合性（group.organization_id == org_id）も検証する。
    非メンバーや private グループの非メンバーには 404 を返し、存在を漏洩させない。
    権限不足の場合は (response, status_code) タプルを返す。問題なければ None を返す。
    """
    if not check_org_permission(current_user.id, org_id, "org:read"):
        abort(404)

    group = get_group_or_404(group_id, org_id)

    if not check_group_permission(current_user.id, group_id, permission_code):
        if group.is_private:
            abort(404)
        return jsonify({"message": "権限がありません"}), 403

    return None


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/tags", methods=["GET"]
)
@jwt_required()
def list_group_tags(org_id, group_id):
    """グループ内のタグ一覧を返す。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    return jsonify(get_group_tags(group_id))


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes", methods=["GET"]
)
@jwt_required()
def list_notes(org_id, group_id):
    """グループ内のノート一覧を返す（検索・タグ・フォルダー・ページネーション対応）。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    query_word = request.args.get("q")
    tag_names = request.args.getlist("tag")
    _folder_id_str = request.args.get("folder_id")
    if _folder_id_str is None:
        folder_id = None
    elif _folder_id_str == "null":
        folder_id = "null"
    else:
        folder_id = int(_folder_id_str)
    page = request.args.get("page", 1, type=int)
    per_page = 10

    notes, total = get_notes_service(
        group_id, query_word, tag_names, folder_id, page, per_page,
        current_user_id=current_user.id,
    )

    return jsonify({
        "notes": res_schema_notes.dump(notes),
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, math.ceil(total / per_page)),
    })


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes", methods=["POST"]
)
@jwt_required()
def create_note(org_id, group_id):
    """グループ内にノートを作成する。is_private=True のとき作成者を owner として登録する。"""
    err = _check_access(org_id, group_id, "note:create")
    if err:
        return err

    try:
        data = create_schema.load(request.get_json())
    except ValidationError as e:
        return jsonify({"message": "validation error", "errors": e.messages}), 400

    note = create_note_service(data, group_id, current_user.id)
    return jsonify({"message": "Note created successfully!", "note": res_schema_note.dump(note)}), 201


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/<int:note_id>", methods=["GET"]
)
@jwt_required()
def get_note(org_id, group_id, note_id):
    """ノート詳細を返す。プライベートノートは作成者・共有メンバーのみ取得可。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    note = get_note_or_404_service(note_id, group_id, current_user_id=current_user.id)
    return res_schema_note.dump(note)


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/<int:note_id>", methods=["PATCH"]
)
@jwt_required()
def edit_note(org_id, group_id, note_id):
    """ノートを更新する。プライベートノートは owner/editor のみ編集可。"""
    err = _check_access(org_id, group_id, "note:edit")
    if err:
        return err

    try:
        data = create_schema.load(request.get_json(), partial=True)
    except ValidationError as e:
        return jsonify({"message": "validation error", "errors": e.messages}), 400

    note = get_note_or_404_service(note_id, group_id, current_user_id=current_user.id)
    note = update_note_service(note, data, group_id, current_user_id=current_user.id)
    return jsonify({"message": "Note updated successfully!", "note": res_schema_note.dump(note)})


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/<int:note_id>", methods=["DELETE"]
)
@jwt_required()
def delete_note(org_id, group_id, note_id):
    """ノートを削除する。プライベートノートは owner のみ削除可。"""
    err = _check_access(org_id, group_id, "note:delete")
    if err:
        return err

    note = get_note_or_404_service(note_id, group_id, current_user_id=current_user.id)
    delete_note_service(note, current_user_id=current_user.id)
    return "", 204


# ── プライベートノートメンバー管理 ──────────────────────────────────────────

@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/<int:note_id>/members", methods=["GET"]
)
@jwt_required()
def list_note_members(org_id, group_id, note_id):
    """プライベートノートの共有メンバー一覧を返す。オーナーのみ閲覧可。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    note = get_note_or_404_service(note_id, group_id, current_user_id=current_user.id)
    members = get_private_note_members_service(note, current_user.id)
    return jsonify(res_schema_members.dump(members))


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/<int:note_id>/members", methods=["POST"]
)
@jwt_required()
def add_note_member(org_id, group_id, note_id):
    """プライベートノートにメンバーを招待する。オーナーのみ実行可。招待通知を送る。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    try:
        data = share_schema.load(request.get_json())
    except ValidationError as e:
        return jsonify({"message": "validation error", "errors": e.messages}), 400

    note = get_note_or_404_service(note_id, group_id, current_user_id=current_user.id)
    new_member = add_private_note_member_service(
        note, data["user_id"], data["role"], current_user.id
    )

    # 招待通知を作成する
    link_url = f"/organizations/{org_id}/groups/{group_id}/notes/{note_id}"
    create_private_note_invitation_notification(
        invitee_user_id=data["user_id"],
        note_title=note.title,
        inviter_username=current_user.username,
        link_url=link_url,
    )

    from app.schema.note_schema import PrivateNoteMemberSchema as _MemberSchema
    return jsonify({"message": "メンバーを招待しました", "member": _MemberSchema().dump(new_member)}), 201


@organizations_bp.route(
    "/<int:org_id>/groups/<int:group_id>/notes/<int:note_id>/members/<int:target_user_id>",
    methods=["DELETE"],
)
@jwt_required()
def remove_note_member(org_id, group_id, note_id, target_user_id):
    """プライベートノートのメンバーを削除する。オーナーのみ実行可。"""
    err = _check_access(org_id, group_id, "note:read")
    if err:
        return err

    note = get_note_or_404_service(note_id, group_id, current_user_id=current_user.id)
    remove_private_note_member_service(note, target_user_id, current_user.id)
    return "", 204
