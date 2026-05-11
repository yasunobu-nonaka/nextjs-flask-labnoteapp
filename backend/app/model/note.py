from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timedelta, timezone
from app.extensions import db

jst = timezone(timedelta(hours=9))


def now_jst():
    return datetime.now(jst)


class Note(db.Model):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    # user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_jst, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_jst, onupdate=now_jst, index=True
    )

    def __repr__(self):
        return f"<Note {self.id} user={self.user_id}>"
