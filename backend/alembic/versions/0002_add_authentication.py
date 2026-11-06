"""add password hashes for authentication

Revision ID: 0002_add_authentication
Revises: 0001_create_initial_tables
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_add_authentication"
down_revision: Union[str, Sequence[str], None] = "0001_create_initial_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teachers", sa.Column("password_hash", sa.String(), nullable=False, server_default=""))
    op.add_column("students", sa.Column("password_hash", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("students", "password_hash")
    op.drop_column("teachers", "password_hash")
