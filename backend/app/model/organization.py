from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

UTC = timezone.utc


def now_utc():
    return datetime.now(UTC)


# 組織レベルのロール定数
ORG_ROLES = ["owner", "sys_admin", "user_admin", "member"]


class Organization(db.Model):
    """組織モデル。ノートを共有できる最大単位。"""

    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    # 組織を作成したユーザー
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # リレーション
    # 組織メンバー：1対多
    members: Mapped[List["OrganizationMember"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    # 組織ポリシー：1対1
    policy: Mapped[Optional["OrganizationPolicy"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan", uselist=False
    )
    # グループ：1対多
    groups: Mapped[List["Group"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    # 作成者（viewonly — User側にback_populatesなし）
    creator: Mapped["User"] = relationship(foreign_keys=[created_by_user_id], viewonly=True)

    def __repr__(self):
        return f"<Organization {self.id} name={self.name}>"


class OrganizationMember(db.Model):
    """組織とユーザーの中間テーブル。ロール（役割）を持つ。"""

    __tablename__ = "organization_members"

    # 複合主キー
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), primary_key=True
    )
    # 'owner' | 'sys_admin' | 'user_admin' | 'member'
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )

    # リレーション
    user: Mapped["User"] = relationship(back_populates="organization_memberships")
    organization: Mapped["Organization"] = relationship(back_populates="members")

    def __repr__(self):
        return f"<OrganizationMember user={self.user_id} org={self.organization_id} role={self.role}>"


class OrganizationPolicy(db.Model):
    """組織ポリシー。組織全体の設定を管理する。"""

    __tablename__ = "organization_policies"
    __table_args__ = (
        UniqueConstraint("organization_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    # プライベートグループの作成可否（デフォルト: 可）
    allow_private_groups: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # プライベートノートの作成可否（デフォルト: 可）
    allow_private_notes: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # グループを作成できるロール: 'sys_admin_only' | 'user_admin' | 'member' | 'all'
    who_can_create_groups: Mapped[str] = mapped_column(
        String(50), default="member", nullable=False
    )
    # デフォルトのグループ参加方式: 'invite_only' | 'request' | 'open'
    default_join_method: Mapped[str] = mapped_column(
        String(50), default="invite_only", nullable=False
    )

    # リレーション
    organization: Mapped["Organization"] = relationship(back_populates="policy")

    def __repr__(self):
        return f"<OrganizationPolicy org={self.organization_id}>"
