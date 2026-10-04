import argparse
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data" / "fully_formated_scholarships.csv"
OUTPUT = ROOT / "data" / "university_country_map.csv"

SEEDS = {
    "United States": [
        "University of North Dakota",
        "The University of Toledo",
        "Washington State University",
        "California State University Fullerton",
        "California State University Northridge",
        "Central Michigan University",
        "Ball State University",
        "Illinois State University",
        "The University of Alabama at Birmingham",
        "Eastern Michigan University",
        "Michigan State University",
        "Education USA",
    ],
    "Australia": [
        "Australian National University",
        "University of Queensland",
        "The University of Sydney",
        "Monash University",
        "Charles Sturt University",
    ],
    "New Zealand": ["Massey University"],
    "Canada": [
        "University of Victoria",
        "Algonquin College",
        "Brock University",
        "University of Guelph",
        "University of Northern British Columbia",
    ],
    "United Kingdom": [
        "UCL",
        "University of Oxford",
        "The University of Edinburgh",
        "University of St Andrews",
        "London School of Economics and Political Science",
        "The University of Lancashire",
        "University of Southampton",
        "University of Birmingham",
        "University of Warwick",
        "University of Liverpool",
        "Loughborough University",
        "Queen's University Belfast",
        "Imperial",
        "University of York",
    ],
    "France": ["INSEAD - The Business School for the World"],
    "Hong Kong": ["Lingnan University"],
    "Slovakia": ["Slovak Academic Information Agency"],
}

PATTERNS = [
    (r"Deutsch|German|Technische Universit.t|Humboldt|Heidelberg|Munich|DAAD", "Germany"),
    (r"Dutch|Netherlands|Amsterdam|Leiden|Utrecht|Delft|Groningen|Wageningen", "Netherlands"),
    (r"Sweden|Swedish|Stockholm|Lund|Uppsala|KTH|Chalmers", "Sweden"),
    (r"Norweg|Oslo|Bergen", "Norway"),
    (r"Danish|Denmark|Copenhagen|Aarhus", "Denmark"),
    (r"Finland|Helsinki|Aalto", "Finland"),
    (r"Swiss|Switzerland|ETH|Zurich|Geneva|Lausanne", "Switzerland"),
    (r"France|French|Paris|Campus France|Eiffel|Sorbonne", "France"),
    (r"Italy|Italian|Milan|Rome|Bologna|Politecnico", "Italy"),
    (r"Spain|Madrid|Barcelona", "Spain"),
    (r"Korea|Seoul|KAIST|GKS", "South Korea"),
    (r"Japan|Tokyo|Kyoto|MEXT|Osaka", "Japan"),
    (r"China|Chinese|Beijing|Tsinghua|Shanghai|Peking|CSC|Zhejiang", "China"),
    (r"Malaysia", "Malaysia"),
    (r"Turk|Istanbul|Ankara", "Türkiye"),
    (r"Hungar|Stipendium", "Hungary"),
    (r"Czech|Prague", "Czech Republic"),
    (r"Poland|Polish|Warsaw", "Poland"),
    (r"Austria|Vienna", "Austria"),
    (r"Belgi|Leuven|Ghent", "Belgium"),
    (r"Ireland|Irish|Dublin|Trinity College Dublin", "Ireland"),
    (r"Singapore|NUS|NTU", "Singapore"),
    (r"Saudi|KAUST", "Saudi Arabia"),
    (r"Qatar", "Qatar"),
    (r"UAE|Emirates|Dubai|Abu Dhabi|Khalifa", "United Arab Emirates"),
    (r"Estonia|Tartu", "Estonia"),
    (r"Iran|Tehran", "Iran"),
    (r"Russia|Moscow|Skolkovo", "Russia"),
    (r"Indonesia", "Indonesia"),
    (r"Thailand", "Thailand"),
    (r"Brunei", "Brunei"),
    (r"Taiwan", "Taiwan"),
    (r"New Zealand|Auckland|Otago|Massey", "New Zealand"),
    (r"Australia|Melbourne|Adelaide|Curtin|UNSW|Monash|Queensland", "Australia"),
]
CANADA_PATTERN = r"Canada|Canadian|Ontario|British Columbia|Alberta|McGill|Toronto|Waterloo|Concordia"
UK_PATTERN = (
    r"UK|Scotland|Wales|England|Kingdom|Imperial|King's College London|Cambridge|Manchester|Leeds|Glasgow|"
    r"Sheffield|Nottingham|Bristol|Durham|Cardiff|Strathclyde|Oxford|Edinburgh"
)
US_STATES = (
    "Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho Illinois "
    "Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota Mississippi Missouri "
    "Montana Nebraska Nevada Hampshire Jersey Mexico York Carolina Dakota Ohio Oklahoma Oregon Pennsylvania Rhode "
    "Island South Tennessee Texas Utah Vermont Virginia Washington Wisconsin Wyoming"
)


def classify(name: str) -> tuple[str, float]:
    seeded = {university: country for country, names in SEEDS.items() for university in names}
    if name in seeded:
        return seeded[name], 1.0
    for pattern, country in PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return country, 0.85
    if re.search(r"University of .*?(?:" + US_STATES.replace(" ", "|") + r")\b|State University", name, re.IGNORECASE):
        return "United States", 0.82
    if re.search(CANADA_PATTERN, name, re.IGNORECASE):
        return "Canada", 0.82
    if re.search(UK_PATTERN, name, re.IGNORECASE):
        return "United Kingdom", 0.82
    return "Unknown", 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=INPUT)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    with args.input.open(encoding="utf-8-sig", newline="") as handle:
        names = sorted(
            {row["university_name"].strip() for row in csv.DictReader(handle) if row.get("university_name", "").strip()}
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    rows = [(name, *classify(name)) for name in names]
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["university_name", "host_country", "confidence"])
        writer.writerows(rows)
    unknown = sum(country == "Unknown" for _, country, _ in rows)
    low_confidence = sum(confidence < 0.8 for _, _, confidence in rows)
    print(f"universities: {len(rows)}; unknown: {unknown}; confidence below 0.8: {low_confidence}")
    if args.report:
        for name, country, confidence in rows:
            if confidence < 0.8:
                print(f"{name}\t{country}\t{confidence}")


if __name__ == "__main__":
    main()
