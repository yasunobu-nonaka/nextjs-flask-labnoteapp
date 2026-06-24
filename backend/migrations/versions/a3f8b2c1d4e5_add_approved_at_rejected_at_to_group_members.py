"""Add approved_at and rejected_at to group_members

Revision ID: a3f8b2c1d4e5
Revises: 365d430d9498
Create Date: 2026-06-25

"""
from alembic import op
import sqlalchemy as sa


revision = 'a3f8b2c1d4e5'
down_revision = '365d430d9498'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('group_members', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('group_members', sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('group_members', 'rejected_at')
    op.drop_column('group_members', 'approved_at')
