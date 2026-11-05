"""Add token_version to users for account-wide session revocation."""

import sqlalchemy as sa

from alembic import op

revision = "0012_user_token_version"
down_revision = "0011_roles_ownership_2fa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("0"))
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("token_version")