from typing import List, Optional

from flask import abort

from app.extensions import db
from app.model import User
from app.model.organization import Organization, OrganizationMember, OrganizationPolicy
from app.model.rbac import RoleGlobal


def get_role_global(name: str) -> RoleGlobal:
    """ロール名からRoleGlobalオブジェクトを取得する。存在しない場合はValueErrorを送出する。"""

    role = db.session.execute(
        db.select(RoleGlobal).filter_by(name=name)
    ).scalar_one_or_none()
    if not role:
        raise ValueError(f"組織ロール '{name}' が見つかりません")
    return role


def create_organization(name: str, user_id: int, policy_data: Optional[dict] = None) -> Organization:
    """組織を作成し、作成者をownerとして登録する。デフォルトのポリシーも同時に作成する。

    policy_data が指定された場合はデフォルト値を上書きする。同一トランザクションで確定する。
    """

    org = Organization(name=name, created_by_user_id=user_id)
    db.session.add(org)
    db.session.flush()  # org.id を確定させる

    # 作成者をownerとして登録
    owner_role = get_role_global("owner")
    member = OrganizationMember(
        user_id=user_id,
        organization_id=org.id,
        role_id=owner_role.id,
    )
    db.session.add(member)

    # デフォルトポリシーを作成し、指定値で上書きする
    policy = OrganizationPolicy(organization_id=org.id)
    if policy_data:
        for key, value in policy_data.items():
            setattr(policy, key, value)
    db.session.add(policy)

    db.session.commit()
    return org


def get_organizations_for_user(user_id: int) -> List[Organization]:
    """ログインユーザーが所属する組織一覧を返す。"""

    memberships = db.session.execute(
        db.select(OrganizationMember).filter_by(user_id=user_id)
    ).scalars().all()

    org_ids = [m.organization_id for m in memberships]

    if not org_ids:
        return []

    orgs = db.session.execute(
        db.select(Organization).filter(Organization.id.in_(org_ids)).order_by(Organization.name)
    ).scalars().all()

    return orgs


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


def add_org_member(org_id: int, user_id: int, role: str = "member") -> OrganizationMember:
    """組織にメンバーを追加する。すでに所属している場合はValueErrorを送出する。"""

    existing = check_org_membership(user_id, org_id)
    if existing:
        raise ValueError("ユーザーはすでにこの組織のメンバーです")

    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("ユーザーが見つかりません")

    role_obj = get_role_global(role)
    member = OrganizationMember(
        user_id=user_id,
        organization_id=org_id,
        role_id=role_obj.id,
    )
    db.session.add(member)
    db.session.commit()
    return member


def update_org_member_role(member: OrganizationMember, role: str) -> OrganizationMember:
    """組織メンバーのロールを変更する。ownerロールへの変更は不可。"""

    if role == "owner":
        raise ValueError("ownerロールは直接付与できません")
    role_obj = get_role_global(role)
    member.role_id = role_obj.id
    db.session.commit()
    return member


def remove_org_member(member: OrganizationMember) -> None:
    """組織メンバーを削除する。ownerは削除不可。"""

    if member.role.name == "owner":
        raise ValueError("組織のownerは削除できません")
    db.session.delete(member)
    db.session.commit()


def update_organization(org: Organization, data: dict) -> Organization:
    """組織名を更新する。"""

    if "name" in data:
        org.name = data["name"]
    db.session.commit()
    return org


def update_org_policy(policy: OrganizationPolicy, data: dict) -> OrganizationPolicy:
    """組織ポリシーを更新する。"""

    if "allow_private_groups" in data:
        policy.allow_private_groups = data["allow_private_groups"]
    if "allow_private_notes" in data:
        policy.allow_private_notes = data["allow_private_notes"]
    if "who_can_create_groups" in data:
        policy.who_can_create_groups = data["who_can_create_groups"]
    if "default_join_method" in data:
        policy.default_join_method = data["default_join_method"]
    db.session.commit()
    return policy


def build_member_response(member: OrganizationMember) -> dict:
    """OrganizationMemberにユーザー情報を付加してdictとして返す。"""

    return {
        "user_id": member.user_id,
        "organization_id": member.organization_id,
        "role": member.role.name,
        "joined_at": member.joined_at,
        "username": member.user.username,
        "email": member.user.email,
    }


def build_org_response(org: Organization, user_role: Optional[str]) -> dict:
    """Organizationにユーザーのロールとポリシーを付加してdictとして返す。"""

    policy = org.policy
    policy_data = {
        "allow_private_groups": policy.allow_private_groups if policy else True,
        "allow_private_notes": policy.allow_private_notes if policy else True,
        "who_can_create_groups": policy.who_can_create_groups if policy else "member",
        "default_join_method": policy.default_join_method if policy else "invite_only",
    }

    return {
        "id": org.id,
        "name": org.name,
        "created_at": org.created_at,
        "created_by_user_id": org.created_by_user_id,
        "role": user_role,
        "policy": policy_data,
    }
