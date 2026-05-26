"""add user referral fields

Revision ID: f2e8b9c1a4d3
Revises: d91f4c8e2b0a
Create Date: 2026-05-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import secrets
import string


revision: str = 'f2e8b9c1a4d3'
down_revision: Union[str, None] = 'd91f4c8e2b0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ALPHABET = string.ascii_uppercase + string.digits


def upgrade() -> None:
    op.add_column('users', sa.Column('referral_code', sa.String(), nullable=True))
    op.add_column('users', sa.Column('referred_by_user_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('referral_reward_until', sa.DateTime(), nullable=True))

    op.create_foreign_key(
        'fk_users_referred_by_user_id',
        'users',
        'users',
        ['referred_by_user_id'],
        ['id'],
    )
    op.create_index(op.f('ix_users_referral_code'), 'users', ['referral_code'], unique=True)

    bind = op.get_bind()
    rows = bind.execute(sa.text('SELECT id FROM users')).fetchall()
    used = set()
    for (uid,) in rows:
        for _ in range(100):
            code = ''.join(secrets.choice(_ALPHABET) for _ in range(8))
            if code not in used:
                used.add(code)
                break
        bind.execute(
            sa.text('UPDATE users SET referral_code = :code WHERE id = :id'),
            {'code': code, 'id': uid},
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_users_referral_code'), table_name='users')
    op.drop_constraint('fk_users_referred_by_user_id', 'users', type_='foreignkey')
    op.drop_column('users', 'referral_reward_until')
    op.drop_column('users', 'referred_by_user_id')
    op.drop_column('users', 'referral_code')
