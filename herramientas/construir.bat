@echo off
REM ─────────────────────────────────────────────────────────────
REM  construir.bat — genera CalculadoraEmisiones.exe en Windows
REM  Uso: doble clic, o desde cmd:  herramientas\construir.bat
REM ─────────────────────────────────────────────────────────────
setlocal
cd /d "%~dp0.."

echo.
echo === Calculadora de Emisiones GEI - construccion del ejecutable ===
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [X] No se encontro Python en el PATH.
    echo     Instalelo desde https://www.python.org/downloads/
    echo     y marque "Add Python to PATH" durante la instalacion.
    pause
    exit /b 1
)

echo [1/3] Instalando PyInstaller si hace falta...
python -m pip install --quiet --upgrade pyinstaller
if errorlevel 1 (
    echo [X] No se pudo instalar PyInstaller.
    pause
    exit /b 1
)

echo [2/3] Ejecutando las pruebas...
python -m unittest discover -s tests -t . -q
if errorlevel 1 (
    echo [X] Las pruebas fallaron. Se detiene la construccion.
    pause
    exit /b 1
)

echo [3/3] Construyendo el ejecutable...
python herramientas\construir.py --limpiar
if errorlevel 1 (
    echo [X] Fallo la construccion.
    pause
    exit /b 1
)

echo.
echo === Listo: dist\CalculadoraEmisiones.exe ===
echo Copie ese archivo al equipo donde lo va a usar. No necesita Python.
echo.
pause
