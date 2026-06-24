from typing import List

from app.extensions import db
from app.model.group import GroupMember
from app.model.rbac import RoleLocal


def get_join_request_notifications(user_id: int) -> List[dict]:
    """ログインユーザーがグループ admin を務めるグループへの参加申請を一括取得して通知リストとして返す。

    対象グループ:
    - ユーザーが group admin（RoleLocal.name='admin'）として active 所属しているグループ

    2クエリで完結する（N+1 なし）。
    """

    # 1. ユーザーが admin を持つグループ ID を取得する
    admin_group_ids = db.session.execute(
        db.select(GroupMember.group_id)
        .join(RoleLocal, GroupMember.role_id == RoleLocal.id)
        .filter(
            GroupMember.user_id == user_id,
            GroupMember.status == "active",
            RoleLocal.name == "admin",
        )
    ).scalars().all()

    if not admin_group_ids:
        return []

    # 2. pending 申請を一括取得する（GroupMember.group / user は lazy="joined" で自動ロード）
    pending_members = db.session.execute(
        db.select(GroupMember).filter(
            GroupMember.group_id.in_(admin_group_ids),
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
