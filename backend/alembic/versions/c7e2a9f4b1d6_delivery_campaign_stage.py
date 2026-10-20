"""entregas: campaña y etapa opcionales (studio-v2 §16)

Revision ID: c7e2a9f4b1d6
Revises: b4f1c8d2e6a3
Create Date: 2026-10-20 10:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c7e2a9f4b1d6'
down_revision: Union[str, Sequence[str], None] = 'b4f1c8d2e6a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('deliveries', sa.Column('campaign_id', sa.String(length=40), nullable=True))
    op.add_column('deliveries', sa.Column('stage', sa.String(length=60), nullable=True))
    op.create_index(op.f('ix_deliveries_campaign_id'), 'deliveries', ['campaign_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_deliveries_campaign_id'), table_name='deliveries')
    op.drop_column('deliveries', 'stage')
    op.drop_column('deliveries', 'campaign_id')
