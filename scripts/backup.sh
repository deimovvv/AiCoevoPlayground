#!/bin/sh
# Backup diario (docker-compose.prod.yml, servicio `backup`): base + archivos, y copia afuera del servidor.
# Afuera = Cloudflare R2, sólo si están R2_BUCKET y sus claves en el .env de la raíz (docs/guias/produccion.md).
# En R2 queda la base (14 días) y un espejo de los archivos; lo que se borra o cambia va a attic/<fecha>.
set -e
sh /scripts/backup-db.sh
sh /scripts/backup-data.sh
if [ -n "$R2_BUCKET" ] && [ -n "$R2_ACCESS_KEY_ID" ]; then
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
         RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
         RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT" RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
  day=$(date +%Y%m%d)
  rclone sync /backups --include "coevo_studio-*.sql.gz" "r2:$R2_BUCKET/db" --quiet
  rclone sync /data "r2:$R2_BUCKET/data" --backup-dir "r2:$R2_BUCKET/attic/$day" --quiet
  echo "R2 ok: $R2_BUCKET"
else
  echo "R2 sin configurar: el backup queda sólo en este servidor"
fi
