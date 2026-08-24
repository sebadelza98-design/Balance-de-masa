# Consolidador de datos meteorológicos y MP-10

Toma los Excel mensuales de la estación (datos **minuto a minuto** de MP10, dirección
y velocidad del viento, temperatura y humedad relativa) y entrega **un solo archivo
con los promedios diarios de todos los meses** que le cargues.

---

## Cómo usarlo en VS Code

1. **Instalar las librerías** (una sola vez), en la terminal de VS Code:

   ```bash
   pip install -r requirements.txt
   ```

2. **Dejar los Excel** dentro de la carpeta `datos_meteo/`.
   Puedes mezclar todos los meses y todas las estaciones que quieras, en `.xls` o `.xlsx`.

3. **Ejecutar**: abre `consolidar_meteo.py` y aprieta el botón ▶ (Run Python File),
   o bien en la terminal:

   ```bash
   python consolidar_meteo.py
   ```

4. **Resultado** en `salida_meteo/`:
   - `consolidado_diario.xlsx` — el archivo principal, con 3 hojas
   - `consolidado_diario.csv` — lo mismo en CSV, por si lo necesitas en otro programa

No hay que editar el código para el uso normal: basta con agregar más archivos a
`datos_meteo/` y volver a ejecutar.

---

## Qué entrega

### Hoja `Promedios diarios`
Una fila por estación y por día:

| Columna | Qué es |
|---|---|
| `estacion`, `ubicacion` | se leen del encabezado del propio Excel |
| `fecha` | día calendario |
| `MP10_prom`, `Vel_prom`, `Temp_prom`, `HR_prom` | promedio del día |
| `Dir_prom` | dirección media del viento, calculada **vectorialmente** (ver más abajo) |
| `MP10_max`, `Vel_max`, `Temp_min/max`, `HR_min/max` | extremos del día |
| `Vel_resultante`, `Dir_resultante_pond` | vector medio del viento, ponderado por velocidad |
| `indice_constancia` | 1 = el viento sopló todo el día en la misma dirección; cerca de 0 = muy variable |
| `n_registros` | minutos leídos ese día (un día completo son 1440) |
| `%val_MP10`, `%val_Dir`, … | % de minutos válidos de cada variable |
| `%val_dia`, `dia_valido` | representatividad del día y si cumple el mínimo (75 % por defecto) |
| `MP10_supera_norma` | marca si el promedio diario supera 150 µg/m³N |

### Hoja `Resumen mensual`
Un resumen por estación y mes. **Los promedios mensuales se calculan solo con los
días válidos**, para que un día incompleto no arrastre el resultado; las columnas
`dias_con_datos`, `dias_validos` y `base_calculo` dejan a la vista sobre qué se calculó.

### Hoja `Archivos procesados`
Registro de qué archivo se leyó, de qué estación, cuántos registros y qué período
cubre. Si un archivo falla, queda anotado aquí con el motivo.

---

## Tres detalles técnicos que sí importan

### 1. La dirección del viento no se promedia como un número común

Promediar 350° y 10° da 180° — o sea, viento del **sur**, cuando en realidad el
promedio es 0° (**norte**). Por eso la dirección se promedia **vectorialmente**
(media circular): se descompone cada minuto en sus componentes norte/este, se
promedian esas componentes y recién ahí se vuelve a ángulo.

Con tus propios datos de octubre 2024 la diferencia no es menor:

| Día | Dirección vectorial (correcta) | Promedio aritmético (erróneo) |
|---|---|---|
| 2024-10-10 | **356.6°** (norte) | 159.7° (sur) |
| 2024-10-06 | **6.8°** (norte) | 140.1° (sureste) |
| 2024-10-03 | **33.9°** (noreste) | 120.5° (este-sureste) |

En 26 de los 31 días del mes el promedio aritmético se equivoca por más de 90°.

### 2. El registro de las 00:00

En estos archivos el dato de las 00:00 viene rotulado con la fecha del día que
**cierra** y aparece al final del bloque de ese día. Así, cada día queda con sus
1440 minutos exactos (de 00:01 a 24:00). El programa respeta ese criterio de la
estación, agrupando por la fecha tal como viene en el archivo. Verificado con tu
archivo de octubre: 31 días, los 31 con exactamente 1440 registros.

### 3. Las hojas `Vel` y `Dir` vienen intercambiadas

En el archivo de ejemplo, la hoja llamada **`Vel`** contiene direcciones (218 °) y
la hoja **`Dir`** contiene velocidades (1.38 m/s): están cambiadas. La hoja
**`DATOS VALIDOS`** sí viene correcta, y es la que lee el programa. Además se revisan
los rangos: si aparece una "velocidad" de 218 m/s, el programa detecta el
intercambio, lo corrige y lo avisa por pantalla.

---

## Control de calidad que aplica

- Los valores fuera de rango físico se descartan (solo ese dato, no la fila completa):
  MP10 0–5000 µg/m³N, dirección 0–360°, velocidad 0–75 m/s, temperatura −30–60 °C, HR 0–100 %.
- El texto donde debería haber un número (`S/D`, celdas vacías) se trata como dato faltante.
- Si cargas dos veces el mismo mes, **los registros repetidos se eliminan solos**
  (se conserva el del último archivo leído).
- Un día se marca `dia_valido = False` si alguna variable no llega al 75 % de minutos válidos.
  Igual aparece en la planilla, con su promedio y su porcentaje, para que tú decidas.

---

## Opciones

Para el uso normal no hacen falta, pero están disponibles:

```bash
python consolidar_meteo.py --help

python consolidar_meteo.py -e otra_carpeta -s resultado.xlsx   # otras rutas
python consolidar_meteo.py archivo1.xls archivo2.xls           # archivos sueltos
python consolidar_meteo.py --min-validos 80                    # exigir 80 % en vez de 75 %
python consolidar_meteo.py --dir-ponderada                     # dirección ponderada por velocidad
```

También se pueden cambiar los valores por defecto editando el bloque
**CONFIGURACION** al inicio de `consolidar_meteo.py`.

---

## Si un archivo nuevo trae otro formato

El programa **no** asume posiciones fijas: busca la fila que dice `Fecha y Hora` e
identifica cada columna por su título, aceptando variantes (`MP10`/`MP-10`/`PM10`,
`Dir`/`DV`/`Dirección`, `Vel`/`VV`/`Velocidad`, `Temp`/`T`, `HR`/`Humedad`).
Si aparece un rótulo nuevo, se agrega a la lista `SINONIMOS` al inicio del archivo.
