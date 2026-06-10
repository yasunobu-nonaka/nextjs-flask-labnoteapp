from __future__ import annotations

from typing import List, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Folder(db.Model):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("folders.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    user: Mapped["User"] = relationship(back_populates="folders")
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
