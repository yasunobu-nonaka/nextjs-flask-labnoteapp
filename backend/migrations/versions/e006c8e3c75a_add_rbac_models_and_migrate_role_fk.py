"""add rbac models and migrate role fk

Revision ID: e006c8e3c75a
Revises: e411594eb49a
Create Date: 2026-06-15 04:48:33.529344

アップグレード手順:
  1. RBAC テーブル（permissions / roles_global / roles_local / 中間テーブル）を作成
  2. 定義済みロール・権限のシードデータを投入
  3. organization_members / group_members に role_id 列（nullable）を追加
  4. 既存の role 文字列から role_id を逆引きして埋める
  5. role_id を NOT NULL に変更し FK 制約を追加
  6. role 文字列列を削除

ダウングレード手順:
  role 文字列列を復元して role_id から逆引きして埋め、role_id を削除した後 RBAC テーブルを削除する。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = 'e006c8e3c75a'
down_revision = 'e411594eb49a'
branch_labels = None
depends_on = None

# --- シードデータ定義 ---

ORG_PERMISSIONS = [
    ("org:read",               "組織情報の閲覧"),
    ("org:edit",               "組織名・ポリシーの変更"),
    ("org:delete",             "組織の削除"),
    ("org:member_add",         "組織メンバーの追加"),
    ("org:member_remove",      "組織メンバーの削除"),
    ("org:member_role_assign", "組織メンバーのロール変更"),
    ("org:group_create",       "組織内グループの作成"),
    ("org:group_manage_any",   "任意グループの管理（組織管理者権限）"),
]

GROUP_PERMISSIONS = [
    ("group:read",               "グループ情報の閲覧"),
    ("group:edit",               "グループ名・ポリシーの変更"),
    ("group:delete",             "グループの削除"),
    ("group:member_add",         "グループメンバーの追加"),
    ("group:member_remove",      "グループメンバーの削除"),
    ("group:member_role_assign", "グループメンバーのロール変更"),
    ("note:create",              "ノートの作成"),
    ("note:read",                "ノートの閲覧"),
    ("note:edit",                "ノートの編集"),
    ("note:delete",              "ノートの削除"),
]

ORG_ROLE_DEFINITIONS = {
    "owner": {
        "description": "組織の作成者。全権を持つ。",
        "permissions": [
            "org:read", "org:edit", "org:delete",
            "org:member_add", "org:member_remove", "org:member_role_assign",
            "org:group_create", "org:group_manage_any",
        ],
    },
    "sys_admin": {
        "description": "組織のシステム管理者。メンバー管理・設定変更・グループ管理が可能。",
        "permissions": [
            "org:read", "org:edit",
            "org:member_add", "org:member_remove", "org:member_role_assign",
            "org:group_create", "org:group_manage_any",
        ],
    },
    "user_admin": {
        "description": "ユーザー管理者。メンバーの追加・削除が可能。",
        "permissions": [
            "org:read",
            "org:member_add", "org:member_remove",
            "org:group_create",
        ],
    },
    "member": {
        "description": "一般メンバー。組織情報の閲覧とグループの作成が可能（ポリシー依存）。",
        "permissions": [
            "org:read",
            "org:group_create",
        ],
    },
}

GROUP_ROLE_DEFINITIONS = {
    "admin": {
        "description": "グループ管理者。グループ設定・メンバー管理・ノート全操作が可能。",
        "permissions": [
            "group:read", "group:edit", "group:delete",
            "group:member_add", "group:member_remove", "group:member_role_assign",
            "note:create", "note:read", "note:edit", "note:delete",
        ],
    },
    "editor": {
        "description": "編集者。ノートの作成・編集・削除が可能。",
        "permissions": [
            "group:read",
            "note:create", "note:read", "note:edit", "note:delete",
        ],
    },
    "viewer": {
        "description": "閲覧者。ノートの閲覧のみ可能。",
        "permissions": [
            "group:read",
            "note:read",
        ],
    },
}


def _seed_rbac(conn):
    """マイグレーション内でシードデータを投入するヘルパー。"""

    # --- 権限の投入 ---
    all_perms = ORG_PERMISSIONS + GROUP_PERMISSIONS
    for code, description in all_perms:
        conn.execute(text(
            "INSERT INTO permissions (code, description) VALUES (:code, :desc) "
            "ON CONFLICT (code) DO NOTHING"
        ), {"code": code, "desc": description})

    # --- 組織ロールの投入 ---
    for role_name, defn in ORG_ROLE_DEFINITIONS.items():
        conn.execute(text(
            "INSERT INTO roles_global (name, description) VALUES (:name, :desc) "
            "ON CONFLICT (name) DO NOTHING"
        ), {"name": role_name, "desc": defn["description"]})

        # ロール-権限の中間テーブルへ投入
        role_row = conn.execute(
            text("SELECT id FROM roles_global WHERE name = :name"), {"name": role_name}
        ).fetchone()
        if role_row:
            for perm_code in defn["permissions"]:
                perm_row = conn.execute(
                    text("SELECT id FROM permissions WHERE code = :code"), {"code": perm_code}
                ).fetchone()
                if perm_row:
                    conn.execute(text(
                        "INSERT INTO role_global_permissions (role_global_id, permission_id) "
                        "VALUES (:rid, :pid) ON CONFLICT DO NOTHING"
                    ), {"rid": role_row[0], "pid": perm_row[0]})

    # --- グループロールの投入 ---
    for role_name, defn in GROUP_ROLE_DEFINITIONS.items():
        conn.execute(text(
            "INSERT INTO roles_local (name, description) VALUES (:name, :desc) "
            "ON CONFLICT (name) DO NOTHING"
        ), {"name": role_name, "desc": defn["description"]})

        role_row = conn.execute(
            text("SELECT id FROM roles_local WHERE name = :name"), {"name": role_name}
        ).fetchone()
        if role_row:
            for perm_code in defn["permissions"]:
                perm_row = conn.execute(
                    text("SELECT id FROM permissions WHERE code = :code"), {"code": perm_code}
                ).fetchone()
                if perm_row:
                    conn.execute(text(
                        "INSERT INTO role_local_permissions (role_local_id, permission_id) "
                        "VALUES (:rid, :pid) ON CONFLICT DO NOTHING"
                    ), {"rid": role_row[0], "pid": perm_row[0]})


def upgrade():
    # --- 1. RBAC テーブルの作成 ---
    op.create_table(
        'permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_table(
        'roles_global',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_table(
        'roles_local',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_table(
        'role_global_permissions',
        sa.Column('role_global_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id']),
        sa.ForeignKeyConstraint(['role_global_id'], ['roles_global.id']),
        sa.PrimaryKeyConstraint('role_global_id', 'permission_id'),
    )
    op.create_table(
        'role_local_permissions',
        sa.Column('role_local_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id']),
        sa.ForeignKeyConstraint(['role_local_id'], ['roles_local.id']),
        sa.PrimaryKeyConstraint('role_local_id', 'permission_id'),
    )

    # --- 2. シードデータの投入 ---
    conn = op.get_bind()
    _seed_rbac(conn)

    # --- 3. role_id 列を nullable で追加 ---
    op.add_column('organization_members', sa.Column('role_id', sa.Integer(), nullable=True))
    op.add_column('group_members', sa.Column('role_id', sa.Integer(), nullable=True))

    # --- 4. 既存の role 文字列から role_id を逆引きして埋める ---
    conn.execute(text("""
        UPDATE organization_members om
        SET role_id = (SELECT id FROM roles_global WHERE name = om.role)
    """))
    conn.execute(text("""
        UPDATE group_members gm
        SET role_id = (SELECT id FROM roles_local WHERE name = gm.role)
    """))

    # --- 5. role_id を NOT NULL にして FK 制約を追加 ---
    op.alter_column('organization_members', 'role_id', nullable=False)
    op.create_foreign_key(
        'fk_org_members_role_global',
        'organization_members', 'roles_global',
        ['role_id'], ['id'],
    )

    op.alter_column('group_members', 'role_id', nullable=False)
    op.create_foreign_key(
        'fk_group_members_role_local',
        'group_members', 'roles_local',
        ['role_id'], ['id'],
    )

    # --- 6. 旧 role 文字列列を削除 ---
    op.drop_column('organization_members', 'role')
    op.drop_column('group_members', 'role')


def downgrade():
    # --- 1. role 文字列列を nullable で復元 ---
    op.add_column('organization_members', sa.Column('role', sa.String(length=50), nullable=True))
    op.add_column('group_members', sa.Column('role', sa.String(length=50), nullable=True))

    # --- 2. role_id から role 文字列へ逆引き ---
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE organization_members om
        SET role = (SELECT name FROM roles_global WHERE id = om.role_id)
    """))
    conn.execute(text("""
        UPDATE group_members gm
        SET role = (SELECT name FROM roles_local WHERE id = gm.role_id)
    """))

    # --- 3. role を NOT NULL に変更 ---
    op.alter_column('organization_members', 'role', nullable=False)
    op.alter_column('group_members', 'role', nullable=False)

    # --- 4. FK 制約と role_id 列を削除 ---
    op.drop_constraint('fk_org_members_role_global', 'organization_members', type_='foreignkey')
    op.drop_column('organization_members', 'role_id')

    op.drop_constraint('fk_group_members_role_local', 'group_members', type_='foreignkey')
    op.drop_column('group_members', 'role_id')

    # --- 5. RBAC テーブルを削除 ---
    op.drop_table('role_local_permissions')
    op.drop_table('role_global_permissions')
    op.drop_table('roles_local')
    op.drop_table('roles_global')
    op.drop_table('permissions')
