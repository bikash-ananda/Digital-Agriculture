#!/usr/bin/env bash
set -Eeuo pipefail
APP_ROOT=/srv/digital-agriculture
ENV_FILE=/etc/digital-agriculture/production.env
RELEASE_DIR="${1:-}"
if [[ -z "$RELEASE_DIR" || ! -f "$RELEASE_DIR/docker-compose.prod.yml" ]]; then
  echo "Usage: $0 /srv/digital-agriculture/releases/<commit-sha>" >&2
  exit 2
fi
RELEASE_DIR="$(realpath "$RELEASE_DIR")"
case "$RELEASE_DIR" in "$APP_ROOT"/releases/*) ;; *) echo "Invalid release path" >&2; exit 2 ;; esac
[[ -r "$ENV_FILE" ]] || { echo "Missing $ENV_FILE; run scripts/provision-vps.sh first." >&2; exit 2; }
compose() { docker compose --project-name digital-agriculture --env-file "$ENV_FILE" --file "$RELEASE_DIR/docker-compose.prod.yml" "$@"; }
compose build api web
compose up -d --wait db
compose --profile tools run --rm --no-deps migrate
compose --profile tools run --rm --no-deps seed
compose --profile tools run --rm --no-deps bootstrap
compose up -d --wait --remove-orphans api web
healthy=0
for attempt in $(seq 1 30); do
  if curl --silent --show-error --fail http://127.0.0.1:5001/api/health >/dev/null; then healthy=1; break; fi
  sleep 2
done
if [[ "$healthy" != 1 ]]; then
  compose logs --tail=100 api db >&2 || true
  echo "Deployment health check failed; database volume is preserved." >&2
  exit 1
fi
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
echo "Healthy: https://kaskikotagro.com.np"
compose ps