.PHONY: up down logs dev build test lint typecheck db-migrate db-seed db-studio clean

up:
	docker compose up -d
	@echo "Services started:"
	@echo "  Postgres:  localhost:5432"
	@echo "  Redis:     localhost:6379"
	@echo "  MinIO:     localhost:9000 (console: localhost:9001)"
	@echo "  Mailpit:   localhost:8025"

down:
	docker compose down

logs:
	docker compose logs -f

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

db-migrate:
	pnpm db:migrate

db-seed:
	pnpm db:seed

db-studio:
	pnpm db:studio

clean:
	docker compose down -v
	pnpm clean

setup: up
	@echo "Waiting for Postgres..."
	@sleep 3
	pnpm install
	pnpm db:generate
	pnpm db:migrate
	pnpm db:seed
	@echo ""
	@echo "Setup complete! Run 'make dev' to start development."
