"""deliveries — entregas a la marca y sus comentarios (studio-v2 P.3)

Revision ID: 5b1e7c2d9a40
Revises: 28e004089ec4
Create Date: 2026-10-18 22:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '5b1e7c2d9a40'
down_revision: Union[str, Sequence[str], None] = '28e004089ec4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('deliveries',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('brand_id', sa.String(length=80), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('items', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('source', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('note', sa.String(length=2000), nullable=True),
    sa.Column('template', sa.String(length=120), nullable=True),
    sa.Column('round', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.String(length=200), nullable=True),
    sa.Column('approved_by', sa.String(length=200), nullable=True),
    sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deliveries_brand_id'), 'deliveries', ['brand_id'], unique=False)
    op.create_table('delivery_comments',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('delivery_id', sa.String(length=40), nullable=False),
    sa.Column('item_id', sa.String(length=40), nullable=True),
    sa.Column('x', sa.Float(), nullable=True),
    sa.Column('y', sa.Float(), nullable=True),
    sa.Column('text', sa.String(length=4000), nullable=False),
    sa.Column('author', sa.String(length=200), nullable=True),
    sa.Column('round', sa.Integer(), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['delivery_id'], ['deliveries.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_delivery_comments_delivery_id'), 'delivery_comments', ['delivery_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_delivery_comments_delivery_id'), table_name='delivery_comments')
    op.drop_table('delivery_comments')
    op.drop_index(op.f('ix_deliveries_brand_id'), table_name='deliveries')
    op.drop_table('deliveries')
