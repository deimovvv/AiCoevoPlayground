#!/bin/sh
# Backup de la base: un archivo comprimido por día; se guardan los últimos 14.
set -e
f="/backups/coevo_studio-$(date +%Y%m%d-%H%M).sql.gz"
pg_dump -h db -U coevo -d coevo_studio | gzip > "$f"
ls -1t /backups/coevo_studio-*.sql.gz | tail -n +15 | xargs -r rm -f
echo "backup ok: $f ($(du -h "$f" | cut -f1))"
