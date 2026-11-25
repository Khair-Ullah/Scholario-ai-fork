"""Add email OTP attempts and grandfather existing users."""

import sqlalchemy as sa

from alembic import op

revision = "0014_email_otp_attempts"
down_revision = "0013_accounts_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("auth_tokens") as batch:
        batch.add_column(sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
    op.execute("UPDATE users SET is_verified = true WHERE is_verified = false")


def downgrade() -> None:
    with op.batch_alter_table("auth_tokens") as batch:
        batch.drop_column("attempts")
