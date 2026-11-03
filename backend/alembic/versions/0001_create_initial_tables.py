"""create initial tables

Revision ID: 0001_create_initial_tables
Revises:
Create Date: 2026-11-02 15:45:00.000000

Schema mirrors frontend-teacher/src/types/index.ts (see app/models.py).
This replaces the earlier prototype migration (users/clubs/appointments), which was
never deployed; history starts fresh here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_create_initial_tables'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('teachers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('subject_group', sa.String(), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('remind', sa.Boolean(), nullable=False),
        sa.Column('booking', sa.Boolean(), nullable=False),
        sa.Column('cancel', sa.Boolean(), nullable=False),
        sa.Column('request', sa.Boolean(), nullable=False),
        sa.Column('morning', sa.Boolean(), nullable=False),
        sa.Column('lead', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('students',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('grade', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('remind', sa.Boolean(), nullable=False),
        sa.Column('booked', sa.Boolean(), nullable=False),
        sa.Column('answer', sa.Boolean(), nullable=False),
        sa.Column('out', sa.Boolean(), nullable=False),
        sa.Column('lead', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('timings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.String(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('days', sa.JSON(), nullable=False),
        sa.Column('gone', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['teacher_id'], ['teachers.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('teacher_id', 'key')
    )
    op.create_index(op.f('ix_timings_teacher_id'), 'timings', ['teacher_id'], unique=False)
    op.create_table('days_off',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.String(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['teacher_id'], ['teachers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_days_off_teacher_id'), 'days_off', ['teacher_id'], unique=False)
    op.create_table('bookings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.String(), nullable=False),
        sa.Column('timing_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('student_id', sa.String(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.ForeignKeyConstraint(['teacher_id'], ['teachers.id'], ),
        sa.ForeignKeyConstraint(['timing_id'], ['timings.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bookings_teacher_id'), 'bookings', ['teacher_id'], unique=False)
    op.create_table('booking_requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.String(), nullable=False),
        sa.Column('student_id', sa.String(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('time', sa.String(length=5), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.ForeignKeyConstraint(['teacher_id'], ['teachers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_booking_requests_teacher_id'), 'booking_requests', ['teacher_id'], unique=False)
    op.create_table('notifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.String(), nullable=True),
        sa.Column('student_id', sa.String(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('at', sa.BigInteger(), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=False),
        sa.Column('key', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.ForeignKeyConstraint(['teacher_id'], ['teachers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_teacher_id'), 'notifications', ['teacher_id'], unique=False)
    op.create_index(op.f('ix_notifications_student_id'), 'notifications', ['student_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_notifications_student_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_teacher_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_booking_requests_teacher_id'), table_name='booking_requests')
    op.drop_table('booking_requests')
    op.drop_index(op.f('ix_bookings_teacher_id'), table_name='bookings')
    op.drop_table('bookings')
    op.drop_index(op.f('ix_days_off_teacher_id'), table_name='days_off')
    op.drop_table('days_off')
    op.drop_index(op.f('ix_timings_teacher_id'), table_name='timings')
    op.drop_table('timings')
    op.drop_table('students')
    op.drop_table('teachers')
