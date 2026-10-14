#!/usr/bin/env bash
set -euo pipefail
umask 077

required=(DB_HOST DB_USER DB_PASSWORD DB_NAME)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 2
  fi
done

backup_dir=${BACKUP_DIR:-/var/backups/digital-agriculture}
max_bytes=${MAX_BACKUP_BYTES:-5000000000}
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

if [[ ! "$max_bytes" =~ ^[0-9]+$ ]] || (( max_bytes < 1 )); then
  echo "MAX_BACKUP_BYTES must be a positive integer" >&2
  exit 2
fi

work_dir=$(mktemp -d)
stage_file=''
cleanup() {
  [[ -z "$stage_file" ]] || rm -f -- "$stage_file"
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

cnf_value() {
  local value=${1//\\/\\\\}
  value=${value//\"/\\\"}
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "Newlines are not allowed in MySQL connection settings." >&2
    return 2
  fi
  printf '"%s"' "$value"
}
{
  printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\ndefault-character-set=utf8mb4\n' \
    "$(cnf_value "$DB_HOST")" "$(cnf_value "${DB_PORT:-3306}")" "$(cnf_value "$DB_USER")" "$(cnf_value "$DB_PASSWORD")"
} > "$work_dir/mysql.cnf"
chmod 600 "$work_dir/mysql.cnf"

mysqldump --defaults-extra-file="$work_dir/mysql.cnf" --single-transaction --quick --skip-lock-tables --no-tablespaces --routines --triggers --events "$DB_NAME" | gzip -9n > "$work_dir/database.sql.gz"
gzip -t "$work_dir/database.sql.gz"

new_bytes=$(stat -c '%s' "$work_dir/database.sql.gz")
existing_bytes=0
while IFS= read -r -d '' file; do
  size=$(stat -c '%s' "$file")
  existing_bytes=$((existing_bytes + size))
done < <(find "$backup_dir" -maxdepth 1 -type f -name 'digital-agriculture-*.sql.gz' -print0)

if (( existing_bytes > max_bytes )); then
  echo "Existing backups already exceed the configured ${max_bytes}-byte limit; no files were changed." >&2
  exit 3
fi
if (( new_bytes > max_bytes || existing_bytes + new_bytes > max_bytes )); then
  echo "Backup would exceed the configured ${max_bytes}-byte limit; no existing backup was removed." >&2
  exit 3
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
stage_file=$(mktemp "$backup_dir/.pending-XXXXXX")
cp -- "$work_dir/database.sql.gz" "$stage_file"
test "$(stat -c '%s' "$stage_file")" -eq "$new_bytes"
final_file="$backup_dir/digital-agriculture-${stamp}.sql.gz"
mv -- "$stage_file" "$final_file"
stage_file=''
chmod 600 "$final_file"
echo "Backup saved: $final_file ($new_bytes bytes; total $existing_bytes + $new_bytes / $max_bytes bytes)"
