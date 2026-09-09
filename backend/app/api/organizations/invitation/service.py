from datetime import datetime, timezone

from flask import current_app, render_template
from flask_mail import Message

from app.extensions import db, mail
from app.model import User
from app.model.invitation import Invitation
from app.model.organization import Organization, OrganizationMember
from app.model.rbac import RoleGlobal

UTC = timezone.utc


def get_role_global_by_name(name: str) -> RoleGlobal:
    """ロール名から RoleGlobal を取得する。見つからなければ ValueError を送出する。"""

    role = db.session.execute(
        db.select(RoleGlobal).filter_by(name=name)
    ).scalar_one_or_none()
    if not role:
        raise ValueError(f"ロール '{name}' が見つかりません")
    return role


def create_invitation(
    org: Organization, email: str, role_name: str, invited_by_user_id: int
) -> Invitation:
    """招待レコードを作成し、招待メールを送信する。

    同じメールアドレスへの未承認招待が既に存在する場合は、既存レコードを再利用して
    再送する（ユーザーが再送を意図してフォームを再送信した場合に対応するため）。
    """

    # 同一メール宛の pending 招待が既にあれば再利用し、メールを再送する
    existing = db.session.execute(
        db.select(Invitation).filter_by(
            organization_id=org.id,
            email=email,
            status="pending",
        )
    ).scalar_one_or_none()
    if existing and existing.is_valid():
        _send_invitation_email(existing, org)
        return existing

    role = get_role_global_by_name(role_name)
    invitation = Invitation(
        email=email,
        organization_id=org.id,
        invited_by_user_id=invited_by_user_id,
        role_id=role.id,
    )
    db.session.add(invitation)
    db.session.commit()

    _send_invitation_email(invitation, org)
    return invitation


def _send_invitation_email(invitation: Invitation, org: Organization) -> None:
    """招待メールを送信する。"""

    frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    accept_url = f"{frontend_url}/invitations/{invitation.token}"

    html_body = render_template(
        "email/invitation.html",
        org_name=org.name,
        accept_url=accept_url,
    )
    msg = Message(
        subject=f"【LabNote】{org.name} への招待",
        sender="noreply@example.com",
        recipients=[invitation.email],
        html=html_body,
        body=(
            f"{org.name} への参加招待が届いています。\n\n"
            f"以下のリンクをクリックして招待を承認してください。\n"
            f"{accept_url}\n\n"
            f"このリンクは7日間有効です。\n"
            f"身に覚えのない場合は無視してください。"
        ),
    )
    mail.send(msg)


def get_invitation_by_token(token: str) -> Invitation | None:
    """トークンで招待を取得する。"""

    return db.session.execute(
        db.select(Invitation).filter_by(token=token)
    ).scalar_one_or_none()


def accept_invitation(invitation: Invitation, user: User) -> OrganizationMember:
    """招待を承認してユーザーを組織メンバーに追加する。

    既にメンバーの場合は追加せずそのまま返す。
    """

    # 既存メンバーチェック
    existing_member = db.session.execute(
        db.select(OrganizationMember).filter_by(
            user_id=user.id,
            organization_id=invitation.organization_id,
        )
    ).scalar_one_or_none()
    if existing_member:
        invitation.status = "accepted"
        db.session.commit()
        return existing_member

    member = OrganizationMember(
        user_id=user.id,
        organization_id=invitation.organization_id,
        role_id=invitation.role_id,
    )
    db.session.add(member)
    invitation.status = "accepted"
    db.session.commit()
    return member


def build_invitation_response(invitation: Invitation) -> dict:
    """招待情報をレスポンス用 dict に変換する。"""

    return {
        "id": invitation.id,
        "token": invitation.token,
        "email": invitation.email,
        "organization_id": invitation.organization_id,
        "organization_name": invitation.organization.name,
        "invited_by_username": invitation.invited_by.username,
        "role": invitation.role.name,
        "status": invitation.status,
        "created_at": invitation.created_at.isoformat(),
        "expires_at": invitation.expires_at.isoformat(),
    }
