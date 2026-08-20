#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  construir.sh — genera el ejecutable en Linux o macOS
#  Uso:  bash herramientas/construir.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"

echo
echo "=== Calculadora de Emisiones GEI — construcción del ejecutable ==="
echo

if ! "$PY" -c "import tkinter" 2>/dev/null; then
    echo "[X] Falta tkinter (necesario para la interfaz gráfica)."
    echo "    Debian/Ubuntu: sudo apt install python3-tk"
    echo "    Fedora:        sudo dnf install python3-tkinter"
    echo "    macOS:         viene incluido con python.org o 'brew install python-tk'"
    exit 1
fi

echo "[1/3] Instalando PyInstaller si hace falta…"
"$PY" -m pip install --quiet --upgrade pyinstaller

echo "[2/3] Ejecutando las pruebas…"
"$PY" -m unittest discover -s tests -t . -q

echo "[3/3] Construyendo el ejecutable…"
"$PY" herramientas/construir.py --limpiar

echo
echo "=== Listo: dist/CalculadoraEmisiones ==="
echo "Copie ese archivo al equipo donde lo va a usar. No necesita Python."
