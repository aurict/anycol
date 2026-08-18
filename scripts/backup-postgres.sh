#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

umask 077
mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
partial="$BACKUP_DIR/anycol-$timestamp.dump.age.partial"
output="$BACKUP_DIR/anycol-$timestamp.dump.age"
trap 'rm -f "$partial"' EXIT INT TERM

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl | age --recipient "$BACKUP_AGE_RECIPIENT" --output "$partial"
test -s "$partial"
mv "$partial" "$output"
sha256sum "$output" > "$output.sha256"
printf '%s\n' "$output"
