"""
Punto de entrada del paquete y del ejecutable.

    python -m emisiones                → interfaz gráfica
    python -m emisiones calcular ...   → línea de comandos
"""
import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
