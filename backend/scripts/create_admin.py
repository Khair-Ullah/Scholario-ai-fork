import argparse
import getpass
import secrets

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the initial Scholario super admin account")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password")
    parser.add_argument("--name", default="Scholario Admin")
    args = parser.parse_args()
    password = args.password or getpass.getpass("Admin password (min 8 characters): ")
    if len(password) < 8:
        parser.error("password must contain at least 8 characters")
    with SessionLocal() as session:
        email = args.email.strip().lower()
        user = session.scalar(select(User).where(User.email == email))
        if user:
            parser.error("an account with this email already exists")
        session.add(
            User(
                email=email,
                password_hash=hash_password(password),
                full_name=args.name,
                role="super_admin",
                is_active=True,
                is_verified=True,
                plan="pro",
                referral_code=secrets.token_urlsafe(9),
            )
        )
        session.commit()
    print(f"Super admin account created for {email}")


if __name__ == "__main__":
    main()
