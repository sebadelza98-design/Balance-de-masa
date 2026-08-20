# -*- mode: python ; coding: utf-8 -*-
"""
emisiones.spec
Receta de PyInstaller para generar el ejecutable de la calculadora.

    pyinstaller emisiones.spec          (o: python herramientas/construir.py)

El resultado queda en dist/ y es un único archivo autocontenido:
    Windows → dist/CalculadoraEmisiones.exe
    Linux   → dist/CalculadoraEmisiones
    macOS   → dist/CalculadoraEmisiones  y  dist/CalculadoraEmisiones.app
"""
import os
import sys

NOMBRE = "CalculadoraEmisiones"
raiz = os.path.abspath(os.getcwd())

# Icono opcional: coloque recursos/icono.ico (Windows) o .icns (macOS)
icono = None
for candidato in ("recursos/icono.ico", "recursos/icono.icns"):
    if os.path.isfile(os.path.join(raiz, candidato)):
        icono = os.path.join(raiz, candidato)
        break

# Un catálogo de factores propio junto al .spec viaja dentro del ejecutable
datos = []
if os.path.isfile(os.path.join(raiz, "factores_emision.json")):
    datos.append(("factores_emision.json", "."))

analisis = Analysis(
    ["emisiones_app.py"],
    pathex=[raiz],
    binaries=[],
    datas=datos,
    hiddenimports=["tkinter", "tkinter.ttk", "tkinter.filedialog", "tkinter.messagebox"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # La aplicación usa sólo la biblioteca estándar: fuera el peso innecesario
    excludes=["numpy", "pandas", "matplotlib", "scipy", "PIL", "PyQt5", "PySide2",
              "IPython", "notebook", "pytest", "setuptools", "pip"],
    noarchive=False,
)

pyz = PYZ(analisis.pure)

exe = EXE(
    pyz,
    analisis.scripts,
    analisis.binaries,
    analisis.datas,
    [],
    name=NOMBRE,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # sin ventana negra; la CLI sigue disponible con argumentos
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icono,
)

if sys.platform == "darwin":
    app = BUNDLE(
        exe,
        name=f"{NOMBRE}.app",
        icon=icono,
        bundle_identifier="cl.balancedemasa.emisiones",
        info_plist={
            "CFBundleName": "Calculadora de Emisiones",
            "CFBundleDisplayName": "Calculadora de Emisiones GEI",
            "CFBundleShortVersionString": "1.0.0",
            "NSHighResolutionCapable": True,
        },
    )
