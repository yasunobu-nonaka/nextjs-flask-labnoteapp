"""
RBACモデル。Permission（権限）・RoleGlobal（組織レベルロール）・RoleLocal（グループレベルロール）を定義する。

Permission はシステム内のアトミックな操作権限を表す。
RoleGlobal は組織レベルのロール（owner / sys_admin / user_admin / member）。
RoleLocal はグループレベルのロール（admin / editor / viewer）。
各ロールは複数の Permission を束ねたテンプレートとして機能する。
"""

from __future__ import annotations

from typing import List

from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

# --- 中間テーブル ---

# 組織ロールと権限の中間テーブル（多対多）
role_global_permissions = Table(
    "role_global_permissions",
    db.metadata,
    Column("role_global_id", Integer, ForeignKey("roles_global.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)

# グループロールと権限の中間テーブル（多対多）
role_local_permissions = Table(
    "role_local_permissions",
    db.metadata,
    Column("role_local_id", Integer, ForeignKey("roles_local.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Permission(db.Model):
    """権限モデル。システム内のアトミックな操作権限を表す。

    例: 'org:edit'（組織設定の変更）、'note:create'（ノートの作成）
    code は一意かつ変更不可の識別子として使用する。
    """

    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 例: 'org:read' / 'org:edit' / 'group:create' / 'note:read'
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)

    def __repr__(self):
        return f"<Permission {self.code}>"


class RoleGlobal(db.Model):
    """組織レベルのロール定義。

    組織内でのユーザーの役割と権限を束ねたテンプレート。
    OrganizationMember.role_id でこのモデルを参照する。
    定義済みロール: owner / sys_admin / user_admin / member
    """

    __tablename__ = "roles_global"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 例: 'owner', 'sys_admin', 'user_admin', 'member'
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)

    # このロールが持つ権限一覧（多対多）
    # selectin ローディングでアクセス時に一括取得
    permissions: Mapped[List["Permission"]] = relationship(
        secondary=role_global_permissions, lazy="selectin"
    )

    def __repr__(self):
        return f"<RoleGlobal {self.name}>"

    def has_permission(self, code: str) -> bool:
        """指定パーミッションコードを持つか確認する。"""
        return any(p.code == code for p in self.permissions)


class RoleLocal(db.Model):
    """グループレベルのロール定義。

    グループ内でのユーザーの役割と権限を束ねたテンプレート。
    GroupMember.role_id でこのモデルを参照する。
    定義済みロール: admin / editor / viewer
    """

    __tablename__ = "roles_local"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 例: 'admin', 'editor', 'viewer'
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)

    # このロールが持つ権限一覧（多対多）
    permissions: Mapped[List["Permission"]] = relationship(
        secondary=role_local_permissions, lazy="selectin"
    )

    def __repr__(self):
        return f"<RoleLocal {self.name}>"

    def has_permission(self, code: str) -> bool:
        """指定パーミッションコードを持つか確認する。"""
        return any(p.code == code for p in self.permissions)
