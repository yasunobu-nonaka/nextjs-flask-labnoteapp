from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

UTC = timezone.utc


def now_utc():
    return datetime.now(UTC)


# グループレベルのロール定数
GROUP_ROLES = ["admin", "editor", "viewer"]


class Group(db.Model):
    """グループモデル。組織内のより小さなノート共有単位。"""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # プライベートグループかどうか（デフォルト: 公開）
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    # グループを作成したユーザー
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # リレーション
    # 所属する組織：多対1
    organization: Mapped["Organization"] = relationship(back_populates="groups")
    # グループメンバー：1対多
    members: Mapped[List["GroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    # グループポリシー：1対1
    policy: Mapped[Optional["GroupPolicy"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", uselist=False
    )
    # 作成者（viewonly — User側にback_populatesなし）
    creator: Mapped["User"] = relationship(foreign_keys=[created_by_user_id], viewonly=True)

    def __repr__(self):
        return f"<Group {self.id} name={self.name} org={self.organization_id}>"


class GroupMember(db.Model):
    """グループとユーザーの中間テーブル。グループ内のロール（役割）を持つ。"""

    __tablename__ = "group_members"

    # 複合主キー
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), primary_key=True)
    # 'admin' | 'editor' | 'viewer'
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="editor")
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )

    # リレーション
    user: Mapped["User"] = relationship(back_populates="group_memberships")
    group: Mapped["Group"] = relationship(back_populates="members")

    def __repr__(self):
        return f"<GroupMember user={self.user_id} group={self.group_id} role={self.role}>"


class GroupPolicy(db.Model):
    """グループポリシー。グループごとの設定を管理する。"""

    __tablename__ = "group_policies"
    __table_args__ = (
        UniqueConstraint("group_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    # プライベートノートの作成可否（デフォルト: 可）
    allow_private_notes: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # グループの参加方式: 'invite_only' | 'request' | 'open'
    join_method: Mapped[str] = mapped_column(
        String(50), default="invite_only", nullable=False
    )
    # グループ外の組織メンバーがノートを閲覧できるか（デフォルト: 不可）
    is_notes_visible_to_org: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # リレーション
    group: Mapped["Group"] = relationship(back_populates="policy")

    def __repr__(self):
        return f"<GroupPolicy group={self.group_id}>"
