"""entregas: referencias adjuntas a un comentario (studio-v2 4.6)

Revision ID: a7c2e4f6b8d1
Revises: f2b7d4c8a9e1
Create Date: 2026-10-30 10:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a7c2e4f6b8d1'
down_revision: Union[str, Sequence[str], None] = 'f2b7d4c8a9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('delivery_comments', sa.Column('refs', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('delivery_comments', 'refs')
