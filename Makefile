.PHONY: help install dev dev-frontend migrate makemigrations shell lint format typecheck test test-cov security-scan check-all load-data requirements db-up db-down clean

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install backend + frontend dependencies
	cd backend && uv sync --all-groups
	cd frontend && npm install

dev: ## Start Django dev server
	cd backend && uv run python manage.py runserver

dev-frontend: ## Start Next.js dev server
	cd frontend && npm run dev

migrate: ## Run Django migrations
	cd backend && uv run python manage.py migrate

makemigrations: ## Create new Django migrations
	cd backend && uv run python manage.py makemigrations

shell: ## Open Django shell
	cd backend && uv run python manage.py shell

load-data: ## Load the BlueTide CSVs from data/ into the database
	cd backend && uv run python manage.py load_kestrel_data --dir ../data

lint: ## Lint backend with ruff
	cd backend && uv run ruff check .

format: ## Format backend with ruff
	cd backend && uv run ruff format .

typecheck: ## Type-check backend with mypy
	cd backend && uv run mypy .

test: ## Run backend tests
	cd backend && uv run pytest

test-cov: ## Run backend tests with coverage report
	cd backend && uv run pytest --cov --cov-report=html

security-scan: ## Scan for secrets with gitleaks
	gitleaks detect --source . --verbose

check-all: lint typecheck test security-scan ## Run all checks
	@echo "\n\033[0;32mAll checks passed!\033[0m"

requirements: ## Export requirements.txt for Vercel
	cd backend && uv export --no-dev --no-hashes --format requirements-txt > requirements.txt

db-up: ## Start local Postgres
	docker compose up -d db

db-down: ## Stop local Postgres
	docker compose down

clean: ## Remove caches
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .mypy_cache -o -name .ruff_cache -o -name htmlcov \) -not -path "*/node_modules/*" -not -path "*/.venv/*" -exec rm -rf {} + 2>/dev/null || true
	rm -f backend/.coverage
