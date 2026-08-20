"""
cli.py
Interfaz de línea de comandos de la calculadora de emisiones.

    emisiones                          → abre la interfaz gráfica
    emisiones interactivo              → ingreso de datos guiado en la consola
    emisiones calcular datos.csv       → calcula y muestra el reporte
    emisiones factores --buscar diesel → consulta el catálogo
    emisiones plantilla datos.csv      → genera una plantilla para llenar
"""
from __future__ import annotations
from typing import List, Optional
import argparse
import os
import sys

from .calculo import calcular_inventario, formatear
from .factores import CatalogoFactores, NOMBRES_GAS, catalogo_por_defecto
from .modelo import Actividad, Inventario
from . import reportes
from . import unidades

VERSION = "1.0.0"


# ─────────────────────────────────────────────
# Utilidades de consola
# ─────────────────────────────────────────────

def _preguntar(texto: str, defecto: str = "") -> str:
    sufijo = f" [{defecto}]" if defecto else ""
    try:
        respuesta = input(f"{texto}{sufijo}: ").strip()
    except EOFError:
        return defecto
    return respuesta or defecto


def _preguntar_numero(texto: str) -> Optional[float]:
    while True:
        crudo = _preguntar(texto)
        if not crudo:
            return None
        try:
            return float(crudo.replace(",", "."))
        except ValueError:
            print("  ✗ Ingrese un número (ej: 1250 o 1250,5). Enter para cancelar.")


def _elegir(opciones: List[str], titulo: str) -> Optional[int]:
    """Menú numerado. Devuelve el índice elegido o None si se cancela."""
    print(f"\n{titulo}")
    for i, opcion in enumerate(opciones, 1):
        print(f"  {i:>3}. {opcion}")
    while True:
        crudo = _preguntar("Número (Enter para cancelar)")
        if not crudo:
            return None
        if crudo.isdigit() and 1 <= int(crudo) <= len(opciones):
            return int(crudo) - 1
        print("  ✗ Opción fuera de rango.")


def _cargar_entrada(ruta: str) -> Inventario:
    """Abre un inventario .json o un CSV de actividades."""
    if not os.path.isfile(ruta):
        raise SystemExit(f"✗ No existe el archivo: {ruta}")
    if ruta.lower().endswith(".json"):
        return Inventario.cargar(ruta)
    return reportes.importar_csv(ruta)


# ─────────────────────────────────────────────
# Comando: factores
# ─────────────────────────────────────────────

def cmd_factores(args) -> int:
    catalogo = catalogo_por_defecto(args.catalogo)
    lista = catalogo.listar(alcance=args.alcance, buscar=args.buscar)

    if args.exportar:
        if args.exportar.lower().endswith(".json"):
            catalogo.guardar(args.exportar)
        else:
            reportes.exportar_factores_csv(catalogo, args.exportar)
        print(f"✓ Catálogo exportado a {args.exportar}")
        return 0

    if not lista:
        print("Sin factores que coincidan con el filtro.")
        return 0

    categoria_actual = ""
    for f in lista:
        if f.categoria != categoria_actual:
            categoria_actual = f.categoria
            print(f"\n── Alcance {f.alcance} · {categoria_actual} "
                  f"{'─' * max(2, 46 - len(categoria_actual))}")
        marca = " ⚠" if f.verificar else ""
        print(f"  {f.id:<26} {f.co2e_unitario():>12.5f} kg CO₂e/{f.unidad:<6} {f.nombre}{marca}")
        if args.detalle:
            gases = ", ".join(f"{NOMBRES_GAS.get(g, g)}: {v:.6g} kg/{f.unidad}"
                              for g, v in f.gases.items())
            print(f"      gases  : {gases}")
            if f.fuente:
                print(f"      fuente : {f.fuente}")
            if f.notas:
                print(f"      nota   : {f.notas}")

    print(f"\n{len(lista)} factor(es). ⚠ = valor referencial, verifíquelo antes de reportar.")
    return 0


# ─────────────────────────────────────────────
# Comando: plantilla
# ─────────────────────────────────────────────

def cmd_plantilla(args) -> int:
    catalogo = catalogo_por_defecto(args.catalogo)
    reportes.plantilla_csv(args.salida, catalogo)
    print(f"✓ Plantilla creada: {args.salida}")
    print("  Llénela con sus consumos y luego ejecute:")
    print(f"    emisiones calcular {args.salida}")
    return 0


# ─────────────────────────────────────────────
# Comando: calcular
# ─────────────────────────────────────────────

def cmd_calcular(args) -> int:
    catalogo = catalogo_por_defecto(args.catalogo)
    inventario = _cargar_entrada(args.entrada)
    if args.organizacion:
        inventario.organizacion = args.organizacion
    if args.periodo:
        inventario.periodo = args.periodo

    resultado = calcular_inventario(inventario, catalogo)
    print(reportes.resumen_texto(resultado))

    if args.csv:
        reportes.exportar_csv(resultado, args.csv)
        print(f"✓ Detalle CSV: {args.csv}")
    if args.html:
        reportes.exportar_html(resultado, args.html)
        print(f"✓ Reporte HTML: {args.html}")
    if args.json:
        reportes.exportar_json(resultado, args.json)
        print(f"✓ Reporte JSON: {args.json}")
    if args.guardar:
        inventario.guardar(args.guardar)
        print(f"✓ Inventario guardado: {args.guardar}")

    return 1 if resultado.errores and args.estricto else 0


# ─────────────────────────────────────────────
# Comando: interactivo
# ─────────────────────────────────────────────

def cmd_interactivo(args) -> int:
    catalogo = catalogo_por_defecto(args.catalogo)

    print("═" * 66)
    print("  CALCULADORA DE EMISIONES — ingreso de datos".center(66))
    print("═" * 66)

    if args.entrada and os.path.isfile(args.entrada):
        inventario = _cargar_entrada(args.entrada)
        print(f"\nInventario cargado: {len(inventario.actividades)} actividad(es).")
    else:
        inventario = Inventario()
        inventario.organizacion = _preguntar("\nOrganización", "Mi empresa")
        inventario.instalacion = _preguntar("Instalación / planta")
        inventario.periodo = _preguntar("Período (ej: 2026-05)")
        inventario.responsable = _preguntar("Responsable")

    while True:
        opcion = _elegir(
            ["Agregar dato de actividad",
             "Ver actividades cargadas",
             "Eliminar una actividad",
             "Calcular y ver el reporte",
             "Guardar y salir"],
            f"── Menú ── ({len(inventario.actividades)} actividad(es) cargada(s))",
        )
        if opcion is None or opcion == 4:
            break

        if opcion == 0:
            _agregar_interactivo(inventario, catalogo)

        elif opcion == 1:
            if not inventario.actividades:
                print("\n  (todavía no hay actividades)")
            else:
                print()
                for a in inventario.actividades:
                    print(f"  {a.id}  {a.descripcion[:34]:<34} "
                          f"{a.cantidad:>12,.2f} {a.unidad:<6} {a.factor_id}")

        elif opcion == 2:
            if not inventario.actividades:
                print("\n  (nada que eliminar)")
                continue
            etiquetas = [f"{a.descripcion or a.id} — {a.cantidad} {a.unidad}"
                         for a in inventario.actividades]
            indice = _elegir(etiquetas, "¿Cuál elimina?")
            if indice is not None:
                eliminada = inventario.actividades[indice]
                inventario.eliminar(eliminada.id)
                print(f"  ✓ Eliminada: {eliminada.descripcion or eliminada.id}")

        elif opcion == 3:
            resultado = calcular_inventario(inventario, catalogo)
            print()
            print(reportes.resumen_texto(resultado))

    if not inventario.actividades:
        print("\nSin actividades cargadas. Nada que guardar.")
        return 0

    resultado = calcular_inventario(inventario, catalogo)
    print(f"\nTotal del inventario: {formatear(resultado.kg_co2e)}")

    destino = _preguntar("\nGuardar inventario como (Enter = inventario_emisiones.json)",
                         "inventario_emisiones.json")
    inventario.guardar(destino)
    print(f"✓ Inventario guardado: {destino}")

    if _preguntar("¿Generar reporte HTML? (s/n)", "s").lower().startswith("s"):
        html = os.path.splitext(destino)[0] + ".html"
        reportes.exportar_html(resultado, html)
        print(f"✓ Reporte HTML: {html}")
    if _preguntar("¿Generar detalle CSV? (s/n)", "n").lower().startswith("s"):
        csv_salida = os.path.splitext(destino)[0] + ".csv"
        reportes.exportar_csv(resultado, csv_salida)
        print(f"✓ Detalle CSV: {csv_salida}")
    return 0


def _agregar_interactivo(inventario: Inventario, catalogo: CatalogoFactores) -> None:
    """Diálogo de alta de una actividad: alcance → categoría → factor → cantidad."""
    alcances = ["Alcance 1 — Emisiones directas (combustibles, refrigerantes, proceso)",
                "Alcance 2 — Energía comprada (electricidad, vapor)",
                "Alcance 3 — Otras indirectas (agua, residuos, transporte, insumos)",
                "Buscar por texto"]
    eleccion = _elegir(alcances, "¿Qué tipo de emisión va a cargar?")
    if eleccion is None:
        return

    if eleccion == 3:
        texto = _preguntar("Texto a buscar")
        candidatos = catalogo.listar(buscar=texto)
        if not candidatos:
            print("  ✗ Sin coincidencias.")
            return
    else:
        alcance = eleccion + 1
        categorias = catalogo.categorias(alcance=alcance)
        indice = _elegir(categorias, "Categoría")
        if indice is None:
            return
        candidatos = catalogo.listar(alcance=alcance, categoria=categorias[indice])

    indice = _elegir([f.etiqueta() for f in candidatos], "Factor de emisión")
    if indice is None:
        return
    factor = candidatos[indice]

    print(f"\n  Factor: {factor.nombre}")
    print(f"  Valor : {factor.co2e_unitario():.5f} kg CO₂e por {factor.unidad}")
    if factor.verificar:
        print("  ⚠ Valor referencial: verifíquelo antes de usarlo en un reporte externo.")
    if factor.notas:
        print(f"  Nota  : {factor.notas}")

    cantidad = _preguntar_numero(f"\n  Cantidad consumida (en {factor.unidad} u otra compatible)")
    if cantidad is None:
        print("  (cancelado)")
        return

    compatibles = unidades.compatibles(factor.unidad)
    unidad = _preguntar(f"  Unidad {compatibles}", factor.unidad)
    try:
        unidad = unidades.normalizar(unidad)
        unidades.convertir(1, unidad, factor.unidad)
    except (unidades.UnidadDesconocida, unidades.UnidadIncompatible) as exc:
        print(f"  ✗ {exc} — se usará {factor.unidad}.")
        unidad = factor.unidad

    actividad = Actividad(
        descripcion=_preguntar("  Descripción", factor.nombre),
        factor_id=factor.id,
        cantidad=cantidad,
        unidad=unidad,
        periodo=_preguntar("  Período", inventario.periodo),
        area=_preguntar("  Área / centro de costo"),
    )
    inventario.agregar(actividad)

    from .calculo import calcular_actividad
    resultado = calcular_actividad(actividad, catalogo)
    if resultado.ok:
        print(f"  ✓ Agregada — {formatear(resultado.kg_co2e)}")
    else:
        print(f"  ⚠ Agregada con problema: {resultado.error}")


# ─────────────────────────────────────────────
# Comando: gui
# ─────────────────────────────────────────────

def cmd_gui(args) -> int:
    try:
        from .gui import ejecutar
    except ImportError as exc:      # tkinter ausente (Linux sin python3-tk)
        print("✗ No se pudo abrir la interfaz gráfica: falta tkinter.")
        print(f"  Detalle: {exc}")
        print("  En Debian/Ubuntu:  sudo apt install python3-tk")
        print("  Mientras tanto puede usar la consola:  emisiones interactivo")
        return 2
    ejecutar(ruta_catalogo=args.catalogo, ruta_inventario=args.entrada)
    return 0


# ─────────────────────────────────────────────
# Parser
# ─────────────────────────────────────────────

def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="emisiones",
        description="Calculadora de emisiones de gases de efecto invernadero "
                    "(GHG Protocol, alcances 1, 2 y 3).",
        epilog="Sin argumentos abre la interfaz gráfica.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action="version", version=f"emisiones {VERSION}")
    parser.add_argument("--catalogo", metavar="ARCHIVO.json",
                        help="catálogo de factores propio (sobrescribe los valores base)")

    sub = parser.add_subparsers(dest="comando")

    p_gui = sub.add_parser("gui", help="abrir la interfaz gráfica")
    p_gui.add_argument("entrada", nargs="?", help="inventario .json a abrir")
    p_gui.set_defaults(func=cmd_gui)

    p_int = sub.add_parser("interactivo", help="ingresar datos guiado en la consola")
    p_int.add_argument("entrada", nargs="?", help="inventario .json o .csv a continuar")
    p_int.set_defaults(func=cmd_interactivo)

    p_cal = sub.add_parser("calcular", help="calcular a partir de un .csv o .json")
    p_cal.add_argument("entrada", help="archivo de actividades (.csv o .json)")
    p_cal.add_argument("--csv", metavar="SALIDA.csv", help="exportar el detalle a CSV")
    p_cal.add_argument("--html", metavar="SALIDA.html", help="exportar el reporte a HTML")
    p_cal.add_argument("--json", metavar="SALIDA.json", help="exportar el reporte a JSON")
    p_cal.add_argument("--guardar", metavar="INVENTARIO.json",
                       help="guardar el inventario normalizado")
    p_cal.add_argument("--organizacion", help="nombre de la organización")
    p_cal.add_argument("--periodo", help="período del inventario")
    p_cal.add_argument("--estricto", action="store_true",
                       help="terminar con código 1 si alguna actividad falla")
    p_cal.set_defaults(func=cmd_calcular)

    p_fac = sub.add_parser("factores", help="listar o exportar el catálogo de factores")
    p_fac.add_argument("--alcance", type=int, choices=[1, 2, 3], help="filtrar por alcance")
    p_fac.add_argument("--buscar", help="filtrar por texto")
    p_fac.add_argument("--detalle", action="store_true", help="mostrar gases, fuente y notas")
    p_fac.add_argument("--exportar", metavar="SALIDA.csv|.json", help="exportar el catálogo")
    p_fac.set_defaults(func=cmd_factores)

    p_pla = sub.add_parser("plantilla", help="crear una plantilla CSV para llenar")
    p_pla.add_argument("salida", nargs="?", default="datos_emisiones.csv")
    p_pla.set_defaults(func=cmd_plantilla)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = construir_parser()
    args = parser.parse_args(argv if argv is not None else sys.argv[1:])

    if not getattr(args, "comando", None):
        args.entrada = None
        return cmd_gui(args)
    return args.func(args)
