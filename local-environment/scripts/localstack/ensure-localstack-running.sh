#!/usr/bin/env bash

set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required for local Terraform apply."
	exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx 'localstack-main'; then
	echo "LocalStack is not running. Start the backend first with 'pnpm run local:backend:start', or run 'pnpm run local:start'."
	exit 1
fi
