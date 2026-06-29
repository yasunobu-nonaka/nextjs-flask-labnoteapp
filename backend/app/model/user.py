from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List

from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db

jst = timezone(timedelta(hours=9))


UTC = timezone.utc
JST = timezone(timedelta(hours=9))


def now_utc():
    return datetime.now(UTC)


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pending_email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc  # UTCで保存
    )

    # リレーション
    # Phase 3: notes/tags/folders は Group 所有に移行したため削除
    # 組織・グループのメンバーシップ
    organization_memberships: Mapped[List["OrganizationMember"]] = relationship(back_populates="user")
    group_memberships: Mapped[List["GroupMember"]] = relationship(back_populates="user")

    def __repr__(self):
        return f"<User {self.username}>"

    def set_password(self, password):
        # パスワードをハッシュ化
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        # パスワードをハッシュ化して比較
        return check_password_hash(self.password_hash, password)

    @property
    def created_at_jst(self):
        """表示用にJSTに変換"""
        if self.created_at and self.created_at.tzinfo:
            return self.created_at.astimezone(JST)
        return self.created_at
