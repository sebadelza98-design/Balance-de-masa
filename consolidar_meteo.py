# -*- coding: utf-8 -*-
"""
=============================================================================
 CONSOLIDADOR DE DATOS METEOROLOGICOS Y DE CALIDAD DEL AIRE
=============================================================================

 Toma los Excel mensuales de la estacion (datos minuto a minuto de MP10,
 direccion y velocidad del viento, temperatura y humedad relativa) y entrega
 un unico archivo consolidado con los PROMEDIOS DIARIOS de todos los meses.

 COMO USARLO EN VS CODE
 ----------------------
   1. Instalar las librerias una sola vez, en la terminal:
          pip install -r requirements.txt
   2. Copiar todos los Excel (.xls o .xlsx) dentro de la carpeta "datos_meteo".
      Se pueden mezclar meses distintos y estaciones distintas.
   3. Apretar el boton de Play (Run Python File) o ejecutar:
          python consolidar_meteo.py
   4. El resultado queda en "salida_meteo/consolidado_diario.xlsx".

 Tambien acepta argumentos por linea de comandos (ver: --help), por ejemplo:
          python consolidar_meteo.py -e otra_carpeta -s resultado.xlsx
          python consolidar_meteo.py archivo1.xls archivo2.xls

 NOTAS TECNICAS IMPORTANTES
 --------------------------
 * La direccion del viento NO se promedia aritmeticamente. Promediar 350 y 10
   grados daria 180 (viento del sur), cuando el promedio real es 0 (norte).
   Aqui se usa el promedio VECTORIAL (media circular), que es lo correcto.
 * El registro de las 00:00 viene rotulado con la fecha del dia que cierra y
   aparece al final del bloque de ese dia, por lo que cada dia queda con sus
   1440 minutos exactos (00:01 a 24:00). Se respeta ese criterio de la
   estacion agrupando por la fecha tal cual viene en el archivo.
 * En algunos archivos las hojas "Vel" y "Dir" vienen con los datos
   intercambiados. El programa lee la hoja "DATOS VALIDOS" (que si viene
   correcta) y ademas revisa los rangos para detectar el intercambio.
=============================================================================
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# =============================================================================
# CONFIGURACION - se puede editar aca para no usar la linea de comandos
# =============================================================================

CARPETA_ENTRADA = "datos_meteo"                      # donde se dejan los Excel
ARCHIVO_SALIDA = "salida_meteo/consolidado_diario.xlsx"

MIN_PORCENTAJE_VALIDO = 75.0   # % minimo de minutos validos para dar por bueno el dia
NORMA_MP10_DIARIA = 150.0      # ug/m3N, norma primaria diaria de MP10 (D.S. 59/98)
PONDERAR_DIRECCION_POR_VELOCIDAD = False  # False = vector unitario; True = pesado por velocidad

# Redondeo de cada variable en la planilla final
DECIMALES = {"MP10": 1, "Dir": 1, "Vel": 2, "Temp": 1, "HR": 1}

# Rangos fisicamente aceptables. Todo lo que quede fuera se marca como invalido.
RANGOS_VALIDOS = {
    "MP10": (0.0, 5000.0),   # ug/m3N
    "Dir": (0.0, 360.0),     # grados
    "Vel": (0.0, 75.0),      # m/s
    "Temp": (-30.0, 60.0),   # grados C
    "HR": (0.0, 100.0),      # %
}

# Nombres con que puede venir rotulada cada columna en el Excel
SINONIMOS = {
    "MP10": ["mp10", "mp 10", "mp-10", "pm10", "pm 10", "pm-10", "material particulado"],
    "Dir": ["dir", "dv", "direccion", "direccion viento", "direccion del viento", "wd"],
    "Vel": ["vel", "vv", "velocidad", "velocidad viento", "velocidad del viento", "ws"],
    "Temp": ["temp", "t", "temperatura", "ta", "temp aire"],
    "HR": ["hr", "humedad", "humedad relativa", "rh"],
}

UNIDADES = {
    "MP10": "ug/m3N",
    "Dir": "grados",
    "Vel": "m/s",
    "Temp": "degC",
    "HR": "%",
}

COLUMNA_FECHA = ["fecha y hora", "fecha/hora", "fechahora", "fecha", "date", "datetime"]

EXTENSIONES = (".xls", ".xlsx", ".xlsm")

# Nombres de las hojas que genera este programa. Sirven para reconocer un archivo
# de salida y no volver a procesarlo como si fuera un Excel de la estacion.
HOJAS_SALIDA = ("Promedios diarios", "Resumen mensual", "Archivos procesados")


# =============================================================================
# UTILIDADES
# =============================================================================

def normalizar(texto) -> str:
    """Pasa a minusculas, saca tildes y espacios de sobra. Para comparar textos."""
    if texto is None or (isinstance(texto, float) and np.isnan(texto)):
        return ""
    txt = str(texto).strip().lower()
    txt = unicodedata.normalize("NFKD", txt)
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", txt)


def log(mensaje: str) -> None:
    print(mensaje, flush=True)


# =============================================================================
# LECTURA DE UN ARCHIVO EXCEL
# =============================================================================

def es_salida_del_programa(hojas: list[str]) -> bool:
    """True si el Excel es una salida generada por este mismo programa."""
    return any(h in hojas for h in HOJAS_SALIDA)


def elegir_hoja(hojas: list[str]) -> str:
    """Elige la hoja consolidada ('DATOS VALIDOS'), que trae todas las variables."""
    for hoja in hojas:
        n = normalizar(hoja)
        if "dato" in n and "valid" in n:
            return hoja
    return hojas[0]


def buscar_fila_encabezado(crudo: pd.DataFrame) -> int:
    """Ubica la fila que contiene 'Fecha y Hora'. No asume una posicion fija."""
    limite = min(40, len(crudo))
    for fila in range(limite):
        for celda in crudo.iloc[fila]:
            if normalizar(celda) in COLUMNA_FECHA:
                return fila
    raise ValueError("No se encontro la fila de encabezados ('Fecha y Hora').")


def mapear_columnas(crudo: pd.DataFrame, fila_enc: int) -> tuple[int, dict[str, int]]:
    """Devuelve el indice de la columna de fecha y el de cada variable."""
    encabezados = [normalizar(c) for c in crudo.iloc[fila_enc]]

    col_fecha = None
    for i, enc in enumerate(encabezados):
        if enc in COLUMNA_FECHA:
            col_fecha = i
            break
    if col_fecha is None:
        raise ValueError("No se identifico la columna de fecha y hora.")

    columnas: dict[str, int] = {}
    for variable, alias in SINONIMOS.items():
        for i, enc in enumerate(encabezados):
            if i == col_fecha or not enc:
                continue
            if enc in alias or any(enc.startswith(a) for a in alias):
                columnas.setdefault(variable, i)
                break
    if not columnas:
        raise ValueError("No se reconocio ninguna variable (MP10, Dir, Vel, Temp, HR).")
    return col_fecha, columnas


def leer_metadatos(crudo: pd.DataFrame, fila_enc: int, ruta: Path) -> dict:
    """Saca nombre de estacion y ubicacion del bloque de titulos del Excel."""
    meta = {"estacion": "", "ubicacion": ""}
    for fila in range(fila_enc):
        for celda in crudo.iloc[fila]:
            texto = str(celda).strip()
            if not texto or texto == "nan":
                continue
            n = normalizar(texto)
            if n.startswith("nombre") and not meta["estacion"]:
                nombre = texto.split(":", 1)[-1].strip()
                comillas = re.findall(r'"([^"]+)"', nombre)
                meta["estacion"] = comillas[-1] if comillas else nombre
            elif n.startswith("ubicacion") and "utm" not in n and not meta["ubicacion"]:
                meta["ubicacion"] = texto.split(":", 1)[-1].strip()

    if not meta["estacion"]:
        # Ultimo recurso: sacar el nombre desde el nombre del archivo
        base = re.sub(r"[_\-]?\d{6}.*$", "", ruta.stem)
        meta["estacion"] = re.sub(r"^Datos[_ ]?v?a?lidos[_ ]?", "", base, flags=re.I) or ruta.stem
    return meta


def a_datetime(serie: pd.Series) -> pd.Series:
    """Convierte la columna de fecha, venga como fecha real o como numero de Excel."""
    if pd.api.types.is_datetime64_any_dtype(serie):
        return serie

    numerica = pd.to_numeric(serie, errors="coerce")
    # Si casi todo es numero, se trata como fecha serial de Excel (origen 1899-12-30)
    if numerica.notna().mean() > 0.9:
        return pd.to_datetime(numerica, unit="D", origin="1899-12-30", errors="coerce")
    return pd.to_datetime(serie, errors="coerce", dayfirst=True)


def corregir_vel_dir(datos: pd.DataFrame, etiqueta: str) -> pd.DataFrame:
    """Detecta y corrige archivos donde Vel y Dir vienen intercambiadas."""
    if "Vel" not in datos or "Dir" not in datos:
        return datos
    vel_max = datos["Vel"].max(skipna=True)
    dir_max = datos["Dir"].max(skipna=True)
    if pd.isna(vel_max) or pd.isna(dir_max):
        return datos
    # Velocidad con valores de rumbo (>75 m/s) y direccion que nunca pasa de 75 grados
    if vel_max > RANGOS_VALIDOS["Vel"][1] and dir_max <= RANGOS_VALIDOS["Vel"][1]:
        log(f"    [!] {etiqueta}: 'Vel' y 'Dir' venian intercambiadas. Se corrigio.")
        datos = datos.rename(columns={"Vel": "Dir", "Dir": "Vel"})
    return datos


def leer_archivo(ruta: Path) -> tuple[pd.DataFrame, dict]:
    """Lee un Excel de la estacion y devuelve los datos minuto a minuto."""
    hojas = pd.ExcelFile(ruta).sheet_names
    if es_salida_del_programa(hojas):
        raise ValueError("es un archivo de salida de este programa, no un Excel de la estacion")
    hoja = elegir_hoja(hojas)
    crudo = pd.read_excel(ruta, sheet_name=hoja, header=None)

    fila_enc = buscar_fila_encabezado(crudo)
    col_fecha, columnas = mapear_columnas(crudo, fila_enc)
    meta = leer_metadatos(crudo, fila_enc, ruta)
    meta.update({"archivo": ruta.name, "hoja": hoja})

    cuerpo = crudo.iloc[fila_enc + 1:]

    datos = pd.DataFrame({"fecha_hora": a_datetime(cuerpo.iloc[:, col_fecha])})
    for variable, indice in columnas.items():
        datos[variable] = pd.to_numeric(cuerpo.iloc[:, indice], errors="coerce")

    datos = datos.dropna(subset=["fecha_hora"]).reset_index(drop=True)
    datos = corregir_vel_dir(datos, ruta.name)

    # Fuera de rango fisico -> se descarta el dato (no la fila completa)
    for variable, (minimo, maximo) in RANGOS_VALIDOS.items():
        if variable in datos:
            fuera = (datos[variable] < minimo) | (datos[variable] > maximo)
            if fuera.any():
                log(f"    [!] {variable}: {int(fuera.sum())} valores fuera de rango, descartados.")
                datos.loc[fuera, variable] = np.nan

    datos.insert(0, "estacion", meta["estacion"])
    datos.insert(1, "ubicacion", meta["ubicacion"])

    meta["registros"] = len(datos)
    meta["desde"] = datos["fecha_hora"].min()
    meta["hasta"] = datos["fecha_hora"].max()
    meta["variables"] = ", ".join(columnas.keys())
    return datos, meta


# =============================================================================
# PROMEDIOS
# =============================================================================

def promedio_direccion(grados: pd.Series, velocidad: pd.Series | None = None) -> tuple[float, float]:
    """
    Promedio VECTORIAL de la direccion del viento (media circular).

    Devuelve (direccion_media_en_grados, magnitud_resultante).
    Si se entrega velocidad, cada minuto se pondera por su velocidad y la
    magnitud resultante es la 'velocidad resultante' (vector medio del viento).
    """
    ang = pd.to_numeric(grados, errors="coerce")
    if velocidad is None:
        peso = pd.Series(1.0, index=ang.index)
    else:
        peso = pd.to_numeric(velocidad, errors="coerce")

    valido = ang.notna() & peso.notna()
    if not valido.any():
        return np.nan, np.nan

    rad = np.deg2rad(ang[valido].to_numpy(dtype=float))
    p = peso[valido].to_numpy(dtype=float)
    este = np.mean(p * np.sin(rad))
    norte = np.mean(p * np.cos(rad))
    direccion = float(np.degrees(np.arctan2(este, norte)) % 360.0)
    return direccion, float(np.hypot(este, norte))


def promediar_por_dia(minutos: pd.DataFrame) -> pd.DataFrame:
    """Calcula los promedios diarios por estacion."""
    datos = minutos.copy()
    datos["fecha"] = datos["fecha_hora"].dt.normalize()
    variables = [v for v in SINONIMOS if v in datos.columns]

    agregaciones = {"n_registros": ("fecha_hora", "count")}
    for var in variables:
        # Ojo: la direccion se resuelve aparte, con promedio vectorial.
        if var != "Dir":
            agregaciones[f"{var}_prom"] = (var, "mean")
        agregaciones[f"n_{var}"] = (var, "count")
    if "MP10" in variables:
        agregaciones["MP10_max"] = ("MP10", "max")
    if "Vel" in variables:
        agregaciones["Vel_max"] = ("Vel", "max")
    for var in ("Temp", "HR"):
        if var in variables:
            agregaciones[f"{var}_min"] = (var, "min")
            agregaciones[f"{var}_max"] = (var, "max")

    grupo = datos.groupby(["estacion", "ubicacion", "fecha"], dropna=False)
    diario = grupo.agg(**agregaciones).reset_index()

    # Direccion del viento: promedio vectorial, dia por dia
    if "Dir" in variables:
        usar_ponderada = PONDERAR_DIRECCION_POR_VELOCIDAD and "Vel" in variables
        filas = []
        for llave, bloque in grupo:
            unitario, _ = promedio_direccion(bloque["Dir"])
            if "Vel" in variables:
                resultante_dir, resultante_vel = promedio_direccion(bloque["Dir"], bloque["Vel"])
            else:
                resultante_dir, resultante_vel = np.nan, np.nan
            principal = resultante_dir if usar_ponderada else unitario
            filas.append({
                "estacion": llave[0], "ubicacion": llave[1], "fecha": llave[2],
                "Dir_prom": principal,
                "Dir_resultante_pond": resultante_dir,
                "Vel_resultante": resultante_vel,
            })
        diario = diario.merge(pd.DataFrame(filas), on=["estacion", "ubicacion", "fecha"], how="left")

    # Porcentaje de datos validos y validacion del dia
    minutos_dia = 1440
    for var in variables:
        diario[f"%val_{var}"] = 100.0 * diario[f"n_{var}"] / minutos_dia
    columnas_pct = [f"%val_{v}" for v in variables]
    diario["%val_dia"] = diario[columnas_pct].min(axis=1)
    diario["dia_valido"] = diario["%val_dia"] >= MIN_PORCENTAJE_VALIDO

    if "MP10" in variables:
        diario["MP10_supera_norma"] = diario["MP10_prom"] > NORMA_MP10_DIARIA

    # Indice de constancia del viento: 1 = sopla siempre en la misma direccion,
    # cerca de 0 = direccion muy variable a lo largo del dia.
    if {"Vel_resultante", "Vel_prom"} <= set(diario.columns):
        diario["indice_constancia"] = (diario["Vel_resultante"]
                                       / diario["Vel_prom"].replace(0, np.nan))

    return diario.sort_values(["estacion", "fecha"]).reset_index(drop=True)


def promediar_por_mes(diario: pd.DataFrame) -> pd.DataFrame:
    """Resumen mensual a partir de los promedios diarios."""
    datos = diario.copy()
    datos["mes"] = datos["fecha"].dt.to_period("M").astype(str)
    variables = [v for v in SINONIMOS if f"{v}_prom" in datos.columns]

    filas = []
    for (estacion, ubicacion, mes), bloque in datos.groupby(["estacion", "ubicacion", "mes"]):
        # El promedio mensual se calcula solo con los dias validos, para que un dia
        # incompleto no arrastre el resultado. Si no hay ninguno, se usan todos y
        # queda a la vista en la columna "dias_validos".
        validos = bloque[bloque["dia_valido"]]
        base = validos if not validos.empty else bloque

        fila = {
            "estacion": estacion, "ubicacion": ubicacion, "mes": mes,
            "dias_con_datos": len(bloque),
            "dias_validos": int(bloque["dia_valido"].sum()),
            "base_calculo": "dias validos" if not validos.empty else "todos los dias",
        }
        for var in variables:
            if var == "Dir":
                continue
            fila[f"{var}_prom"] = base[f"{var}_prom"].mean()
        if "Dir" in variables:
            fila["Dir_prom"] = promedio_direccion(base["Dir_prom"])[0]
        if "MP10" in variables:
            fila["MP10_max_diario"] = base["MP10_prom"].max()
            fila["dias_sobre_norma"] = int(base.get("MP10_supera_norma", pd.Series(dtype=bool)).sum())
        filas.append(fila)
    return pd.DataFrame(filas).sort_values(["estacion", "mes"]).reset_index(drop=True)


# =============================================================================
# SALIDA
# =============================================================================

def ordenar_columnas(diario: pd.DataFrame) -> pd.DataFrame:
    """Deja primero lo importante: identificacion, promedios y luego el resto."""
    variables = [v for v in SINONIMOS if f"{v}_prom" in diario.columns]
    orden = ["estacion", "ubicacion", "fecha"]
    orden += [f"{v}_prom" for v in variables]
    orden += [c for c in ("MP10_max", "Vel_max", "Temp_min", "Temp_max", "HR_min", "HR_max",
                          "Vel_resultante", "Dir_resultante_pond", "indice_constancia")
              if c in diario.columns]
    orden += ["n_registros"] + [f"%val_{v}" for v in variables] + ["%val_dia", "dia_valido"]
    if "MP10_supera_norma" in diario.columns:
        orden.append("MP10_supera_norma")
    orden += [c for c in diario.columns if c not in orden and not c.startswith("n_")]
    return diario[[c for c in orden if c in diario.columns]]


def redondear(tabla: pd.DataFrame) -> pd.DataFrame:
    tabla = tabla.copy()
    for columna in tabla.columns:
        if not pd.api.types.is_numeric_dtype(tabla[columna]) or pd.api.types.is_bool_dtype(tabla[columna]):
            continue
        decimales = 1
        for var, dec in DECIMALES.items():
            if columna.startswith(var):
                decimales = dec
                break
        if columna.startswith("%") or columna.startswith("indice"):
            decimales = 2
        if columna.startswith("n_") or columna.startswith("dias"):
            continue
        tabla[columna] = tabla[columna].round(decimales)
    return tabla


def renombrar_con_unidades(tabla: pd.DataFrame) -> pd.DataFrame:
    """Agrega las unidades al titulo de cada columna, para que la planilla se entienda sola."""
    nuevos = {}
    for columna in tabla.columns:
        if (pd.api.types.is_bool_dtype(tabla[columna]) or columna.startswith(("%", "n_", "dias"))
                or "supera" in columna or "valido" in columna or "constancia" in columna):
            continue
        for var, unidad in UNIDADES.items():
            if columna.startswith(var + "_") or columna == var:
                nuevos[columna] = f"{columna} [{unidad}]"
                break
    if "Vel_resultante" in tabla.columns:
        nuevos["Vel_resultante"] = "Vel_resultante [m/s]"
    return tabla.rename(columns=nuevos)


def escribir_salida(ruta: Path, diario: pd.DataFrame, mensual: pd.DataFrame,
                    detalle: pd.DataFrame) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)

    diario_fmt = renombrar_con_unidades(redondear(ordenar_columnas(diario)))
    mensual_fmt = renombrar_con_unidades(redondear(mensual))

    with pd.ExcelWriter(ruta, engine="openpyxl", datetime_format="yyyy-mm-dd") as writer:
        diario_fmt.to_excel(writer, sheet_name="Promedios diarios", index=False)
        mensual_fmt.to_excel(writer, sheet_name="Resumen mensual", index=False)
        detalle.to_excel(writer, sheet_name="Archivos procesados", index=False)
        for nombre, tabla in (("Promedios diarios", diario_fmt),
                              ("Resumen mensual", mensual_fmt),
                              ("Archivos procesados", detalle)):
            hoja = writer.sheets[nombre]
            hoja.freeze_panes = "A2"
            for i, columna in enumerate(tabla.columns, start=1):
                ancho = max(len(str(columna)), 12) + 2
                hoja.column_dimensions[hoja.cell(row=1, column=i).column_letter].width = min(ancho, 28)

    csv = ruta.with_suffix(".csv")
    diario_fmt.to_csv(csv, index=False, encoding="utf-8-sig")
    log(f"\n  Excel : {ruta}")
    log(f"  CSV   : {csv}")


# =============================================================================
# PROGRAMA PRINCIPAL
# =============================================================================

def juntar_archivos(rutas: list[Path]) -> tuple[pd.DataFrame, pd.DataFrame]:
    tablas, detalles = [], []
    for ruta in sorted(rutas):
        log(f"  - {ruta.name}")
        try:
            datos, meta = leer_archivo(ruta)
        except Exception as error:                      # noqa: BLE001
            log(f"    [X] No se pudo leer: {error}")
            detalles.append({"archivo": ruta.name, "estado": f"ERROR: {error}"})
            continue
        log(f"    OK  estacion '{meta['estacion']}' | {meta['registros']} registros "
            f"| {meta['desde']:%Y-%m-%d} a {meta['hasta']:%Y-%m-%d}")
        tablas.append(datos)
        detalles.append({
            "archivo": meta["archivo"], "hoja": meta["hoja"], "estacion": meta["estacion"],
            "ubicacion": meta["ubicacion"], "variables": meta["variables"],
            "registros": meta["registros"],
            "desde": meta["desde"], "hasta": meta["hasta"], "estado": "OK",
        })

    if not tablas:
        raise SystemExit("\nNo se pudo leer ningun archivo. Revisa el formato de los Excel.")

    minutos = pd.concat(tablas, ignore_index=True)
    antes = len(minutos)
    minutos = (minutos.sort_values(["estacion", "fecha_hora"])
                      .drop_duplicates(subset=["estacion", "fecha_hora"], keep="last")
                      .reset_index(drop=True))
    repetidos = antes - len(minutos)
    if repetidos:
        log(f"\n  [!] Se eliminaron {repetidos} registros repetidos (meses solapados).")
    return minutos, pd.DataFrame(detalles)


def buscar_archivos(entrada: Path, excluir: Path | None = None) -> list[Path]:
    if entrada.is_file():
        return [entrada]
    excluidos = set()
    if excluir is not None:
        excluidos = {excluir.resolve(), excluir.with_suffix(".csv").resolve()}
    return [p for p in sorted(entrada.rglob("*"))
            if p.suffix.lower() in EXTENSIONES
            and not p.name.startswith("~$")
            and p.resolve() not in excluidos]


def main(argv: list[str] | None = None) -> int:
    global MIN_PORCENTAJE_VALIDO, PONDERAR_DIRECCION_POR_VELOCIDAD

    parser = argparse.ArgumentParser(
        description="Consolida los Excel mensuales de la estacion en promedios diarios.")
    parser.add_argument("archivos", nargs="*", help="Excel sueltos a procesar (opcional).")
    parser.add_argument("-e", "--entrada", default=CARPETA_ENTRADA,
                        help=f"Carpeta con los Excel (por defecto: {CARPETA_ENTRADA}).")
    parser.add_argument("-s", "--salida", default=ARCHIVO_SALIDA,
                        help=f"Archivo Excel de salida (por defecto: {ARCHIVO_SALIDA}).")
    parser.add_argument("--min-validos", type=float, default=MIN_PORCENTAJE_VALIDO,
                        help="%% minimo de minutos validos para dar el dia por bueno.")
    parser.add_argument("--dir-ponderada", action="store_true",
                        help="Ponderar la direccion del viento por la velocidad.")
    args = parser.parse_args(argv)

    MIN_PORCENTAJE_VALIDO = args.min_validos
    PONDERAR_DIRECCION_POR_VELOCIDAD = args.dir_ponderada

    raiz = Path(__file__).resolve().parent
    salida = Path(args.salida)
    salida = salida if salida.is_absolute() else raiz / salida

    if args.archivos:
        rutas = [Path(a) if Path(a).is_absolute() else raiz / a for a in args.archivos]
    else:
        entrada = Path(args.entrada)
        entrada = entrada if entrada.is_absolute() else raiz / entrada
        if not entrada.exists():
            entrada.mkdir(parents=True, exist_ok=True)
            log(f"Se creo la carpeta '{entrada}'.\nDeja ahi los Excel y vuelve a ejecutar.")
            return 1
        rutas = buscar_archivos(entrada, excluir=salida)
        if not rutas:
            log(f"No hay archivos {' / '.join(EXTENSIONES)} en '{entrada}'.")
            return 1

    log("=" * 70)
    log(" CONSOLIDADOR DE DATOS METEOROLOGICOS")
    log("=" * 70)
    log(f"\nLeyendo {len(rutas)} archivo(s):")

    minutos, detalle = juntar_archivos(rutas)
    log(f"\nTotal de registros minuto a minuto: {len(minutos):,}")

    diario = promediar_por_dia(minutos)
    mensual = promediar_por_mes(diario)
    log(f"Dias consolidados: {len(diario)}  "
        f"(validos con >= {MIN_PORCENTAJE_VALIDO:.0f}%: {int(diario['dia_valido'].sum())})")
    log(f"Meses consolidados: {len(mensual)}")

    escribir_salida(salida, diario, mensual, detalle)

    log("\nVista previa de los promedios diarios:")
    vista = ordenar_columnas(redondear(diario))
    columnas = [c for c in vista.columns if c.endswith("_prom") or c in ("fecha", "estacion", "%val_dia")]
    with pd.option_context("display.width", 140, "display.max_columns", 20):
        log(vista[columnas].head(10).to_string(index=False))
    log("\nListo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
