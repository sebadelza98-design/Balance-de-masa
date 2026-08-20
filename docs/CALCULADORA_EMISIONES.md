# Calculadora de Emisiones GEI

Aplicación de escritorio (con ejecutables) para calcular las emisiones de gases de
efecto invernadero de una instalación a partir de sus datos de consumo, siguiendo el
**GHG Protocol** para los alcances 1, 2 y 3.

Funciona **sin conexión**, no envía datos a ningún servidor y no requiere instalar
Python en el equipo donde se usa.

---

## 1. Cómo se usa

### Opción A — el ejecutable (recomendado para el usuario final)

1. Copie `CalculadoraEmisiones.exe` (Windows) o `CalculadoraEmisiones` (Linux/macOS)
   al equipo.
2. Ábralo con doble clic.
3. Pestaña **1 · Datos de actividad**: elija alcance → categoría → fuente de emisión,
   escriba la cantidad consumida y su unidad, y pulse **Agregar**.
4. Pestaña **3 · Resultados**: totales por alcance, gráfico y principales fuentes.
5. Pestaña **4 · Reporte**: resumen imprimible y exportación a HTML, CSV o JSON.

El menú **Archivo** guarda y abre inventarios (`.json`), importa planillas CSV y
exporta reportes. El menú **Factores** permite ajustar cualquier factor de emisión
al valor oficial que corresponda a su empresa y a su año de reporte.

### Opción B — desde el código fuente

```bash
python emisiones_app.py                 # interfaz gráfica
python -m emisiones                     # equivalente
```

### Opción C — consola (sin interfaz gráfica)

```bash
# ingreso de datos guiado, paso a paso
python emisiones_app.py interactivo

# calcular desde una planilla y generar reportes
python emisiones_app.py plantilla datos.csv
python emisiones_app.py calcular datos.csv --html reporte.html --csv detalle.csv

# consultar el catálogo de factores
python emisiones_app.py factores --alcance 1 --detalle
python emisiones_app.py factores --buscar refrigerante
```

Con un ejecutable ya construido, los mismos comandos funcionan pasándole argumentos:
`CalculadoraEmisiones.exe calcular datos.csv --html reporte.html`.

---

## 2. Generar los ejecutables

No existe compilación cruzada: **el .exe se construye en Windows**, el binario de
Linux en Linux y el .app en macOS. Hay tres caminos:

| Sistema | Comando |
|---|---|
| Windows | doble clic en `herramientas\construir.bat` |
| Linux / macOS | `bash herramientas/construir.sh` |
| Cualquiera | `pip install pyinstaller && python herramientas/construir.py` |

El resultado queda en `dist/`:

```
dist/CalculadoraEmisiones.exe        Windows — un solo archivo, ~12 MB
dist/CalculadoraEmisiones            Linux
dist/CalculadoraEmisiones.app        macOS
```

Los scripts corren las pruebas antes de construir y se detienen si algo falla.

**Los tres a la vez, sin tener los tres sistemas:** el repositorio incluye
`.github/workflows/ejecutables.yml`. Ejecute el flujo desde la pestaña *Actions*
de GitHub (*Run workflow*) y descargue los ejecutables de Windows, Linux y macOS
desde los *artifacts* de la corrida.

### Opciones

```bash
python herramientas/construir.py --limpiar    # borra build/ y dist/ antes
python herramientas/construir.py --consola    # además, versión de consola
```

Para ponerle un ícono propio, deje `recursos/icono.ico` (Windows) o
`recursos/icono.icns` (macOS) antes de construir.

---

## 3. Cómo se calcula

Para cada dato de actividad:

```
kg CO₂e = cantidad × factor de emisión × GWP del gas
```

1. **Conversión de unidades.** La cantidad se lleva a la unidad del factor
   (m³→L, MWh→kWh, t→kg…). Convertir entre dimensiones distintas —litros a kWh—
   se rechaza y la actividad queda marcada como error, fuera del total.
2. **Desglose por gas.** Los factores de combustión no son una constante suelta:
   guardan los kg de CO₂, CH₄ y N₂O por unidad, y cada gas se convierte a CO₂
   equivalente con su **GWP-100 del IPCC AR6**. Por eso el reporte muestra las
   emisiones también por gas.
3. **CO₂ biogénico aparte.** La leña y la biomasa reportan su CO₂ biogénico en una
   línea separada, fuera de los alcances 1/2/3, como pide el GHG Protocol.

### Origen de los factores

Los factores de combustión se **derivan en el código** de sus parámetros fuente
—poder calorífico inferior, densidad y kg de gas por TJ del **IPCC 2006 (Vol. 2)**—
para que el número final sea auditable. Por ejemplo, el diésel estacionario:

```
0,840 kg/L × 43,0 MJ/kg = 0,03612 GJ/L
0,03612 GJ/L × 74,1 kg CO₂/GJ = 2,6765 kg CO₂/L
+ CH₄ (3 kg/TJ × 29,8) + N₂O (0,6 kg/TJ × 273) = 2,6856 kg CO₂e/L
```

Los refrigerantes se calculan desde la **composición másica de la mezcla**:
R-404A = 44 % HFC-125 + 4 % HFC-134a + 52 % HFC-143a → 4.728 kg CO₂e/kg (AR6).

> ⚠ **Los factores marcados con ⚠ son referenciales.** Electricidad de red,
> transporte, residuos, agua y materiales traen un valor por defecto razonable
> pero genérico. Antes de usar el reporte con fines externos, reemplácelos por
> el factor oficial de su año de reporte o el dato de su proveedor: menú
> **Factores → Editar factor**, o un archivo `factores_emision.json` propio.
> La aplicación lista esos factores en cada reporte para que no se le pasen.

---

## 4. Qué se puede cargar

| Alcance | Categorías incluidas |
|---|---|
| **1 — Directas** | Combustión estacionaria (gas natural, diésel, GLP, fuel oil, leña), combustión móvil (diésel, gasolina), refrigerantes (R-134a, R-404A, R-410A, R-407C, R-507A, R-22, amoníaco, SF₆), CO₂ de proceso, aguas residuales (CH₄ por DBO anaeróbica, N₂O por nitrógeno descargado) |
| **2 — Energía comprada** | Electricidad de red, electricidad por contrato/certificados, vapor o calor comprado |
| **3 — Cadena de valor** | Agua potable y tratamiento externo, transporte de carga (camión, marítimo, aéreo), viajes, residuos (relleno, reciclaje, compostaje, lodos), materiales e insumos (PET, vidrio, aluminio, cartón, soda cáustica, ácido nítrico) |

Faltará algo que usted use: agréguelo con **Factores → Agregar factor propio**.

---

## 5. Cargar datos desde una planilla

Para un cierre mensual conviene llenar una planilla en vez de tipear en pantalla:

```bash
python emisiones_app.py plantilla datos_mayo.csv
```

Genera un CSV con esta cabecera y la lista completa de `factor_id` disponibles:

```csv
descripcion;factor_id;cantidad;unidad;periodo;area;notas
Diésel calderas;diesel_estacionario_L;1250;L;2026-05;Calderas;
Electricidad planta;electricidad_sen;180;MWh;2026-05;Planta;
Recarga R-404A;ref_r404a;12;kg;2026-05;Sala de frío;
Agua de pozo;agua_potable_m3;34500;m3;2026-05;Tratamiento;
```

Acepta separador `;` o `,` y decimales con coma o punto. Luego:

```bash
python emisiones_app.py calcular datos_mayo.csv --html reporte_mayo.html
```

o, en la interfaz gráfica, **Archivo → Importar actividades desde CSV**.

---

## 6. Factores propios

Exporte el catálogo (**Factores → Exportar catálogo JSON**), edite los valores y
guárdelo como `factores_emision.json` junto al ejecutable: la aplicación lo toma
automáticamente al abrir. También sirve pasarlo explícitamente:

```bash
python emisiones_app.py --catalogo factores_planta.json calcular datos.csv
```

El archivo sólo necesita los factores que quiera cambiar; el resto del catálogo
base se mantiene.

```json
{
  "factores": [
    {
      "id": "electricidad_sen",
      "nombre": "Electricidad — factor oficial 2026",
      "alcance": 2,
      "categoria": "Electricidad",
      "unidad": "kWh",
      "gases": { "CO2e": 0.2854 },
      "fuente": "Ministerio de Energía, informe 2026",
      "verificar": false
    }
  ]
}
```

---

## 7. Usar el motor desde otro código

```python
from emisiones import Inventario, Actividad, calcular_inventario

inventario = Inventario(organizacion="Planta", periodo="2026-05")
inventario.agregar(Actividad(descripcion="Diésel calderas",
                             factor_id="diesel_estacionario_L",
                             cantidad=1250, unidad="L", area="Calderas"))

resultado = calcular_inventario(inventario)
print(resultado.t_co2e)          # total en toneladas de CO₂e
print(resultado.por_alcance())   # {1: …, 2: …, 3: …} en kg CO₂e
print(resultado.por_gas())       # desglose por gas
```

Esto conecta con el balance de masa del repositorio: los caudales de entrada de
pozo o red del período pueden cargarse directamente como actividad
`agua_potable_m3`, y el efluente a tratamiento como `agua_residual_m3`.

---

## 8. Estructura y pruebas

```
emisiones/
├── unidades.py   conversión de unidades y sus dimensiones
├── factores.py   catálogo de factores y GWP; derivación desde parámetros IPCC
├── modelo.py     Actividad e Inventario (guardar/abrir .json)
├── calculo.py    motor: actividad → kg CO₂e, y agregaciones del inventario
├── reportes.py   resumen de texto, CSV, JSON, HTML e importación de planillas
├── cli.py        línea de comandos y modo interactivo
└── gui.py        interfaz gráfica Tkinter
emisiones_app.py  lanzador (es lo que PyInstaller convierte en ejecutable)
herramientas/     scripts de construcción para Windows, Linux y macOS
tests/            75 pruebas (unittest, sin dependencias)
```

```bash
python -m unittest discover -s tests -t . -v
```

Las pruebas verifican, entre otras cosas, que los factores derivados coincidan con
el cálculo a mano del IPCC, que los desgloses sumen exactamente el total, que las
unidades incompatibles se rechacen y que el HTML escape el contenido ingresado.

---

## 9. Requisitos

- **Para usar el ejecutable:** nada. Windows 10+, Linux con glibc reciente o macOS 11+.
- **Para el código fuente:** Python 3.8 o superior. En Linux, `python3-tk` para la
  interfaz gráfica (`sudo apt install python3-tk`); la consola funciona sin él.
- **Para construir ejecutables:** `pip install pyinstaller`.
