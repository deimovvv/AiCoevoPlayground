#!/bin/sh
# Foto diaria de backend/data (la memoria de las marcas, proyectos, imágenes): una carpeta por día,
# se guardan las últimas 14. Lo que no cambió de un día a otro no ocupa lugar (hardlinks).
set -e
dst=/backups/data
mkdir -p "$dst"
new="$dst/$(date +%Y%m%d-%H%M)"
last=$(ls -1d "$dst"/2* 2>/dev/null | tail -1)
if [ -n "$last" ]; then
  rsync -a --delete --link-dest="$last" /data/ "$new"/
else
  rsync -a /data/ "$new"/
fi
ls -1dr "$dst"/2* | tail -n +15 | xargs -r rm -rf
echo "backup ok: $new ($(du -sh "$new" | cut -f1), $(ls -1d "$dst"/2* | wc -l) días guardados)"
