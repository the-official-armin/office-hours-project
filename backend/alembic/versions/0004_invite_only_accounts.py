"""invite-only accounts: sign in by email, account status, one-time activation and reset links

Revision ID: 0004_invite_only_accounts
Revises: 0003_one_booking_per_student

Existing accounts stay active. Their emails are lowercased, and empty ones (the demo seed had none) become
"<id>@example.com" so every account has a unique sign-in email. The upgrade stops if two accounts share an email.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_invite_only_accounts"
down_revision: Union[str, Sequence[str], None] = "0003_one_booking_per_student"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("teachers", "students"):
        op.execute("UPDATE %s SET email = lower(trim(email))" % table)
        op.execute("UPDATE %s SET email = id || '@example.com' WHERE email = ''" % table)
        op.add_column(table, sa.Column("status", sa.String(length=20), nullable=False, server_default="active"))
        op.create_index(op.f("ix_%s_email" % table), table, ["email"], unique=True)

    op.create_table(
        "account_links",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_account_links_person", "account_links", ["role", "user_id"])


def downgrade() -> None:
    op.drop_index("ix_account_links_person", table_name="account_links")
    op.drop_table("account_links")
    for table in ("students", "teachers"):
        op.drop_index(op.f("ix_%s_email" % table), table_name=table)
        op.drop_column(table, "status")
