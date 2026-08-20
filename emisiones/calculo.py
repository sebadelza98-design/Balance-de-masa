"""
calculo.py
Motor de cálculo del inventario de emisiones.

Para cada actividad:

    cantidad_convertida = convertir(cantidad, unidad_actividad → unidad_factor)
    kg CO₂e = Σ_gas  (kg_gas por unidad) · cantidad_convertida · GWP_gas

Los totales se agregan por alcance, categoría, área, período y gas. El CO₂
biogénico se acumula aparte: el GHG Protocol pide informarlo fuera de los
alcances 1/2/3.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .factores import CatalogoFactores, FactorEmision, GWP_AR6, ALCANCES
from .modelo import Actividad, Inventario
from .unidades import convertir, UnidadIncompatible, UnidadDesconocida


# ─────────────────────────────────────────────
# Resultados
# ─────────────────────────────────────────────

@dataclass
class ResultadoActividad:
    """Emisiones calculadas para una actividad."""
    actividad: Actividad
    factor: Optional[FactorEmision]
    cantidad_convertida: float = 0.0
    kg_co2e: float = 0.0
    kg_co2_biogenico: float = 0.0
    por_gas: Dict[str, float] = field(default_factory=dict)   # kg CO₂e por gas
    error: str = ""

    @property
    def ok(self) -> bool:
        return not self.error

    @property
    def alcance(self) -> int:
        return self.factor.alcance if self.factor else 0

    @property
    def categoria(self) -> str:
        return self.factor.categoria if self.factor else "Sin clasificar"

    @property
    def t_co2e(self) -> float:
        return self.kg_co2e / 1000.0


@dataclass
class ResultadoInventario:
    """Inventario resuelto: totales, desgloses y errores."""
    inventario: Inventario
    resultados: List[ResultadoActividad] = field(default_factory=list)

    # ── totales ──
    @property
    def kg_co2e(self) -> float:
        return sum(r.kg_co2e for r in self.resultados if r.ok)

    @property
    def t_co2e(self) -> float:
        return self.kg_co2e / 1000.0

    @property
    def kg_co2_biogenico(self) -> float:
        return sum(r.kg_co2_biogenico for r in self.resultados if r.ok)

    @property
    def errores(self) -> List[ResultadoActividad]:
        return [r for r in self.resultados if not r.ok]

    @property
    def requieren_verificacion(self) -> List[ResultadoActividad]:
        """Actividades cuyo factor es referencial y debe validarse."""
        return [r for r in self.resultados if r.ok and r.factor and r.factor.verificar]

    # ── desgloses ──
    def _agrupar(self, clave) -> Dict[object, float]:
        totales: Dict[object, float] = {}
        for r in self.resultados:
            if r.ok:
                totales[clave(r)] = totales.get(clave(r), 0.0) + r.kg_co2e
        return totales

    def por_alcance(self) -> Dict[int, float]:
        totales = {1: 0.0, 2: 0.0, 3: 0.0}
        totales.update(self._agrupar(lambda r: r.alcance))
        return {k: totales[k] for k in sorted(totales)}

    def por_categoria(self) -> Dict[str, float]:
        return dict(sorted(self._agrupar(lambda r: r.categoria).items(),
                           key=lambda kv: -kv[1]))

    def por_area(self) -> Dict[str, float]:
        return dict(sorted(self._agrupar(lambda r: r.actividad.area or "(sin área)").items(),
                           key=lambda kv: -kv[1]))

    def por_periodo(self) -> Dict[str, float]:
        return dict(sorted(self._agrupar(lambda r: r.actividad.periodo or "(sin período)").items()))

    def por_gas(self) -> Dict[str, float]:
        totales: Dict[str, float] = {}
        for r in self.resultados:
            if r.ok:
                for gas, kg in r.por_gas.items():
                    totales[gas] = totales.get(gas, 0.0) + kg
        return dict(sorted(totales.items(), key=lambda kv: -kv[1]))

    def ranking(self, n: int = 10) -> List[ResultadoActividad]:
        """Las n actividades que más emiten."""
        return sorted([r for r in self.resultados if r.ok],
                      key=lambda r: -r.kg_co2e)[:n]

    def participacion(self, kg: float) -> float:
        """Porcentaje que representa `kg` sobre el total del inventario."""
        total = self.kg_co2e
        return (kg / total * 100.0) if total else 0.0

    def intensidad(self, produccion: float, unidad: str = "u") -> Optional[float]:
        """kg CO₂e por unidad de producción (None si la producción es 0)."""
        if not produccion:
            return None
        return self.kg_co2e / float(produccion)


# ─────────────────────────────────────────────
# Motor
# ─────────────────────────────────────────────

def calcular_actividad(actividad: Actividad,
                       catalogo: CatalogoFactores,
                       gwp: Optional[Dict[str, float]] = None) -> ResultadoActividad:
    """Calcula las emisiones de una actividad. Nunca lanza: reporta en `error`."""
    tabla = gwp or GWP_AR6

    problemas = actividad.validar()
    if problemas:
        return ResultadoActividad(actividad, None, error="; ".join(problemas))

    try:
        factor = catalogo.obtener(actividad.factor_id)
    except KeyError as exc:
        return ResultadoActividad(actividad, None, error=str(exc))

    try:
        cantidad = convertir(actividad.cantidad, actividad.unidad, factor.unidad)
    except (UnidadIncompatible, UnidadDesconocida) as exc:
        return ResultadoActividad(actividad, factor, error=str(exc))

    por_gas: Dict[str, float] = {}
    for gas, kg_por_unidad in factor.gases.items():
        if gas not in tabla:
            return ResultadoActividad(actividad, factor,
                                      error=f"gas sin GWP definido: '{gas}'")
        por_gas[gas] = kg_por_unidad * cantidad * tabla[gas]

    return ResultadoActividad(
        actividad=actividad,
        factor=factor,
        cantidad_convertida=cantidad,
        kg_co2e=sum(por_gas.values()),
        kg_co2_biogenico=factor.co2_biogenico * cantidad,
        por_gas=por_gas,
    )


def calcular_inventario(inventario: Inventario,
                        catalogo: Optional[CatalogoFactores] = None,
                        gwp: Optional[Dict[str, float]] = None) -> ResultadoInventario:
    """Resuelve todas las actividades del inventario."""
    cat = catalogo or CatalogoFactores()
    return ResultadoInventario(
        inventario=inventario,
        resultados=[calcular_actividad(a, cat, gwp) for a in inventario.actividades],
    )


# ─────────────────────────────────────────────
# Utilidades de presentación
# ─────────────────────────────────────────────

def nombre_alcance(alcance: int) -> str:
    return ALCANCES.get(alcance, "Sin clasificar")


def formatear(kg: float) -> str:
    """Formatea una masa de CO₂e eligiendo kg o t según la magnitud."""
    if abs(kg) >= 1000:
        return f"{kg / 1000:,.3f} t CO₂e".replace(",", "@").replace(".", ",").replace("@", ".")
    return f"{kg:,.2f} kg CO₂e".replace(",", "@").replace(".", ",").replace("@", ".")
