import argparse
import secrets

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User

DEMO_EMAIL = "student@scholario.com"
DEMO_PASSWORD = "demo-password-123"
DEMO_NAME = "Scholario Demo Student"


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or refresh the public Scholario student demo account")
    parser.add_argument("--email", default=DEMO_EMAIL)
    parser.add_argument("--password", default=DEMO_PASSWORD)
    parser.add_argument("--name", default=DEMO_NAME)
    args = parser.parse_args()

    email = args.email.strip().lower()
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.email == email))
        if user:
            if user.role != "student":
                parser.error("an account with this email already exists with a different role")
            user.password_hash = hash_password(args.password)
            user.full_name = args.name
            user.is_active = True
            user.is_verified = True
            user.plan = "free"
            session.commit()
            print(f"Demo student account refreshed for {email}")
            return

        session.add(
            User(
                email=email,
                password_hash=hash_password(args.password),
                full_name=args.name,
                role="student",
                is_active=True,
                is_verified=True,
                plan="free",
                referral_code=secrets.token_urlsafe(9),
            )
        )
        session.commit()
    print(f"Demo student account created for {email}")


if __name__ == "__main__":
    main()
