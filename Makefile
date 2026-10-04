.PHONY: dev test seed

dev:
	docker compose up --build

test:
	cd backend && ruff check app scripts alembic && python -m pytest --cov=app.services --cov-fail-under=80
	cd frontend && npm run lint && npm run build

seed:
	cd backend && python -m alembic upgrade head && python -m scripts.import_csv --file ../data/fully_formated_scholarships.csv && python -m scripts.seed_templates