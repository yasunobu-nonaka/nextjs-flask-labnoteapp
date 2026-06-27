from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

UTC = timezone.utc


def now_utc() -> datetime:
    return datetime.now(UTC)


class Notification(db.Model):
    """ユーザー向けのインアプリ通知モデル。
    プライベートノートへの招待など、ユーザーへの通知を格納する。
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 通知先ユーザー
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # 表示メッセージ
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    # クリック時の遷移先 URL（任意）
    link_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # 既読フラグ
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )

    user: Mapped["User"] = relationship(viewonly=True)  # type: ignore[name-defined]  # noqa: F821

    def __repr__(self) -> str:
        return f"<Notification {self.id} user={self.user_id} read={self.is_read}>"
