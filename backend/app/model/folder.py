from __future__ import annotations

from typing import List, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Folder(db.Model):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Phase 3: user_id → group_id（グループ所有）+ created_by_user_id（作成者追跡）
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("folders.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # リレーション
    # グループ：多対1
    group: Mapped["Group"] = relationship(back_populates="folders")
    # 作成者（viewonly — User側にback_populatesなし）
    creator: Mapped["User"] = relationship(
        foreign_keys=[created_by_user_id], viewonly=True
    )
    parent: Mapped[Optional["Folder"]] = relationship(
        "Folder", back_populates="children", remote_side="Folder.id"
    )
    children: Mapped[List["Folder"]] = relationship(
        "Folder", back_populates="parent", cascade="all, delete-orphan"
    )
    notes: Mapped[List["Note"]] = relationship(
        back_populates="folder", cascade="all, delete"
    )

    def __repr__(self):
        return f"<Folder {self.id} name={self.name}>"
