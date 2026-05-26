"""add automations table

Revision ID: d91f4c8e2b0a
Revises: 4310c5e1c520
Create Date: 2026-05-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd91f4c8e2b0a'
down_revision: Union[str, None] = '4310c5e1c520'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'automations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('login_url', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('password', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('logo', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_automations_id'), 'automations', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_automations_id'), table_name='automations')
    op.drop_table('automations')
