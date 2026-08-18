#!/usr/bin/env sh
set -eu

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE is required}"

case "$RESTORE_DATABASE_URL" in
  *restore*|*drill*) ;;
  *) echo "RESTORE_DATABASE_URL must point to an isolated restore/drill database" >&2; exit 2 ;;
esac

sha256sum --check "$BACKUP_FILE.sha256"
age --decrypt --identity "$AGE_IDENTITY_FILE" "$BACKUP_FILE" | pg_restore --dbname "$RESTORE_DATABASE_URL" --exit-on-error --no-owner --no-acl
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT count(*) AS migrations FROM drizzle.__drizzle_migrations" \
  -c "SELECT count(*) AS workspaces FROM public.workspaces" \
  -c "SELECT count(*) AS audit_events FROM public.audit_events"
