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


def get_member_result_notifications(user_id: int) -> List[dict]:
    """申請者向け通知を返す。承認・拒否の結果をポーリングで届けるために使用する。

    対象:
    - approved: 自分の申請が承認された（status='active' かつ approved_at が存在する）
    - rejected: 自分の申請が拒否された（status='rejected'）
    """

    # approved_at が存在する active レコード = 申請フロー経由で承認されたもの
    approved_members = db.session.execute(
        db.select(GroupMember).filter(
            GroupMember.user_id == user_id,
            GroupMember.status == "active",
            GroupMember.approved_at.is_not(None),
        )
    ).scalars().all()

    # rejected レコード = 拒否通知未確認のもの
    rejected_members = db.session.execute(
        db.select(GroupMember).filter(
            GroupMember.user_id == user_id,
            GroupMember.status == "rejected",
        )
    ).scalars().all()

    notifications = []
    for m in approved_members:
        notifications.append({
            "type": "join_request_approved",
            "org_id": m.group.organization_id,
            "group_id": m.group_id,
            "group_name": m.group.name,
            "approved_at": m.approved_at.isoformat() if m.approved_at else None,
        })

    for m in rejected_members:
        notifications.append({
            "type": "join_request_rejected",
            "org_id": m.group.organization_id,
            "group_id": m.group_id,
            "group_name": m.group.name,
            "rejected_at": m.rejected_at.isoformat() if m.rejected_at else None,
        })

    return notifications


def dismiss_rejected_notifications(user_id: int) -> None:
    """拒否通知を確認済みとして削除する。

    ユーザーがベルを開いて rejected 通知を確認した時点でレコードを削除する。
    rejected レコードを削除することで再申請が可能になる。
    """

    rejected_members = db.session.execute(
        db.select(GroupMember).filter(
            GroupMember.user_id == user_id,
            GroupMember.status == "rejected",
        )
    ).scalars().all()

    for m in rejected_members:
        db.session.delete(m)
    db.session.commit()
