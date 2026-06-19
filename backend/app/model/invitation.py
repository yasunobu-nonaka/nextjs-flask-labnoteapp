from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

UTC = timezone.utc

# 招待トークンのデフォルト有効期間（日数）
INVITATION_EXPIRY_DAYS = 7


def now_utc() -> datetime:
    return datetime.now(UTC)


def default_expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(days=INVITATION_EXPIRY_DAYS)


def generate_token() -> str:
    return str(uuid.uuid4())


class Invitation(db.Model):
    """組織への招待モデル。
    管理者がメールアドレス宛に招待を送り、受信者がトークンで承認する。
    """

    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    # URLに埋め込む一意なトークン（UUID）
    token: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, default=generate_token
    )
    # 招待先のメールアドレス
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    # 招待先の組織
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    # 招待を送ったユーザー
    invited_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # 承認後に付与するロール（RoleGlobal の id）
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles_global.id"), nullable=False
    )
    # 招待の状態: pending（未承認）/ accepted（承認済み）/ expired（期限切れ）
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=default_expires_at
    )

    # リレーション
    organization: Mapped["Organization"] = relationship(viewonly=True)  # type: ignore[name-defined]  # noqa: F821
    invited_by: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        foreign_keys=[invited_by_user_id], viewonly=True
    )
    role: Mapped["RoleGlobal"] = relationship(viewonly=True)  # type: ignore[name-defined]  # noqa: F821

    def is_valid(self) -> bool:
        """トークンが有効（pending かつ期限内）かどうかを返す。"""
        return self.status == "pending" and datetime.now(UTC) < self.expires_at

    def __repr__(self) -> str:
        return f"<Invitation {self.id} email={self.email} status={self.status}>"
