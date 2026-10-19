"""usuarios y marcas por cliente (studio-v2 §3)

Revision ID: 9d2e4b7a1c08
Revises: 7c3a9e1f2b55
Create Date: 2026-10-19 22:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '9d2e4b7a1c08'
down_revision: Union[str, Sequence[str], None] = '7c3a9e1f2b55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('email', sa.String(length=200), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=True),
    sa.Column('role', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('disabled_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('memberships',
    sa.Column('user_id', sa.String(length=40), nullable=False),
    sa.Column('brand_id', sa.String(length=80), nullable=False),
    sa.Column('can_approve', sa.Boolean(), server_default='true', nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'brand_id')
    )


def downgrade() -> None:
    op.drop_table('memberships')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
