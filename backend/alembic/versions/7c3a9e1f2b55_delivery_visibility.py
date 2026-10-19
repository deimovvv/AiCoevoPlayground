"""entregas internas / mandadas al cliente, y comentarios internos (studio-v2 §11)

Revision ID: 7c3a9e1f2b55
Revises: 5b1e7c2d9a40
Create Date: 2026-10-19 20:00:00

Las entregas que ya existen quedan como `interna` (nadie se las mandó a un cliente) y sus
comentarios como internos (los hizo el equipo).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '7c3a9e1f2b55'
down_revision: Union[str, Sequence[str], None] = '5b1e7c2d9a40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('deliveries', sa.Column('visibility', sa.String(length=10), server_default='interna', nullable=False))
    op.add_column('deliveries', sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('delivery_comments', sa.Column('internal', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    op.drop_column('delivery_comments', 'internal')
    op.drop_column('deliveries', 'sent_at')
    op.drop_column('deliveries', 'visibility')
