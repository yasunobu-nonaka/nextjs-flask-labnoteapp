"""組織・グループの権限チェック共通ヘルパー。

organization/group/note/folder の各リソースから横断的に参照されるため、
特定リソースの service モジュールではなくここに置く。
"""

from typing import List, Optional

from flask import abort

from app.extensions import db
from app.model.organization import Organization, OrganizationMember
from app.model.group import Group, GroupMember


# ============================================================
#  組織レベル
# ============================================================


def get_organization_or_404(org_id: int) -> Organization:
    """組織を取得する。存在しない場合は404を返す。"""

    return db.one_or_404(
        db.select(Organization).filter_by(id=org_id)
    )


def check_org_membership(user_id: int, org_id: int) -> Optional[OrganizationMember]:
    """ユーザーの組織メンバーシップを返す。所属していなければNoneを返す。"""

    return db.session.execute(
        db.select(OrganizationMember).filter_by(user_id=user_id, organization_id=org_id)
    ).scalar_one_or_none()


def require_org_member(user_id: int, org_id: int) -> OrganizationMember:
    """組織メンバーでない場合は 404 を返す。403 を返さないことで組織の存在を漏洩させない。"""

    member = check_org_membership(user_id, org_id)
    if not member:
        abort(404)
    return member


def check_org_role(user_id: int, org_id: int, required_roles: List[str]) -> bool:
    """ユーザーが指定ロールのいずれかを持つかを確認する。"""

    member = check_org_membership(user_id, org_id)
    return member is not None and member.role.name in required_roles


def check_org_permission(user_id: int, org_id: int, permission_code: str) -> bool:
    """ユーザーが指定のパーミッションコードを持つかを確認する。

    ロール名での判定 (check_org_role) より細粒度の権限チェックが必要な場合に使用する。
    """

    member = check_org_membership(user_id, org_id)
    if not member or not member.role:
        return False
    return member.role.has_permission(permission_code)


# ============================================================
#  グループレベル
# ============================================================


def get_group_or_404(group_id: int, org_id: int) -> Group:
    """グループを取得する。存在しない・組織外の場合は404を返す。"""

    return db.one_or_404(
        db.select(Group).filter_by(id=group_id, organization_id=org_id)
    )


def get_any_membership(user_id: int, group_id: int) -> Optional[GroupMember]:
    """status を問わずメンバーシップを返す（active / pending を含む）。"""

    return db.session.execute(
        db.select(GroupMember).filter_by(user_id=user_id, group_id=group_id)
    ).scalar_one_or_none()


def check_group_membership(user_id: int, group_id: int) -> Optional[GroupMember]:
    """ユーザーのアクティブなグループメンバーシップを返す。
    active メンバーでなければ None を返す（RBAC・権限チェックに使用する）。
    """

    return db.session.execute(
        db.select(GroupMember).filter_by(
            user_id=user_id, group_id=group_id, status="active"
        )
    ).scalar_one_or_none()


def require_group_visible(user_id: int, group: Group) -> None:
    """プライベートグループの非メンバーには 404 を返す。403 を返さないことでグループの存在を漏洩させない。"""

    if group.is_private and not check_group_membership(user_id, group.id):
        abort(404)


def check_group_role(user_id: int, group_id: int, required_roles: List[str]) -> bool:
    """ユーザーが指定ロールのいずれかを持つかを確認する。"""

    member = check_group_membership(user_id, group_id)
    return member is not None and member.role.name in required_roles


def check_group_permission(user_id: int, group_id: int, permission_code: str) -> bool:
    """ユーザーが指定のパーミッションコードを持つかを確認する。

    ロール名での判定 (check_group_role) より細粒度の権限チェックが必要な場合に使用する。
    """

    member = check_group_membership(user_id, group_id)
    if not member or not member.role:
        return False
    return member.role.has_permission(permission_code)
