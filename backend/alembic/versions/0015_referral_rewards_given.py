"""Add referral rewards given counter to users."""

import sqlalchemy as sa

from alembic import op

revision = "0015_referral_rewards_given"
down_revision = "0014_email_otp_attempts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("referral_rewards_given", sa.Integer(), nullable=False, server_default="0")
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("referral_rewards_given")
