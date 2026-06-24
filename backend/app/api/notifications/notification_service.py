from typing import List

from app.extensions import db
from app.model.group import Group, GroupMember
from app.model.organization import OrganizationMember
from app.model.rbac import RoleGlobal, RoleLocal


def get_join_request_notifications(user_id: int) -> List[dict]:
    """ログインユーザーが管理者を務めるグループへの参加申請を一括取得して通知リストとして返す。

    対象グループ:
    - ユーザーが group admin（RoleLocal.name='admin'）として active 所属しているグループ
    - ユーザーが組織の owner または sys_admin であり、その組織に属する全グループ

    合計4クエリで完結する（N+1 なし）。
    """

    # 1. ユーザーが直接 admin を持つグループ ID を取得する
    group_admin_group_ids = db.session.execute(
        db.select(GroupMember.group_id)
        .join(RoleLocal, GroupMember.role_id == RoleLocal.id)
        .filter(
            GroupMember.user_id == user_id,
            GroupMember.status == "active",
            RoleLocal.name == "admin",
        )
    ).scalars().all()

    # 2. ユーザーが owner / sys_admin を持つ組織 ID を取得する
    org_admin_org_ids = db.session.execute(
        db.select(OrganizationMember.organization_id)
        .join(RoleGlobal, OrganizationMember.role_id == RoleGlobal.id)
        .filter(
            OrganizationMember.user_id == user_id,
            RoleGlobal.name.in_(["owner", "sys_admin"]),
        )
    ).scalars().all()

    # 3. その組織に属する全グループ ID を取得する
    org_admin_group_ids: list[int] = []
    if org_admin_org_ids:
        org_admin_group_ids = db.session.execute(
            db.select(Group.id).filter(
                Group.organization_id.in_(org_admin_org_ids)
            )
        ).scalars().all()

    # 4. 両方のグループ ID を合算して重複を除去する
    all_admin_group_ids = list(set(list(group_admin_group_ids) + list(org_admin_group_ids)))
    if not all_admin_group_ids:
        return []

    # 5. pending 申請を一括取得する（GroupMember.group / user は lazy="joined" で自動ロード）
    pending_members = db.session.execute(
        db.select(GroupMember).filter(
            GroupMember.group_id.in_(all_admin_group_ids),
            GroupMember.status == "pending",
        )
    ).scalars().all()

    # 6. 通知オブジェクトに変換して返す
    notifications = []
    for m in pending_members:
        notifications.append({
            "type": "join_request",
            "org_id": m.group.organization_id,
            "group_id": m.group_id,
            "group_name": m.group.name,
            "requester_user_id": m.user_id,
            "requester_username": m.user.username,
            "requester_email": m.user.email,
            "requested_at": m.joined_at.isoformat() if m.joined_at else None,
        })

    return notifications
