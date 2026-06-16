"""migrate note tag folder to group scope

Revision ID: a1b2c3d4e5f6
Revises: e006c8e3c75a
Create Date: 2026-06-16 00:00:00.000000

アップグレード手順:
  1. notes / folders に group_id (nullable), created_by_user_id (nullable) を追加
  2. tags に group_id (nullable) を追加
  3. notes.created_by_user_id ← notes.user_id をコピー
  4. folders.created_by_user_id ← folders.user_id をコピー
  5. group_id を決定できない既存行を全削除
  6. group_id / created_by_user_id を NOT NULL に変更し FK 制約を追加
  7. 旧 user_id 列を削除
  8. tags の unique 制約・インデックスを (user_id, tagname) → (group_id, tagname) に更新

ダウングレード手順:
  逆順で user_id を復元し、group_id 列と FK 制約を削除する。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


revision = 'a1b2c3d4e5f6'
down_revision = 'e006c8e3c75a'
branch_labels = None
depends_on = None


def upgrade():
    # --- 1. notes に新列を追加（nullable で追加後に NOT NULL へ変更） ---
    op.add_column('notes', sa.Column('group_id', sa.Integer(), nullable=True))
    op.add_column('notes', sa.Column('created_by_user_id', sa.Integer(), nullable=True))

    # --- 2. folders に新列を追加 ---
    op.add_column('folders', sa.Column('group_id', sa.Integer(), nullable=True))
    op.add_column('folders', sa.Column('created_by_user_id', sa.Integer(), nullable=True))

    # --- 3. tags に group_id を追加 ---
    op.add_column('tags', sa.Column('group_id', sa.Integer(), nullable=True))

    conn = op.get_bind()

    # --- 4. notes.created_by_user_id に既存の user_id をコピー ---
    conn.execute(text("UPDATE notes SET created_by_user_id = user_id"))

    # --- 5. folders.created_by_user_id に既存の user_id をコピー ---
    conn.execute(text("UPDATE folders SET created_by_user_id = user_id"))

    # --- 6. group_id を決定できない既存行を削除（FK制約順に削除） ---
    # notes_tags は notes と tags の両方を参照しているため先に削除する
    conn.execute(text("DELETE FROM notes_tags"))
    conn.execute(text("DELETE FROM notes"))
    conn.execute(text("DELETE FROM folders"))
    conn.execute(text("DELETE FROM tags"))

    # --- 7. notes: group_id / created_by_user_id を NOT NULL に変更・FK 追加 ---
    op.alter_column('notes', 'group_id', nullable=False)
    op.alter_column('notes', 'created_by_user_id', nullable=False)
    op.create_foreign_key(
        'fk_notes_group_id', 'notes', 'groups', ['group_id'], ['id']
    )
    op.create_foreign_key(
        'fk_notes_created_by_user_id', 'notes', 'users', ['created_by_user_id'], ['id']
    )
    op.drop_column('notes', 'user_id')

    # --- 8. folders: group_id / created_by_user_id を NOT NULL に変更・FK 追加 ---
    op.alter_column('folders', 'group_id', nullable=False)
    op.alter_column('folders', 'created_by_user_id', nullable=False)
    op.create_foreign_key(
        'fk_folders_group_id', 'folders', 'groups', ['group_id'], ['id']
    )
    op.create_foreign_key(
        'fk_folders_created_by_user_id', 'folders', 'users', ['created_by_user_id'], ['id']
    )
    op.drop_column('folders', 'user_id')

    # --- 9. tags: unique 制約・インデックスを更新し group_id を NOT NULL に ---
    op.drop_constraint('tags_user_id_tagname_key', 'tags', type_='unique')
    op.drop_index('ix_tag_user', 'tags')
    op.alter_column('tags', 'group_id', nullable=False)
    op.create_unique_constraint('tags_group_id_tagname_key', 'tags', ['group_id', 'tagname'])
    op.create_index('ix_tag_group', 'tags', ['group_id'])
    op.create_foreign_key(
        'fk_tags_group_id', 'tags', 'groups', ['group_id'], ['id']
    )
    op.drop_column('tags', 'user_id')


def downgrade():
    # --- notes ---
    op.add_column('notes', sa.Column('user_id', sa.Integer(), nullable=True))
    conn = op.get_bind()
    conn.execute(text("UPDATE notes SET user_id = created_by_user_id"))
    op.alter_column('notes', 'user_id', nullable=False)
    op.drop_constraint('fk_notes_group_id', 'notes', type_='foreignkey')
    op.drop_constraint('fk_notes_created_by_user_id', 'notes', type_='foreignkey')
    op.drop_column('notes', 'group_id')
    op.drop_column('notes', 'created_by_user_id')

    # --- folders ---
    op.add_column('folders', sa.Column('user_id', sa.Integer(), nullable=True))
    conn.execute(text("UPDATE folders SET user_id = created_by_user_id"))
    op.alter_column('folders', 'user_id', nullable=False)
    op.drop_constraint('fk_folders_group_id', 'folders', type_='foreignkey')
    op.drop_constraint('fk_folders_created_by_user_id', 'folders', type_='foreignkey')
    op.drop_column('folders', 'group_id')
    op.drop_column('folders', 'created_by_user_id')

    # --- tags ---
    op.add_column('tags', sa.Column('user_id', sa.Integer(), nullable=True))
    conn.execute(text("UPDATE tags SET user_id = group_id"))  # 近似的な逆変換
    op.alter_column('tags', 'user_id', nullable=False)
    op.drop_constraint('fk_tags_group_id', 'tags', type_='foreignkey')
    op.drop_constraint('tags_group_id_tagname_key', 'tags', type_='unique')
    op.drop_index('ix_tag_group', 'tags')
    op.drop_column('tags', 'group_id')
    op.create_unique_constraint('tags_user_id_tagname_key', 'tags', ['user_id', 'tagname'])
    op.create_index('ix_tag_user', 'tags', ['user_id'])
