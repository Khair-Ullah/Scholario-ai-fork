.PHONY: dev up down build logs ps migrate seed seed-templates seed-admin test test-backend test-frontend

dev:
	docker compose up --build

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

# Migrations and template seeding run automatically when the backend starts,
# so `migrate` is only needed for manual re-runs.
migrate:
	docker compose exec -T backend python -m alembic upgrade head

seed: migrate
	docker compose exec -T backend python -m scripts.import_csv --file /data/fully_formated_scholarships.csv --country-map /data/university_country_map.csv

seed-templates:
	docker compose exec -T backend python -m scripts.seed_templates

# Usage: make seed-admin EMAIL=admin@scholario.ai PASSWORD=your-password
seed-admin:
	docker compose exec -T backend python -m scripts.create_admin --email $(EMAIL) --password $(PASSWORD)

test: test-backend test-frontend

test-backend:
	docker compose exec -T backend python -m ruff check app scripts alembic
	docker compose exec -T backend python -m pytest --cov=app.services --cov-fail-under=80

test-frontend:
	docker compose exec -T frontend npm run lint
	docker compose exec -T frontend npm run build