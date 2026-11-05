"""Add roles hierarchy, scholarship ownership, TOTP 2FA, auth attempts and consultant warnings."""

import sqlalchemy as sa

from alembic import op

revision = "0011_roles_ownership_2fa"
down_revision = "0010_access_token_denylist"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("totp_secret", sa.String(length=64), nullable=True))
        batch.add_column(
            sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(
            sa.Column("totp_recovery_codes", sa.JSON(), nullable=False, server_default="[]")
        )

    with op.batch_alter_table("scholarships") as batch:
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_scholarships_owner_id_users", "users", ["owner_id"], ["id"], ondelete="SET NULL"
        )
        batch.create_index("ix_scholarships_owner_id", ["owner_id"])

    op.create_table(
        "auth_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("succeeded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_auth_attempts_email", "auth_attempts", ["email"])
    op.create_index("ix_auth_attempts_created_at", "auth_attempts", ["created_at"])

    op.create_table(
        "consultant_warnings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("consultant_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issued_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="warning"),
        sa.Column("category", sa.String(length=40), nullable=False, server_default="manual"),
        sa.Column("reason", sa.String(length=200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("is_acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_consultant_warnings_consultant_id", "consultant_warnings", ["consultant_id"])
    op.create_index("ix_consultant_warnings_created_at", "consultant_warnings", ["created_at"])

    # Promote legacy admins to the new top-tier super admin role.
    op.execute("UPDATE users SET role = 'super_admin' WHERE role = 'admin'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'super_admin'")

    op.drop_index("ix_consultant_warnings_created_at", table_name="consultant_warnings")
    op.drop_index("ix_consultant_warnings_consultant_id", table_name="consultant_warnings")
    op.drop_table("consultant_warnings")

    op.drop_index("ix_auth_attempts_created_at", table_name="auth_attempts")
    op.drop_index("ix_auth_attempts_email", table_name="auth_attempts")
    op.drop_table("auth_attempts")

    with op.batch_alter_table("scholarships") as batch:
        batch.drop_index("ix_scholarships_owner_id")
        batch.drop_constraint("fk_scholarships_owner_id_users", type_="foreignkey")
        batch.drop_column("owner_id")

    with op.batch_alter_table("users") as batch:
        batch.drop_column("totp_recovery_codes")
        batch.drop_column("totp_enabled")
        batch.drop_column("totp_secret")
