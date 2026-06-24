#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Coevo Studio — doble-click launcher (macOS)
# Abrí este archivo con doble click en Finder. Levanta backend
# (:8000) y frontend (:5173) juntos vía dev.sh. Ctrl+C frena ambos.
# (Primera vez: click derecho → Abrir, para saltar el aviso de Gatekeeper.)
# ─────────────────────────────────────────────────────────────
cd "$(dirname "$0")" || exit 1
exec ./dev.sh
