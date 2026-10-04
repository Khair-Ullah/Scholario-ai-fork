from app.db.session import SessionLocal
from app.services.templates_seed import seed_templates


def main() -> None:
    with SessionLocal() as session:
        report = seed_templates(session)
    print(f"Templates inserted: {report['inserted']}; updated: {report['updated']}")


if __name__ == "__main__":
    main()
