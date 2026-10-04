"""Create the scholarship catalogue."""

import sqlalchemy as sa

from alembic import op

revision = "0001_scholarships"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scholarships",
        sa.Column("scholarship_id", sa.String(length=80), primary_key=True),
        sa.Column("level", sa.String(length=80)),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("university_name", sa.String(length=500)),
        sa.Column("scholarship_type", sa.String(length=120)),
        sa.Column("host_country", sa.String(length=120), nullable=False),
        sa.Column("ielts_required", sa.Boolean()),
        sa.Column("ielts_band", sa.String(length=40)),
        sa.Column("ielts_tier", sa.Integer(), nullable=False),
        sa.Column("fields_list", sa.JSON(), nullable=False),
        sa.Column("docs_list", sa.JSON(), nullable=False),
        sa.Column("deadline_date", sa.Date()),
        sa.Column("deadline_kind", sa.String(length=30), nullable=False),
        sa.Column("selection_ratio_percent", sa.Float()),
        sa.Column("application_url", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("description_html", sa.Text()),
        sa.Column("description_text", sa.Text()),
        sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column("source_data", sa.JSON(), nullable=False),
    )
    for column in ("level", "host_country", "ielts_tier", "deadline_date", "scholarship_type"):
        op.create_index(f"ix_scholarships_{column}", "scholarships", [column])


def downgrade() -> None:
    op.drop_table("scholarships")
