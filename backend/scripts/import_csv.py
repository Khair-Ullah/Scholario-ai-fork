import argparse
from pathlib import Path

from app.db.session import SessionLocal
from app.services.csv_import import import_country_map, import_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Idempotently import scholarship CSV data")
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument(
        "--country-map",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "university_country_map.csv",
    )
    args = parser.parse_args()

    with SessionLocal() as session:
        map_report = import_country_map(session, args.country_map)
        report = import_csv(session, args.file, args.country_map)
    print(f"country map inserted: {map_report['inserted']}; updated: {map_report['updated']}")
    print("Scholarship import report")
    for name, count in report.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
