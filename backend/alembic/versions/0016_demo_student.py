"""Seed the public student demo account."""

import sqlalchemy as sa

from alembic import op

revision = "0016_demo_student"
down_revision = "0015_referral_rewards_given"
branch_labels = None
depends_on = None

DEMO_EMAIL = "student@scholario.com"
DEMO_PASSWORD_HASH = "$bcrypt-sha256$v=2,t=2b,r=12$IUQvEdh251n5di5R6GAFUu$UNzssv7tthI.Zkp87Bk4sTcM/PG30zm"
DEMO_REFERRAL_CODE = "demo-student-2026"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO users (
                email, password_hash, full_name, role, is_active, is_verified,
                plan, referral_code, token_version, totp_enabled,
                totp_recovery_codes, referral_rewards_given
            )
            VALUES (
                :email, :password_hash, :full_name, 'student', true, true,
                'free', :referral_code, 0, false, '[]', 0
            )
            ON CONFLICT (email) DO NOTHING
            """
        ).bindparams(
            email=DEMO_EMAIL,
            password_hash=DEMO_PASSWORD_HASH,
            full_name="Scholario Demo Student",
            referral_code=DEMO_REFERRAL_CODE,
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM users WHERE email = :email").bindparams(email=DEMO_EMAIL))
