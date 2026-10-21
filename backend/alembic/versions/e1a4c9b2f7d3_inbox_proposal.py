"""material del cliente: lo que propone el agente (studio-v2 C.4)

Revision ID: e1a4c9b2f7d3
Revises: d8f3b1a7c2e9
Create Date: 2026-10-21 18:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e1a4c9b2f7d3'
down_revision: Union[str, Sequence[str], None] = 'd8f3b1a7c2e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inbox_items', sa.Column('proposal', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('inbox_items', 'proposal')
