#!/usr/bin/env python3
"""
emisiones_app.py
Lanzador de la Calculadora de Emisiones GEI.

Este es el archivo que PyInstaller convierte en ejecutable. Sin argumentos
abre la interfaz gráfica; con argumentos se comporta como la herramienta de
consola (`emisiones --help`).
"""
import os
import sys

# Permite ejecutar el archivo directamente desde el repositorio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from emisiones.cli import main

if __name__ == "__main__":
    sys.exit(main())
