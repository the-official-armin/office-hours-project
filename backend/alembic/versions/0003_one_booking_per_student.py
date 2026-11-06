"""one confirmed booking per student per office hour

Revision ID: 0003_one_booking_per_student
Revises: 0002_add_authentication
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_one_booking_per_student"
down_revision: Union[str, Sequence[str], None] = "0002_add_authentication"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_bookings_one_per_student", "bookings", ["student_id", "date", "timing_id"], unique=True,
        sqlite_where=sa.text("status = 'confirmed'"), postgresql_where=sa.text("status = 'confirmed'"),
    )


def downgrade() -> None:
    op.drop_index("uq_bookings_one_per_student", table_name="bookings")
