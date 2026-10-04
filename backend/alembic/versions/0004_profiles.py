"""Add student onboarding profiles."""

import sqlalchemy as sa

from alembic import op

revision = "0004_profiles"
down_revision = "0003_users_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("origin_country", sa.String(length=120)),
        sa.Column("target_level", sa.String(length=40)),
        sa.Column("host_countries", sa.JSON(), nullable=False),
        sa.Column("fields_of_study", sa.JSON(), nullable=False),
        sa.Column("ielts_status", sa.String(length=20)),
        sa.Column("gpa_scale", sa.String(length=20)),
        sa.Column("gpa_value", sa.Float()),
        sa.Column("gpa_4_equivalent", sa.Float()),
        sa.Column("bs_marks_obtained", sa.Float()),
        sa.Column("bs_marks_total", sa.Float()),
        sa.Column("funding_preference", sa.String(length=30)),
        sa.Column("extra_preferences", sa.JSON(), nullable=False),
        sa.Column("intake_preference", sa.String(length=40)),
        sa.Column("budget_note", sa.Text()),
        sa.Column("bio", sa.Text()),
        sa.Column("onboarding_step", sa.Integer(), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_profiles_user_id", "profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_table("profiles")
