"""bandeja de material del cliente (studio-v2 §12/§15)

Revision ID: b4f1c8d2e6a3
Revises: 9d2e4b7a1c08
Create Date: 2026-10-20 00:30:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b4f1c8d2e6a3'
down_revision: Union[str, Sequence[str], None] = '9d2e4b7a1c08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('inbox_items',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('brand_id', sa.String(length=80), nullable=False),
    sa.Column('campaign_id', sa.String(length=40), nullable=True),
    sa.Column('files', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('link', sa.String(length=1000), nullable=True),
    sa.Column('note', sa.String(length=4000), nullable=True),
    sa.Column('author', sa.String(length=200), nullable=True),
    sa.Column('status', sa.String(length=12), server_default='nuevo', nullable=False),
    sa.Column('result', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inbox_items_brand_id'), 'inbox_items', ['brand_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_inbox_items_brand_id'), table_name='inbox_items')
    op.drop_table('inbox_items')
