from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List

from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db

jst = timezone(timedelta(hours=9))


def now_jst():
    return datetime.now(jst)


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # リレーション
    notes: Mapped[List["Note"]] = relationship(back_populates="user")
    tags: Mapped[List["Tag"]] = relationship(back_populates="user")

    def __repr__(self):
        return f"<User {self.username}>"

    def set_password(self, password):
        # パスワードをハッシュ化
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        # パスワードをハッシュ化して比較
        return check_password_hash(self.password_hash, password)
