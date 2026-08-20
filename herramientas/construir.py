#!/usr/bin/env python3
"""
construir.py
Genera el ejecutable de la Calculadora de Emisiones con PyInstaller.

    python herramientas/construir.py              # ejecutable con interfaz gráfica
    python herramientas/construir.py --consola    # además, versión de consola
    python herramientas/construir.py --limpiar    # borra build/ y dist/ antes

El ejecutable se compila para el sistema donde se ejecuta este script:
en Windows produce un .exe, en Linux un binario ELF y en macOS un .app.
No existe compilación cruzada: para obtener el .exe hay que construir en
Windows (o usar el flujo de GitHub Actions incluido en el repositorio).
"""
from __future__ import annotations
import argparse
import os
import platform
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOMBRE = "CalculadoraEmisiones"


def _verificar_dependencias() -> None:
    try:
        import tkinter  # noqa: F401
    except ImportError:
        print("✗ Falta tkinter, necesario para la interfaz gráfica.")
        if platform.system() == "Linux":
            print("  Debian/Ubuntu: sudo apt install python3-tk")
            print("  Fedora:        sudo dnf install python3-tkinter")
        sys.exit(1)

    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("✗ Falta PyInstaller. Instálelo con:")
        print(f"    {sys.executable} -m pip install pyinstaller")
        sys.exit(1)


def _limpiar() -> None:
    for carpeta in ("build", "dist"):
        ruta = os.path.join(RAIZ, carpeta)
        if os.path.isdir(ruta):
            shutil.rmtree(ruta)
            print(f"  · eliminado {carpeta}/")


def _ejecutar(comando: list) -> None:
    print("  $ " + " ".join(comando))
    resultado = subprocess.run(comando, cwd=RAIZ)
    if resultado.returncode != 0:
        sys.exit(resultado.returncode)


def construir(consola: bool = False, limpiar: bool = False) -> None:
    _verificar_dependencias()
    print(f"Construyendo {NOMBRE} para {platform.system()} {platform.machine()}")
    print(f"Python {platform.python_version()} — {RAIZ}\n")

    if limpiar:
        _limpiar()

    base = [sys.executable, "-m", "PyInstaller", "--noconfirm"]
    _ejecutar(base + ["emisiones.spec"])

    if consola:
        print("\nConstruyendo la versión de consola…")
        _ejecutar(base + [
            "--onefile", "--console", "--name", f"{NOMBRE}Consola",
            "--exclude-module", "numpy", "--exclude-module", "pandas",
            "emisiones_app.py",
        ])

    destino = os.path.join(RAIZ, "dist")
    print("\n✓ Listo. Archivos generados en dist/:")
    for archivo in sorted(os.listdir(destino)):
        ruta = os.path.join(destino, archivo)
        if os.path.isfile(ruta):
            print(f"   {archivo}  ({os.path.getsize(ruta) / 1_048_576:.1f} MB)")
        else:
            print(f"   {archivo}/")
    print("\nEl ejecutable es autocontenido: cópielo al equipo destino y ábralo.")
    print("No requiere instalar Python ni ninguna biblioteca.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Construye el ejecutable de la calculadora.")
    parser.add_argument("--consola", action="store_true",
                        help="generar también un ejecutable de consola")
    parser.add_argument("--limpiar", action="store_true",
                        help="borrar build/ y dist/ antes de construir")
    argumentos = parser.parse_args()
    construir(consola=argumentos.consola, limpiar=argumentos.limpiar)
    return 0


if __name__ == "__main__":
    sys.exit(main())
