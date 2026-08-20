"""
unidades.py
Conversión de unidades para los datos de actividad.

Cada unidad pertenece a una *dimensión* (energía, masa, volumen, …) y se
define por su equivalencia con la unidad base de esa dimensión. Sólo se
permiten conversiones dentro de la misma dimensión: convertir kWh a litros
no tiene sentido físico y el motor de cálculo debe rechazarlo.
"""
from __future__ import annotations
from typing import Dict, List


# ─────────────────────────────────────────────
# Catálogo de unidades
# ─────────────────────────────────────────────

# dimensión → { unidad: factor hacia la unidad base }
UNIDADES: Dict[str, Dict[str, float]] = {
    "energia": {
        "kWh": 1.0,          # base
        "MWh": 1_000.0,
        "GWh": 1_000_000.0,
        "MJ":  1 / 3.6,
        "GJ":  1_000 / 3.6,
        "TJ":  1_000_000 / 3.6,
    },
    "masa": {
        "kg": 1.0,           # base
        "g":  0.001,
        "t":  1_000.0,
    },
    "volumen": {
        "L":   1.0,          # base
        "m3":  1_000.0,
        "hL":  100.0,
        "gal": 3.785411784,  # galón US
    },
    "distancia": {
        "km": 1.0,           # base
        "mi": 1.609344,
    },
    "transporte": {
        "t*km":  1.0,        # base
        "kg*km": 0.001,
    },
    "pasajero": {
        "pkm": 1.0,          # base — pasajero·km
    },
    "nitrogeno": {
        "kgN": 1.0,          # base — kg de nitrógeno
    },
    "dbo": {
        "kgDBO": 1.0,        # base — kg de DBO (demanda bioquímica de oxígeno)
    },
    "unidad": {
        "u": 1.0,            # base — piezas, envases, empleados, noches de hotel…
    },
}

# Alias de escritura frecuentes → unidad canónica
ALIAS: Dict[str, str] = {
    "kwh": "kWh", "mwh": "MWh", "gwh": "GWh",
    "mj": "MJ", "gj": "GJ", "tj": "TJ",
    "kg": "kg", "kgs": "kg", "g": "g", "gr": "g",
    "t": "t", "ton": "t", "tons": "t", "tonelada": "t", "toneladas": "t",
    "l": "L", "lt": "L", "lts": "L", "litro": "L", "litros": "L",
    "m³": "m3", "m^3": "m3", "m3": "m3", "metro3": "m3",
    "hl": "hL", "gal": "gal", "galon": "gal",
    "km": "km", "mi": "mi", "milla": "mi", "millas": "mi",
    "t·km": "t*km", "tkm": "t*km", "t-km": "t*km",
    "kg·km": "kg*km", "kgkm": "kg*km", "kg-km": "kg*km",
    "pkm": "pkm", "pax*km": "pkm", "pasajero*km": "pkm",
    "kgn": "kgN", "kg n": "kgN",
    "kgdbo": "kgDBO", "kg dbo": "kgDBO", "dbo": "kgDBO",
    "u": "u", "un": "u", "unidad": "u", "unidades": "u", "pieza": "u",
}


class UnidadIncompatible(ValueError):
    """Se intentó convertir entre unidades de dimensiones distintas."""


class UnidadDesconocida(ValueError):
    """La unidad no está en el catálogo."""


# ─────────────────────────────────────────────
# API
# ─────────────────────────────────────────────

def normalizar(unidad: str) -> str:
    """Devuelve la forma canónica de una unidad ('LTS' → 'L')."""
    if unidad is None:
        raise UnidadDesconocida("unidad vacía")
    u = str(unidad).strip()
    if not u:
        raise UnidadDesconocida("unidad vacía")
    for tabla in UNIDADES.values():
        if u in tabla:
            return u
    canonica = ALIAS.get(u.lower().replace(" ", ""))
    if canonica is None:
        canonica = ALIAS.get(u.lower())
    if canonica is None:
        raise UnidadDesconocida(f"unidad desconocida: '{unidad}'")
    return canonica


def dimension(unidad: str) -> str:
    """Dimensión física a la que pertenece la unidad."""
    u = normalizar(unidad)
    for dim, tabla in UNIDADES.items():
        if u in tabla:
            return dim
    raise UnidadDesconocida(f"unidad desconocida: '{unidad}'")


def compatibles(unidad: str) -> List[str]:
    """Unidades a las que se puede convertir la unidad dada."""
    return list(UNIDADES[dimension(unidad)].keys())


def convertir(cantidad: float, desde: str, hacia: str) -> float:
    """
    Convierte `cantidad` de la unidad `desde` a la unidad `hacia`.

    >>> round(convertir(1, 'm3', 'L'), 6)
    1000.0
    >>> round(convertir(2, 'MWh', 'kWh'), 6)
    2000.0
    """
    u_desde = normalizar(desde)
    u_hacia = normalizar(hacia)
    if u_desde == u_hacia:
        return float(cantidad)

    dim_desde = dimension(u_desde)
    dim_hacia = dimension(u_hacia)
    if dim_desde != dim_hacia:
        raise UnidadIncompatible(
            f"no se puede convertir {u_desde} ({dim_desde}) a {u_hacia} ({dim_hacia})"
        )

    tabla = UNIDADES[dim_desde]
    return float(cantidad) * tabla[u_desde] / tabla[u_hacia]
