from __future__ import annotations

from sqlalchemy import String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional

from datetime import datetime, timedelta, timezone

from app.extensions import db, Base

jst = timezone(timedelta(hours=9))


def now_jst():
    return datetime.now(jst)


# ノートとタグの関係（Many To Many）
notes_tags = Table(
    "notes_tags",
    Base.metadata,
    db.Column("note_id", ForeignKey("notes.id"), primary_key=True),
    db.Column("tag_id", ForeignKey("tags.id"), primary_key=True),
)


class Note(db.Model):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Phase 3: user_id → group_id（グループ所有）+ created_by_user_id（作成者追跡）
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    # is_private=True のノートは作成者と PrivateNoteMember に登録されたユーザーのみに公開される
    is_private: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_jst, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_jst, onupdate=now_jst, index=True
    )

    # リレーション
    # グループ：多対1
    group: Mapped["Group"] = relationship(back_populates="notes")
    # 作成者（viewonly — User側にback_populatesなし）
    creator: Mapped["User"] = relationship(
        foreign_keys=[created_by_user_id], viewonly=True
    )

    # フォルダー：多対1
    folder_id: Mapped[Optional[int]] = mapped_column(ForeignKey("folders.id"), nullable=True)
    folder: Mapped[Optional["Folder"]] = relationship(back_populates="notes")

    # タグ：多対多
    tags: Mapped[List[Tag]] = relationship(secondary=notes_tags, back_populates="notes")

    # プライベートノート共有メンバー（is_private=True のときのみ使用）
    private_members: Mapped[List["PrivateNoteMember"]] = relationship(
        cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self):
        return f"<Note {self.id} group={self.group_id}>"


class PrivateNoteMember(db.Model):
    """プライベートノートの共有メンバーテーブル。
    作成者は role="owner" として登録される。
    招待されたメンバーは role="editor" または "viewer" として登録される。
    """
    __tablename__ = "private_note_members"

    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    # "owner" | "editor" | "viewer"
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    invited_at: Mapped[datetime] = mapped_column(DateTime, default=now_jst)

    # メンバーユーザー（username 参照のため joined ロード）
    user: Mapped["User"] = relationship(lazy="joined")


class Tag(db.Model):
    __tablename__ = "tags"
    __table_args__ = (
        # 重複タグを防止（同一グループ内）
        db.UniqueConstraint("group_id", "tagname"),
        db.Index("ix_tag_group", "group_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Phase 3: user_id → group_id（グループ共有ラベル）
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    tagname: Mapped[str] = mapped_column(String(20), nullable=False)

    # リレーション
    # グループ：多対1
    group: Mapped["Group"] = relationship(back_populates="tags")
    # ノート：多対多
    notes: Mapped[List[Note]] = relationship(
        secondary=notes_tags, back_populates="tags"
    )
