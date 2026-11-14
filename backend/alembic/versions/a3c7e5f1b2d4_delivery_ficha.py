"""entregas: ficha de la pieza y cómo le fue

Revision ID: a3c7e5f1b2d4
Revises: fc9151cbb5ac
Create Date: 2026-11-14 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a3c7e5f1b2d4'
down_revision: Union[str, Sequence[str], None] = 'fc9151cbb5ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('deliveries', sa.Column('ficha', sa.Text(), nullable=True))
    op.add_column('deliveries', sa.Column('results', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('deliveries', 'results')
    op.drop_column('deliveries', 'ficha')
