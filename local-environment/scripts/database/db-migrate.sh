#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Local database migration script.
#
# psql operations run inside the postgres-db container via docker exec -
# no local psql installation required. The mise-managed goose CLI runs on
# the host and connects to the container through the mapped port.
#
# Two-user pattern (mirrors production IAM separation):
#   admin       - superuser; runs 01-init.sql to create schema/roles
#   app_migrator - schema owner; runs goose migrations and seed data so
#                  all created objects are owned by the correct role
#
# Execution order:
#   1. Init   - schema, roles, extensions          (01-init.sql as admin)
#   2. Goose  - validate + apply pending migrations (as app_migrator)
#   3. Seed   - local test data with wiremock URLs  (as app_migrator)
#
# SQL files are streamed via stdin rather than -f because docker exec runs
# inside the container and cannot reference paths on the host filesystem.
#
# Usage:
#   pnpm run local:service:db:migrate
#
# Prerequisites:
#   - postgres-db container running: COMPOSE_PROFILES=backend pnpm run local:compose:up
#   - goose on PATH via mise (pinned in .mise.toml)
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

CONTAINER="postgres-db"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-local_hometest_db}"

# Schema is fixed for local development and matches the hardcoded value in
# database/01-init.sql. The schema-per-environment pattern would usually be
# handled by the goose-migrator lambda when running in deployed envs.
DB_SCHEMA="hometest"

ADMIN_USER="admin"
ADMIN_PASSWORD="admin"

MIGRATOR_USER="app_migrator"
MIGRATOR_PASSWORD="STRONG_PASSWORD_MIGRATOR"

MIGRATIONS_DIR="${REPO_ROOT}/lambdas/goose-migrator-lambda/migrations"
DATABASE_DIR="${REPO_ROOT}/database"

# search_path is set in the connection string so every goose connection
# automatically targets the correct schema without needing SET search_path.
GOOSE_DBSTRING="postgres://${MIGRATOR_USER}:${MIGRATOR_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable&search_path=${DB_SCHEMA}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $*"
  return 0
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
  return 0
}

# Run psql as admin inside the container. Credentials have full DDL access.
psql_admin() {
  docker exec -i -e PGPASSWORD="${ADMIN_PASSWORD}" "${CONTAINER}" \
    psql -U "${ADMIN_USER}" -d "${DB_NAME}" "$@"
  return $?
}

# Run psql as app_migrator inside the container. This role owns the schema
# so objects created here (tables, sequences) have the correct ownership.
psql_migrator() {
  docker exec -i -e PGPASSWORD="${MIGRATOR_PASSWORD}" "${CONTAINER}" \
    psql -U "${MIGRATOR_USER}" -d "${DB_NAME}" "$@"
  return $?
}

# ---------------------------------------------------------------------------
# Wait for PostgreSQL
# ---------------------------------------------------------------------------

wait_for_postgres() {
  local max_attempts=30
  local attempt=1

  log_info "Waiting for PostgreSQL to be ready..."
  # Use a real query rather than pg_isready: pg_isready only checks the
  # network socket and may succeed before the server accepts connections.
  until docker exec -e PGPASSWORD="${ADMIN_PASSWORD}" "${CONTAINER}" \
      psql -U "${ADMIN_USER}" -d "${DB_NAME}" -c "SELECT 1" >/dev/null 2>&1; do
    if [[ ${attempt} -ge ${max_attempts} ]]; then
      log_error "PostgreSQL did not become ready after ${max_attempts} attempts"
      return 1
    fi
    echo -n "."
    sleep 1
    ((attempt++))
  done
  echo ""
  log_info "PostgreSQL is ready."
  return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

wait_for_postgres

log_info "=== Step 1: Initialising schema and roles ==="
psql_admin -v ON_ERROR_STOP=1 < "${DATABASE_DIR}/01-init.sql"

log_info "=== Step 2: Validating goose migrations ==="
GOOSE_DRIVER=postgres GOOSE_DBSTRING="${GOOSE_DBSTRING}" goose -dir "${MIGRATIONS_DIR}" validate

log_info "=== Step 3: Running goose migrations ==="
GOOSE_DRIVER=postgres GOOSE_DBSTRING="${GOOSE_DBSTRING}" goose -dir "${MIGRATIONS_DIR}" up

log_info "=== Step 4: Loading seed data ==="
# Seed data runs as app_migrator (schema owner) and sets supplier service_url
# to http://wiremock:8080 so local requests are intercepted by WireMock.
psql_migrator -v ON_ERROR_STOP=1 < "${DATABASE_DIR}/03-seed-hometest-data.sql"

log_info "=== Database migration and seeding complete ==="
