FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=10

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["sh", "-c", "python -m alembic upgrade head && python -m scripts.seed_templates && python -m scripts.import_csv --file data/fully_formated_scholarships.csv --country-map data/university_country_map.csv && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]