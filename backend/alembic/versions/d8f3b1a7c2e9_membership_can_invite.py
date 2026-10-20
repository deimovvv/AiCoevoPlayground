"""accesos: el contacto principal de una marca suma a su equipo (studio-v2 1.6)

Revision ID: d8f3b1a7c2e9
Revises: c7e2a9f4b1d6
Create Date: 2026-10-20 18:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd8f3b1a7c2e9'
down_revision: Union[str, Sequence[str], None] = 'c7e2a9f4b1d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('memberships', sa.Column('can_invite', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('memberships', 'can_invite')
