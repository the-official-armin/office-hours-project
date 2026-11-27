"""invite-only accounts: sign in by email, account status, one-time activation and reset links

Revision ID: 0004_invite_only_accounts
Revises: 0003_one_booking_per_student

Existing accounts stay active. Their emails are lowercased, and empty ones (the demo seed had none) become
"<id>@example.com" so every account has a unique sign-in email. The upgrade stops, changing nothing, if two accounts share
an email: two teachers, two students, or a teacher and a student (sign-in looks in both tables).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_invite_only_accounts"
down_revision: Union[str, Sequence[str], None] = "0003_one_booking_per_student"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _shared_emails(bind) -> list:
    """Sign-in emails used by more than one account, across both tables (after lowercasing)."""
    return list(bind.execute(sa.text(
        "SELECT email FROM (SELECT lower(trim(email)) AS email FROM teachers WHERE trim(email) <> '' "
        "UNION ALL SELECT lower(trim(email)) FROM students WHERE trim(email) <> '') AS everyone "
        "GROUP BY email HAVING count(*) > 1 ORDER BY email"
    )).scalars())


def upgrade() -> None:
    shared = _shared_emails(op.get_bind())
    if shared:
        raise RuntimeError(
            "Upgrade stopped, nothing changed: these emails belong to more than one account (teachers and students "
            "together): %s. Give each account its own email, then run the upgrade again." % ", ".join(shared))
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
