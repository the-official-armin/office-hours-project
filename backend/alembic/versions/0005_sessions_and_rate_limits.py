"""sessions that can be ended (log out, new password) and rate limits on sign-in

Revision ID: 0005_sessions_and_rate_limits
Revises: 0004_invite_only_accounts

Sign-in tokens made before this change have no session number and count as session 0, so nobody is signed out by it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_sessions_and_rate_limits"
down_revision: Union[str, Sequence[str], None] = "0004_invite_only_accounts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("teachers", "students"):
        op.add_column(table, sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "auth_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bucket", sa.String(length=200), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_attempts_bucket_at", "auth_attempts", ["bucket", "at"])


def downgrade() -> None:
    op.drop_index("ix_auth_attempts_bucket_at", table_name="auth_attempts")
    op.drop_table("auth_attempts")
    for table in ("students", "teachers"):
        op.drop_column(table, "session_version")
