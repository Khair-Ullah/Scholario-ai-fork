"""Add revoked_access_tokens denylist for logout-time access token invalidation."""

import sqlalchemy as sa

from alembic import op

revision = "0010_access_token_denylist"
down_revision = "0009_admin_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "revoked_access_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_revoked_access_tokens_jti", "revoked_access_tokens", ["jti"], unique=True)
    op.create_index("ix_revoked_access_tokens_user_id", "revoked_access_tokens", ["user_id"])
    op.create_index("ix_revoked_access_tokens_expires_at", "revoked_access_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_revoked_access_tokens_expires_at", table_name="revoked_access_tokens")
    op.drop_index("ix_revoked_access_tokens_user_id", table_name="revoked_access_tokens")
    op.drop_index("ix_revoked_access_tokens_jti", table_name="revoked_access_tokens")
    op.drop_table("revoked_access_tokens")
