"""Add saved opportunities, applications, and checklist items."""

import sqlalchemy as sa

from alembic import op

revision = "0005_student_workspace"
down_revision = "0004_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_scholarships",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "scholarship_id",
            sa.String(length=80),
            sa.ForeignKey("scholarships.scholarship_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "scholarship_id",
            sa.String(length=80),
            sa.ForeignKey("scholarships.scholarship_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("applied_on", sa.Date()),
        sa.Column("next_step", sa.String(length=300)),
        sa.Column("next_step_date", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "scholarship_id", name="uq_applications_user_scholarship"),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_table(
        "checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "scholarship_id", sa.String(length=80), sa.ForeignKey("scholarships.scholarship_id", ondelete="CASCADE")
        ),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False),
        sa.Column("due_date", sa.Date()),
        sa.Column("category", sa.String(length=80)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_checklist_items_user_id", "checklist_items", ["user_id"])


def downgrade() -> None:
    op.drop_table("checklist_items")
    op.drop_index("ix_applications_user_id", table_name="applications")
    op.drop_table("applications")
    op.drop_table("saved_scholarships")
