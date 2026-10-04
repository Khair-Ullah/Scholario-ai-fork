"""Persist university country classifications."""

import sqlalchemy as sa

from alembic import op

revision = "0002_university_country"
down_revision = "0001_scholarships"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "university_country",
        sa.Column("university_name", sa.String(length=500), primary_key=True),
        sa.Column("host_country", sa.String(length=120), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("university_country")
