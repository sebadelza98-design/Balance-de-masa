# Balance-de-masa

Herramientas para la planta de tratamiento de agua:

1. **Balance de masa hídrico** — `Balance_Masa_Agua_Colab_(1).ipynb`
   Notebook de Google Colab que resuelve el balance de masa de la planta
   (corrientes conocidas y desconocidas, diagramas Sankey, carga desde Excel)
   y levanta una interfaz Streamlit mediante un túnel.

2. **Calculadora de emisiones GEI** — carpeta `emisiones/`
   Aplicación de escritorio **con ejecutables** que calcula las emisiones de
   gases de efecto invernadero introduciendo los datos de consumo, según el
   GHG Protocol (alcances 1, 2 y 3). Funciona sin conexión y sin instalar nada.

---

## Calculadora de emisiones — inicio rápido

```bash
# interfaz gráfica
python emisiones_app.py

# o desde la consola, sin interfaz gráfica
python emisiones_app.py interactivo
python emisiones_app.py plantilla datos.csv
python emisiones_app.py calcular datos.csv --html reporte.html
```

### Generar el ejecutable

| Sistema | Comando |
|---|---|
| Windows | doble clic en `herramientas\construir.bat` → `dist\CalculadoraEmisiones.exe` |
| Linux / macOS | `bash herramientas/construir.sh` → `dist/CalculadoraEmisiones` |

También se pueden generar los tres a la vez desde la pestaña **Actions** de
GitHub, con el flujo *Ejecutables de la calculadora de emisiones*.

### Qué calcula

- **Alcance 1** — combustibles (gas natural, diésel, GLP, fuel oil, leña),
  flota, refrigerantes (R-134a, R-404A, R-410A, R-407C, R-22, amoníaco, SF₆),
  CO₂ de proceso y emisiones de aguas residuales (CH₄ por DBO, N₂O por nitrógeno).
- **Alcance 2** — electricidad de red o por contrato, vapor comprado.
- **Alcance 3** — agua, transporte, viajes, residuos, lodos, materiales e insumos.

Los factores de combustión se derivan de los parámetros del **IPCC 2006** (poder
calorífico, densidad y kg de gas por TJ) y se convierten a CO₂e con los **GWP-100
del IPCC AR6**, con desglose por gas. Los factores referenciales (electricidad,
transporte, residuos, materiales) están marcados con ⚠ y son editables desde la
propia aplicación para reemplazarlos por los valores oficiales de cada año.

📖 **Documentación completa:** [`docs/CALCULADORA_EMISIONES.md`](docs/CALCULADORA_EMISIONES.md)

### Pruebas

```bash
python -m unittest discover -s tests -t . -v
```
