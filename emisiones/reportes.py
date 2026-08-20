"""
reportes.py
Salidas del inventario: resumen de texto, CSV, JSON y reporte HTML.

También importa datos de actividad desde CSV, para quien prefiera cargar el
consumo mensual en una planilla en vez de tipearlo en la aplicación.
"""
from __future__ import annotations
from typing import Dict, List, Optional
import csv
import datetime
import html
import json
import os

from .calculo import ResultadoInventario, nombre_alcance
from .factores import NOMBRES_GAS, CatalogoFactores
from .modelo import Actividad, Inventario


COLUMNAS_CSV = [
    "id", "descripcion", "factor_id", "factor", "alcance", "categoria",
    "cantidad", "unidad", "cantidad_convertida", "unidad_factor",
    "factor_kgco2e_unidad", "kg_co2e", "t_co2e", "co2_biogenico_kg",
    "periodo", "area", "notas", "fuente_factor", "verificar", "error",
]

COLUMNAS_PLANTILLA = ["descripcion", "factor_id", "cantidad", "unidad",
                      "periodo", "area", "notas"]


# ─────────────────────────────────────────────
# Formato numérico
# ─────────────────────────────────────────────

def _num(valor: float, decimales: int = 3, decimal: str = ",") -> str:
    texto = f"{valor:.{decimales}f}"
    return texto.replace(".", decimal) if decimal != "." else texto


def _miles(valor: float, decimales: int = 2) -> str:
    """1234.5 → '1.234,50' (formato es-CL)."""
    texto = f"{valor:,.{decimales}f}"
    return texto.replace(",", "@").replace(".", ",").replace("@", ".")


# ─────────────────────────────────────────────
# Filas de detalle
# ─────────────────────────────────────────────

def filas_detalle(res: ResultadoInventario) -> List[Dict[str, object]]:
    """Una fila por actividad, con el cálculo desarrollado."""
    filas: List[Dict[str, object]] = []
    for r in res.resultados:
        f = r.factor
        filas.append({
            "id": r.actividad.id,
            "descripcion": r.actividad.descripcion,
            "factor_id": r.actividad.factor_id,
            "factor": f.nombre if f else "",
            "alcance": f.alcance if f else "",
            "categoria": f.categoria if f else "",
            "cantidad": r.actividad.cantidad,
            "unidad": r.actividad.unidad,
            "cantidad_convertida": r.cantidad_convertida,
            "unidad_factor": f.unidad if f else "",
            "factor_kgco2e_unidad": f.co2e_unitario() if f else "",
            "kg_co2e": r.kg_co2e,
            "t_co2e": r.t_co2e,
            "co2_biogenico_kg": r.kg_co2_biogenico,
            "periodo": r.actividad.periodo,
            "area": r.actividad.area,
            "notas": r.actividad.notas,
            "fuente_factor": f.fuente if f else "",
            "verificar": "sí" if (f and f.verificar) else "no",
            "error": r.error,
        })
    return filas


# ─────────────────────────────────────────────
# Resumen de texto (consola y pestaña Reporte)
# ─────────────────────────────────────────────

def resumen_texto(res: ResultadoInventario, ancho: int = 74) -> str:
    inv = res.inventario
    lineas: List[str] = []
    sep = "─" * ancho

    lineas.append(sep)
    lineas.append("INVENTARIO DE EMISIONES DE GASES DE EFECTO INVERNADERO".center(ancho))
    lineas.append(sep)
    if inv.organizacion:
        lineas.append(f"Organización : {inv.organizacion}")
    if inv.instalacion:
        lineas.append(f"Instalación  : {inv.instalacion}")
    if inv.periodo:
        lineas.append(f"Período      : {inv.periodo}")
    if inv.responsable:
        lineas.append(f"Responsable  : {inv.responsable}")
    lineas.append(f"Emitido      : {datetime.datetime.now():%Y-%m-%d %H:%M}")
    lineas.append(f"Actividades  : {len(res.resultados)}")
    lineas.append("")

    lineas.append(f"TOTAL: {_miles(res.t_co2e, 3)} t CO₂e "
                  f"({_miles(res.kg_co2e)} kg CO₂e)")
    if res.kg_co2_biogenico:
        lineas.append(f"CO₂ biogénico (se informa aparte): "
                      f"{_miles(res.kg_co2_biogenico)} kg")
    lineas.append("")

    lineas.append("EMISIONES POR ALCANCE")
    lineas.append(sep)
    for alcance, kg in res.por_alcance().items():
        if alcance == 0 and not kg:
            continue
        lineas.append(f"  {nombre_alcance(alcance):<48} "
                      f"{_miles(kg / 1000, 3):>12} t  {res.participacion(kg):5.1f}%")
    lineas.append("")

    lineas.append("EMISIONES POR CATEGORÍA")
    lineas.append(sep)
    for categoria, kg in res.por_categoria().items():
        lineas.append(f"  {categoria:<48} "
                      f"{_miles(kg / 1000, 3):>12} t  {res.participacion(kg):5.1f}%")
    lineas.append("")

    areas = res.por_area()
    if len(areas) > 1:
        lineas.append("EMISIONES POR ÁREA")
        lineas.append(sep)
        for area, kg in areas.items():
            lineas.append(f"  {area:<48} "
                          f"{_miles(kg / 1000, 3):>12} t  {res.participacion(kg):5.1f}%")
        lineas.append("")

    periodos = res.por_periodo()
    if len(periodos) > 1:
        lineas.append("EMISIONES POR PERÍODO")
        lineas.append(sep)
        for periodo, kg in periodos.items():
            lineas.append(f"  {periodo:<48} {_miles(kg / 1000, 3):>12} t")
        lineas.append("")

    lineas.append("EMISIONES POR GAS (en CO₂e)")
    lineas.append(sep)
    for gas, kg in res.por_gas().items():
        lineas.append(f"  {NOMBRES_GAS.get(gas, gas):<48} "
                      f"{_miles(kg / 1000, 3):>12} t  {res.participacion(kg):5.1f}%")
    lineas.append("")

    top = res.ranking(10)
    if top:
        lineas.append("PRINCIPALES FUENTES")
        lineas.append(sep)
        for i, r in enumerate(top, 1):
            etiqueta = r.actividad.descripcion or (r.factor.nombre if r.factor else r.actividad.factor_id)
            lineas.append(f"  {i:>2}. {etiqueta[:44]:<44} "
                          f"{_miles(r.t_co2e, 3):>12} t  {res.participacion(r.kg_co2e):5.1f}%")
        lineas.append("")

    verificar = res.requieren_verificacion
    if verificar:
        ids = sorted({r.factor.id for r in verificar if r.factor})
        lineas.append("⚠ FACTORES REFERENCIALES POR VERIFICAR")
        lineas.append(sep)
        lineas.append("  Estos factores traen un valor por defecto. Reemplácelos por el")
        lineas.append("  dato de su proveedor o del organismo oficial antes de reportar:")
        for fid in ids:
            lineas.append(f"    · {fid}")
        lineas.append("")

    if res.errores:
        lineas.append("✗ ACTIVIDADES CON ERROR (excluidas del total)")
        lineas.append(sep)
        for r in res.errores:
            etiqueta = r.actividad.descripcion or r.actividad.id
            lineas.append(f"  · {etiqueta}: {r.error}")
        lineas.append("")

    lineas.append(sep)
    lineas.append("GWP-100 IPCC AR6. Metodología: GHG Protocol Corporate Standard.")
    lineas.append(sep)
    return "\n".join(lineas)


# ─────────────────────────────────────────────
# Exportación
# ─────────────────────────────────────────────

def exportar_csv(res: ResultadoInventario, ruta: str,
                 separador: str = ";", decimal: str = ",") -> str:
    """Detalle por actividad en CSV (UTF-8 con BOM, abre directo en Excel)."""
    filas = filas_detalle(res)
    with open(ruta, "w", encoding="utf-8-sig", newline="") as fh:
        escritor = csv.DictWriter(fh, fieldnames=COLUMNAS_CSV, delimiter=separador)
        escritor.writeheader()
        for fila in filas:
            salida = dict(fila)
            for col in ("cantidad", "cantidad_convertida", "factor_kgco2e_unidad",
                        "kg_co2e", "t_co2e", "co2_biogenico_kg"):
                if isinstance(salida[col], (int, float)):
                    salida[col] = _num(float(salida[col]), 6, decimal)
            escritor.writerow(salida)
    return ruta


def exportar_json(res: ResultadoInventario, ruta: str) -> str:
    """Inventario, totales y detalle en JSON (para integrar con otros sistemas)."""
    datos = {
        "tipo": "reporte_emisiones",
        "version": 1,
        "generado": datetime.datetime.now().isoformat(timespec="seconds"),
        "gwp": "IPCC AR6 (100 años)",
        "inventario": res.inventario.a_dict(),
        "totales": {
            "kg_co2e": res.kg_co2e,
            "t_co2e": res.t_co2e,
            "kg_co2_biogenico": res.kg_co2_biogenico,
            "por_alcance": {str(k): v for k, v in res.por_alcance().items()},
            "por_categoria": res.por_categoria(),
            "por_area": res.por_area(),
            "por_periodo": res.por_periodo(),
            "por_gas": res.por_gas(),
        },
        "detalle": filas_detalle(res),
        "errores": [{"id": r.actividad.id, "error": r.error} for r in res.errores],
    }
    with open(ruta, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=2)
    return ruta


def _barras_html(datos: Dict[object, float], total: float,
                 etiquetar=lambda k: str(k)) -> str:
    if not datos or not total:
        return "<p class='vacio'>Sin datos.</p>"
    maximo = max(datos.values()) or 1.0
    filas = []
    for clave, kg in datos.items():
        ancho = max(kg / maximo * 100.0, 0.4)
        pct = kg / total * 100.0
        filas.append(
            "<div class='barra-fila'>"
            f"<div class='barra-etq'>{html.escape(etiquetar(clave))}</div>"
            f"<div class='barra-pista'><div class='barra' style='width:{ancho:.2f}%'></div></div>"
            f"<div class='barra-val'>{_miles(kg / 1000, 3)} t<span>{pct:.1f}%</span></div>"
            "</div>"
        )
    return "".join(filas)


def exportar_html(res: ResultadoInventario, ruta: str) -> str:
    """Reporte HTML autocontenido: se abre en cualquier navegador y se imprime a PDF."""
    inv = res.inventario
    total = res.kg_co2e

    encabezado = [("Organización", inv.organizacion), ("Instalación", inv.instalacion),
                  ("Período", inv.periodo), ("Responsable", inv.responsable)]
    meta = "".join(
        f"<div><span>{html.escape(k)}</span><strong>{html.escape(v)}</strong></div>"
        for k, v in encabezado if v
    )

    filas_tabla = []
    for r in sorted(res.resultados, key=lambda x: -x.kg_co2e):
        f = r.factor
        clase = " class='error'" if not r.ok else ""
        filas_tabla.append(
            f"<tr{clase}>"
            f"<td>{html.escape(r.actividad.descripcion or r.actividad.id)}</td>"
            f"<td>{f.alcance if f else '—'}</td>"
            f"<td>{html.escape(f.categoria if f else '—')}</td>"
            f"<td class='n'>{_miles(r.actividad.cantidad, 2)} {html.escape(r.actividad.unidad)}</td>"
            f"<td class='n'>{_num(f.co2e_unitario(), 4) if f else '—'}</td>"
            f"<td class='n'>{_miles(r.t_co2e, 4)}</td>"
            f"<td class='n'>{res.participacion(r.kg_co2e):.1f}%</td>"
            f"<td>{html.escape(r.error)}</td>"
            "</tr>"
        )

    avisos = []
    ids_verificar = sorted({r.factor.id for r in res.requieren_verificacion if r.factor})
    if ids_verificar:
        avisos.append(
            "<div class='aviso'><strong>Factores referenciales por verificar.</strong> "
            "Los siguientes factores usan un valor por defecto de la aplicación; "
            "reemplácelos por el dato de su proveedor o del organismo oficial "
            "antes de usar este reporte con fines externos: "
            + ", ".join(f"<code>{html.escape(x)}</code>" for x in ids_verificar) + ".</div>"
        )
    if res.errores:
        avisos.append(
            f"<div class='aviso error'><strong>{len(res.errores)} actividad(es) con error</strong> "
            "quedaron fuera del total. Revíselas al final de la tabla de detalle.</div>"
        )
    if res.kg_co2_biogenico:
        avisos.append(
            "<div class='aviso'><strong>CO₂ biogénico: "
            f"{_miles(res.kg_co2_biogenico)} kg.</strong> Se informa por separado "
            "y no forma parte de los alcances 1, 2 ni 3.</div>"
        )

    documento = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inventario de emisiones{(' — ' + html.escape(inv.organizacion)) if inv.organizacion else ''}</title>
<style>
  :root {{
    --tinta:#12222b; --suave:#5b7280; --linea:#dfe6ea; --fondo:#f5f7f8;
    --acento:#0f7b6c; --a1:#c0392b; --a2:#e08a1e; --a3:#2b6cb0;
  }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; padding:32px; background:var(--fondo); color:var(--tinta);
         font:15px/1.5 "Segoe UI",system-ui,-apple-system,Roboto,sans-serif; }}
  main {{ max-width:1040px; margin:0 auto; background:#fff; padding:40px;
          border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,.08); }}
  h1 {{ font-size:26px; margin:0 0 4px; }}
  h2 {{ font-size:17px; margin:36px 0 12px; padding-bottom:6px;
        border-bottom:2px solid var(--linea); }}
  .sub {{ color:var(--suave); margin:0 0 24px; font-size:14px; }}
  .meta {{ display:flex; flex-wrap:wrap; gap:20px 40px; padding:16px 0;
           border-top:1px solid var(--linea); border-bottom:1px solid var(--linea); }}
  .meta span {{ display:block; font-size:11px; text-transform:uppercase;
                letter-spacing:.06em; color:var(--suave); }}
  .total {{ margin:28px 0; padding:24px; background:var(--acento); color:#fff;
            border-radius:8px; }}
  .total .cifra {{ font-size:40px; font-weight:700; line-height:1.1; }}
  .total .pie {{ opacity:.85; font-size:14px; margin-top:4px; }}
  .tarjetas {{ display:flex; flex-wrap:wrap; gap:14px; margin:20px 0; }}
  .tarjeta {{ flex:1 1 200px; border:1px solid var(--linea); border-radius:8px;
              padding:16px; border-left:5px solid var(--acento); }}
  .tarjeta.a1 {{ border-left-color:var(--a1); }}
  .tarjeta.a2 {{ border-left-color:var(--a2); }}
  .tarjeta.a3 {{ border-left-color:var(--a3); }}
  .tarjeta h3 {{ margin:0 0 6px; font-size:12px; text-transform:uppercase;
                 letter-spacing:.05em; color:var(--suave); }}
  .tarjeta .v {{ font-size:24px; font-weight:700; }}
  .tarjeta .p {{ color:var(--suave); font-size:13px; }}
  .barra-fila {{ display:flex; align-items:center; gap:12px; margin:7px 0; }}
  .barra-etq {{ flex:0 0 230px; font-size:13px; }}
  .barra-pista {{ flex:1; background:var(--fondo); border-radius:4px; height:18px; }}
  .barra {{ height:18px; border-radius:4px; background:var(--acento); }}
  .barra-val {{ flex:0 0 130px; text-align:right; font-size:13px;
                font-variant-numeric:tabular-nums; }}
  .barra-val span {{ color:var(--suave); margin-left:8px; }}
  table {{ width:100%; border-collapse:collapse; margin-top:10px; font-size:13px; }}
  th,td {{ padding:8px 10px; border-bottom:1px solid var(--linea); text-align:left;
           vertical-align:top; }}
  th {{ background:var(--fondo); font-size:11px; text-transform:uppercase;
        letter-spacing:.05em; color:var(--suave); }}
  td.n {{ text-align:right; font-variant-numeric:tabular-nums; }}
  tr.error td {{ background:#fdf1f0; color:#a03027; }}
  .aviso {{ margin:14px 0; padding:12px 16px; border-radius:6px;
            background:#fff8e6; border-left:4px solid var(--a2); font-size:13.5px; }}
  .aviso.error {{ background:#fdf1f0; border-left-color:var(--a1); }}
  .vacio {{ color:var(--suave); font-style:italic; }}
  footer {{ margin-top:36px; padding-top:14px; border-top:1px solid var(--linea);
            color:var(--suave); font-size:12px; }}
  code {{ background:var(--fondo); padding:1px 5px; border-radius:3px; font-size:12px; }}
  @media print {{ body {{ padding:0; background:#fff; }}
                  main {{ box-shadow:none; padding:0; }} }}
</style>
</head>
<body>
<main>
  <h1>Inventario de emisiones de GEI</h1>
  <p class="sub">Calculadora de emisiones · GWP-100 IPCC AR6 · metodología GHG Protocol</p>
  <div class="meta">{meta}
    <div><span>Generado</span><strong>{datetime.datetime.now():%d-%m-%Y %H:%M}</strong></div>
    <div><span>Actividades</span><strong>{len(res.resultados)}</strong></div>
  </div>

  <div class="total">
    <div class="cifra">{_miles(res.t_co2e, 3)} t CO₂e</div>
    <div class="pie">{_miles(res.kg_co2e)} kg CO₂e — total alcances 1 + 2 + 3</div>
  </div>

  <div class="tarjetas">
    {''.join(
        f'<div class="tarjeta a{a}"><h3>Alcance {a}</h3>'
        f'<div class="v">{_miles(kg / 1000, 3)} t</div>'
        f'<div class="p">{res.participacion(kg):.1f}% del total</div></div>'
        for a, kg in res.por_alcance().items() if a in (1, 2, 3)
    )}
  </div>

  {''.join(avisos)}

  <h2>Emisiones por categoría</h2>
  {_barras_html(res.por_categoria(), total)}

  <h2>Emisiones por gas (expresadas en CO₂e)</h2>
  {_barras_html(res.por_gas(), total, lambda g: NOMBRES_GAS.get(str(g), str(g)))}

  <h2>Emisiones por área</h2>
  {_barras_html(res.por_area(), total)}

  <h2>Detalle por actividad</h2>
  <table>
    <thead><tr>
      <th>Actividad</th><th>Alc.</th><th>Categoría</th><th>Cantidad</th>
      <th>kg CO₂e/unidad</th><th>t CO₂e</th><th>%</th><th>Observación</th>
    </tr></thead>
    <tbody>{''.join(filas_tabla)}</tbody>
  </table>

  <footer>
    Los factores de emisión de combustión se derivan de los parámetros por defecto
    del IPCC 2006 (poder calorífico inferior, densidad y kg de gas por TJ).
    Los potenciales de calentamiento global corresponden al IPCC AR6, horizonte 100 años.
    Los factores marcados como referenciales deben reemplazarse por datos propios
    antes de usar este reporte con fines externos.
  </footer>
</main>
</body>
</html>"""

    with open(ruta, "w", encoding="utf-8") as fh:
        fh.write(documento)
    return ruta


def exportar_factores_csv(catalogo: CatalogoFactores, ruta: str,
                          separador: str = ";", decimal: str = ",") -> str:
    """Catálogo de factores en CSV, para revisarlo o ajustarlo en planilla."""
    with open(ruta, "w", encoding="utf-8-sig", newline="") as fh:
        escritor = csv.writer(fh, delimiter=separador)
        escritor.writerow(["id", "nombre", "alcance", "categoria", "unidad",
                           "kg_co2e_por_unidad", "gases", "co2_biogenico",
                           "fuente", "verificar", "notas"])
        for f in catalogo.listar():
            escritor.writerow([
                f.id, f.nombre, f.alcance, f.categoria, f.unidad,
                _num(f.co2e_unitario(), 6, decimal),
                "; ".join(f"{g}={_num(v, 8, decimal)}" for g, v in f.gases.items()),
                _num(f.co2_biogenico, 6, decimal),
                f.fuente, "sí" if f.verificar else "no", f.notas,
            ])
    return ruta


# ─────────────────────────────────────────────
# Importación desde CSV
# ─────────────────────────────────────────────

def plantilla_csv(ruta: str, catalogo: Optional[CatalogoFactores] = None,
                  separador: str = ";") -> str:
    """Escribe una plantilla CSV con ejemplos y la lista de factores disponibles."""
    cat = catalogo or CatalogoFactores()
    ejemplos = [
        ["Diésel calderas", "diesel_estacionario_L", "1250", "L", "2026-05", "Calderas", ""],
        ["Electricidad planta", "electricidad_sen", "180", "MWh", "2026-05", "Planta", ""],
        ["Recarga R-404A", "ref_r404a", "12", "kg", "2026-05", "Sala de frío", ""],
        ["Agua de pozo", "agua_potable_m3", "34500", "m3", "2026-05", "Tratamiento", ""],
    ]
    with open(ruta, "w", encoding="utf-8-sig", newline="") as fh:
        escritor = csv.writer(fh, delimiter=separador)
        escritor.writerow(COLUMNAS_PLANTILLA)
        for fila in ejemplos:
            escritor.writerow(fila)
        escritor.writerow([])
        escritor.writerow(["# Reemplace los ejemplos por sus datos. "
                           "Use uno de los factor_id siguientes:"])
        for f in cat.listar():
            escritor.writerow([f"# {f.id}", f.nombre, f"unidad: {f.unidad}",
                               f"alcance {f.alcance}", f.categoria])
    return ruta


def importar_csv(ruta: str, separador: Optional[str] = None) -> Inventario:
    """
    Lee actividades desde un CSV con las columnas de `COLUMNAS_PLANTILLA`.

    Acepta separador ';' o ',' (autodetectado) y decimales con coma o punto.
    Las líneas que empiezan con '#' y las vacías se ignoran.
    """
    with open(ruta, "r", encoding="utf-8-sig", newline="") as fh:
        texto = fh.read()

    if separador is None:
        cabecera = texto.splitlines()[0] if texto.splitlines() else ""
        separador = ";" if cabecera.count(";") >= cabecera.count(",") else ","

    inventario = Inventario(periodo="")
    lector = csv.DictReader(texto.splitlines(), delimiter=separador)
    for fila in lector:
        if not fila:
            continue
        descripcion = (fila.get("descripcion") or "").strip()
        factor_id = (fila.get("factor_id") or "").strip()
        if not factor_id or descripcion.startswith("#") or factor_id.startswith("#"):
            continue
        crudo = (fila.get("cantidad") or "").strip()
        if not crudo:
            continue
        normalizado = crudo.replace(" ", "")
        if "," in normalizado and "." in normalizado:
            normalizado = normalizado.replace(".", "").replace(",", ".")
        else:
            normalizado = normalizado.replace(",", ".")
        try:
            cantidad = float(normalizado)
        except ValueError:
            continue
        inventario.agregar(Actividad(
            descripcion=descripcion,
            factor_id=factor_id,
            cantidad=cantidad,
            unidad=(fila.get("unidad") or "").strip(),
            periodo=(fila.get("periodo") or "").strip(),
            area=(fila.get("area") or "").strip(),
            notas=(fila.get("notas") or "").strip(),
        ))

    periodos = inventario.periodos()
    if len(periodos) == 1:
        inventario.periodo = periodos[0]
    inventario.notas = f"Importado desde {os.path.basename(ruta)}"
    return inventario
