"""entregas: versiones anteriores (studio-v2 4.4)

Revision ID: f2b7d4c8a9e1
Revises: e1a4c9b2f7d3
Create Date: 2026-10-23 18:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f2b7d4c8a9e1'
down_revision: Union[str, Sequence[str], None] = 'e1a4c9b2f7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('deliveries', sa.Column('history', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('deliveries', 'history')
