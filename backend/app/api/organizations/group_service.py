from typing import List, Optional

from app.extensions import db
from app.model import User
from app.model.group import Group, GroupMember, GroupPolicy
from app.model.organization import OrganizationMember
from app.model.rbac import RoleLocal


def get_role_local(name: str) -> RoleLocal:
    """ロール名からRoleLocalオブジェクトを取得する。存在しない場合はValueErrorを送出する。"""

    role = db.session.execute(
        db.select(RoleLocal).filter_by(name=name)
    ).scalar_one_or_none()
    if not role:
        raise ValueError(f"グループロール '{name}' が見つかりません")
    return role


def can_user_create_group(user_id: int, org_id: int, who_can_create: str) -> bool:
    """組織ポリシーに基づき、ユーザーがグループを作成できるかを確認する。"""

    member = db.session.execute(
        db.select(OrganizationMember).filter_by(user_id=user_id, organization_id=org_id)
    ).scalar_one_or_none()

    if not member:
        return False

    role_name = member.role.name

    if who_can_create == "all":
        return True
    if who_can_create == "member":
        return role_name in ["owner", "sys_admin", "user_admin", "member"]
    if who_can_create == "user_admin":
        return role_name in ["owner", "sys_admin", "user_admin"]
    if who_can_create == "sys_admin_only":
        return role_name in ["owner", "sys_admin"]

    return False


def create_group(
    org_id: int,
    name: str,
    is_private: bool,
    user_id: int,
    default_join_method: str = "invite_only",
    policy_data: Optional[dict] = None,
    initial_members: Optional[List[dict]] = None,
) -> Group:
    """グループを作成し、作成者をadminとして登録する。デフォルトのポリシーも同時に作成する。

    policy_data が指定された場合はデフォルト値を上書きする。
    initial_members が指定された場合は作成者以外のメンバーを同一トランザクションで登録する。
    """

    group = Group(
        organization_id=org_id,
        name=name,
        is_private=is_private,
        created_by_user_id=user_id,
    )
    db.session.add(group)
    db.session.flush()  # group.id を確定させる

    # 作成者をadminとして登録
    admin_role = get_role_local("admin")
    member = GroupMember(
        user_id=user_id,
        group_id=group.id,
        role_id=admin_role.id,
    )
    db.session.add(member)

    # デフォルトポリシーを作成（組織のdefault_join_methodを引き継ぎ、指定値で上書きする）
    policy = GroupPolicy(
        group_id=group.id,
        join_method=default_join_method,
    )
    if policy_data:
        for key, value in policy_data.items():
            setattr(policy, key, value)
    db.session.add(policy)

    # 初期メンバーを登録する（作成者は admin として既に登録済みのためスキップ）
    if initial_members:
        for m in initial_members:
            if m["user_id"] == user_id:
                continue
            role_obj = get_role_local(m.get("role", "editor"))
            db.session.add(GroupMember(
                user_id=m["user_id"],
                group_id=group.id,
                role_id=role_obj.id,
            ))

    db.session.commit()
    return group


def get_accessible_groups(org_id: int, user_id: int) -> List[Group]:
    """ユーザーがアクセス可能なグループ一覧を返す（公開グループ + 所属プライベートグループ）。"""

    # ユーザーが所属するグループのIDを取得
    memberships = db.session.execute(
        db.select(GroupMember).filter_by(user_id=user_id)
    ).scalars().all()
    member_group_ids = {m.group_id for m in memberships}

    groups = db.session.execute(
        db.select(Group)
        .filter_by(organization_id=org_id)
        .order_by(Group.name)
    ).scalars().all()

    # 公開グループ または 所属グループのみを返す
    accessible = [
        g for g in groups
        if not g.is_private or g.id in member_group_ids
    ]
    return accessible


def get_group_or_404(group_id: int, org_id: int) -> Group:
    """グループを取得する。存在しない・組織外の場合は404を返す。"""

    return db.one_or_404(
        db.select(Group).filter_by(id=group_id, organization_id=org_id)
    )


def check_group_membership(user_id: int, group_id: int) -> Optional[GroupMember]:
    """ユーザーのグループメンバーシップを返す。所属していなければNoneを返す。"""

    return db.session.execute(
        db.select(GroupMember).filter_by(user_id=user_id, group_id=group_id)
    ).scalar_one_or_none()


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


def add_group_member(group_id: int, user_id: int, role: str = "editor") -> GroupMember:
    """グループにメンバーを追加する。すでに所属している場合はValueErrorを送出する。"""

    existing = check_group_membership(user_id, group_id)
    if existing:
        raise ValueError("ユーザーはすでにこのグループのメンバーです")

    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("ユーザーが見つかりません")

    role_obj = get_role_local(role)
    member = GroupMember(
        user_id=user_id,
        group_id=group_id,
        role_id=role_obj.id,
    )
    db.session.add(member)
    db.session.commit()
    return member


def update_group_member_role(member: GroupMember, role: str) -> GroupMember:
    """グループメンバーのロールを変更する。"""

    role_obj = get_role_local(role)
    member.role_id = role_obj.id
    db.session.commit()
    return member


def remove_group_member(member: GroupMember) -> None:
    """グループメンバーを削除する。"""

    db.session.delete(member)
    db.session.commit()


def update_group(group: Group, data: dict) -> Group:
    """グループ情報（名前・公開設定）を更新する。"""

    if "name" in data:
        group.name = data["name"]
    if "is_private" in data:
        group.is_private = data["is_private"]
    db.session.commit()
    return group


def update_group_policy(policy: GroupPolicy, data: dict) -> GroupPolicy:
    """グループポリシーを更新する。"""

    if "allow_private_notes" in data:
        policy.allow_private_notes = data["allow_private_notes"]
    if "join_method" in data:
        policy.join_method = data["join_method"]
    if "is_notes_visible_to_org" in data:
        policy.is_notes_visible_to_org = data["is_notes_visible_to_org"]
    db.session.commit()
    return policy


def delete_group(group: Group) -> None:
    """グループを削除する（メンバー・ポリシーはcascadeで削除）。"""

    db.session.delete(group)
    db.session.commit()


def build_group_member_response(member: GroupMember) -> dict:
    """GroupMemberにユーザー情報を付加してdictとして返す。"""

    return {
        "user_id": member.user_id,
        "group_id": member.group_id,
        "role": member.role.name,
        "joined_at": member.joined_at,
        "username": member.user.username,
        "email": member.user.email,
    }


def build_group_response(group: Group, user_role: Optional[str]) -> dict:
    """Groupにユーザーのロールとポリシーを付加してdictとして返す。"""

    policy = group.policy
    policy_data = {
        "allow_private_notes": policy.allow_private_notes if policy else True,
        "join_method": policy.join_method if policy else "invite_only",
        "is_notes_visible_to_org": policy.is_notes_visible_to_org if policy else False,
    }

    return {
        "id": group.id,
        "organization_id": group.organization_id,
        "name": group.name,
        "is_private": group.is_private,
        "created_at": group.created_at,
        "created_by_user_id": group.created_by_user_id,
        "role": user_role,
        "policy": policy_data,
    }
