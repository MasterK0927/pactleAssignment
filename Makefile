.PHONY: help install build test run clean docker-build docker-run docker-stop

# Default target
help:
	@echo "Available commands:"
	@echo "  install      - Install dependencies"
	@echo "  build        - Build the TypeScript project"
	@echo "  test         - Run tests"
	@echo "  test-watch   - Run tests in watch mode"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  run          - Run the application in development mode"
	@echo "  start        - Start the built application"
	@echo "  lint         - Run ESLint"
	@echo "  lint-fix     - Run ESLint with auto-fix"
	@echo "  clean        - Clean build artifacts"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run with Docker Compose"
	@echo "  docker-stop  - Stop Docker Compose"

# Install dependencies
install:
	npm install

# Build the project
build:
	npm run build

# Run tests
test:
	npm test

# Run tests in watch mode
test-watch:
	npm run test:watch

# Run tests with coverage
test-coverage:
	npm run test:coverage

# Run in development mode
run:
	npm run dev

# Start built application
start:
	npm start

# Lint code
lint:
	npm run lint

# Lint and fix
lint-fix:
	npm run lint:fix

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf coverage/
	rm -rf node_modules/.cache/

# Docker commands
docker-build:
	docker-compose build

docker-run:
	docker-compose up -d

docker-stop:
	docker-compose down

# Development workflow
dev-setup: install build test
	@echo "Development setup complete!"

# Production deployment
deploy: clean install build test docker-build
	@echo "Ready for deployment!"
