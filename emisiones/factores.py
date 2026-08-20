"""
factores.py
Catálogo de factores de emisión y potenciales de calentamiento global (GWP).

Un FactorEmision expresa **kg de cada gas por unidad de actividad**. El motor
de cálculo multiplica por el GWP correspondiente para obtener kg CO₂e, de modo
que el inventario queda desglosado por gas y no sólo como un número agregado.

Los factores de combustión se derivan aquí de sus parámetros fuente
(poder calorífico inferior, densidad y kg de gas por TJ) para que el número
final sea auditable y no una constante sin origen.

⚠️  Los factores marcados con `verificar=True` son valores **referenciales**:
    antes de usarlos en un reporte oficial reemplácelos por el dato de su
    proveedor, de su medición o del organismo que corresponda al año de
    reporte (menú «Factores → Editar» en la aplicación, o archivo JSON propio).
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
import json
import os
import sys


# ─────────────────────────────────────────────
# Potenciales de calentamiento global (GWP-100)
# IPCC AR6 (2021), horizonte 100 años.
# ─────────────────────────────────────────────

GWP_AR6: Dict[str, float] = {
    "CO2": 1.0,
    "CO2e": 1.0,            # factores ya agregados en CO₂ equivalente
    "CH4": 29.8,            # metano de origen fósil
    "CH4_bio": 27.0,        # metano de origen biogénico
    "N2O": 273.0,
    "HFC-32": 771.0,
    "HFC-125": 3740.0,
    "HFC-134a": 1530.0,
    "HFC-143a": 5810.0,
    "HFC-152a": 164.0,
    "HFC-227ea": 3600.0,
    "HCFC-22": 1960.0,
    "SF6": 24300.0,
    "NF3": 17400.0,
    "NH3": 0.0,             # R-717 — no es gas de efecto invernadero
}

NOMBRES_GAS: Dict[str, str] = {
    "CO2": "Dióxido de carbono",
    "CO2e": "CO₂ equivalente (factor agregado)",
    "CH4": "Metano (fósil)",
    "CH4_bio": "Metano (biogénico)",
    "N2O": "Óxido nitroso",
    "HFC-32": "HFC-32 (R-32)",
    "HFC-125": "HFC-125",
    "HFC-134a": "HFC-134a (R-134a)",
    "HFC-143a": "HFC-143a",
    "HFC-152a": "HFC-152a",
    "HFC-227ea": "HFC-227ea",
    "HCFC-22": "HCFC-22 (R-22)",
    "SF6": "Hexafluoruro de azufre",
    "NF3": "Trifluoruro de nitrógeno",
    "NH3": "Amoníaco (R-717)",
}

ALCANCES: Dict[int, str] = {
    1: "Alcance 1 — Emisiones directas",
    2: "Alcance 2 — Energía comprada",
    3: "Alcance 3 — Otras indirectas (cadena de valor)",
}


# ─────────────────────────────────────────────
# FactorEmision
# ─────────────────────────────────────────────

@dataclass
class FactorEmision:
    """Factor de emisión expresado en kg de gas por unidad de actividad."""
    id: str
    nombre: str
    alcance: int                      # 1, 2 ó 3
    categoria: str
    unidad: str                       # unidad canónica del factor
    gases: Dict[str, float] = field(default_factory=dict)   # kg gas / unidad
    co2_biogenico: float = 0.0        # kg CO₂ biogénico / unidad (se informa aparte)
    fuente: str = ""
    verificar: bool = False           # True → valor referencial, revisar antes de reportar
    notas: str = ""

    def co2e_unitario(self, gwp: Optional[Dict[str, float]] = None) -> float:
        """kg CO₂e por una unidad de actividad (sin incluir CO₂ biogénico)."""
        tabla = gwp or GWP_AR6
        total = 0.0
        for gas, kg in self.gases.items():
            if gas not in tabla:
                raise ValueError(f"gas sin GWP definido: '{gas}' (factor {self.id})")
            total += kg * tabla[gas]
        return total

    def etiqueta(self) -> str:
        """Texto para listas y menús desplegables."""
        marca = " ⚠" if self.verificar else ""
        return f"[A{self.alcance}] {self.nombre} ({self.unidad}){marca}"

    def a_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def desde_dict(d: dict) -> "FactorEmision":
        return FactorEmision(
            id=str(d["id"]),
            nombre=str(d.get("nombre", d["id"])),
            alcance=int(d.get("alcance", 1)),
            categoria=str(d.get("categoria", "Sin categoría")),
            unidad=str(d.get("unidad", "u")),
            gases={str(k): float(v) for k, v in dict(d.get("gases", {})).items()},
            co2_biogenico=float(d.get("co2_biogenico", 0.0)),
            fuente=str(d.get("fuente", "")),
            verificar=bool(d.get("verificar", False)),
            notas=str(d.get("notas", "")),
        )


# ─────────────────────────────────────────────
# Derivación de factores de combustión
# ─────────────────────────────────────────────

def _combustion(pci_gj_por_unidad: float, kg_por_tj: Dict[str, float]) -> Dict[str, float]:
    """
    kg de gas por unidad de combustible.

    pci_gj_por_unidad : poder calorífico inferior (GJ por litro, kg o m³)
    kg_por_tj         : kg de gas por TJ de energía (factores IPCC 2006)
    """
    # 1 TJ = 1000 GJ  →  kg/GJ = (kg/TJ) / 1000
    return {gas: (kg / 1000.0) * pci_gj_por_unidad for gas, kg in kg_por_tj.items()}


def _mezcla(componentes: Dict[str, float]) -> Dict[str, float]:
    """kg de cada componente por kg de mezcla refrigerante (fracciones másicas)."""
    return dict(componentes)


# Parámetros IPCC 2006 (Vol. 2, Cap. 1 y 3) usados abajo
_PCI = {                     # GJ por unidad
    "gas_natural_m3": 0.0336,    # 0,700 kg/m³ × 48,0 MJ/kg
    "gas_natural_kwh": 0.0036,   # 1 kWh = 3,6 MJ
    "diesel_L": 0.03612,         # 0,840 kg/L × 43,0 MJ/kg
    "gasolina_L": 0.0330035,     # 0,745 kg/L × 44,3 MJ/kg
    "glp_kg": 0.0473,            # 47,3 MJ/kg
    "glp_L": 0.025542,           # 0,540 kg/L × 47,3 MJ/kg
    "fueloil_kg": 0.0404,        # 40,4 MJ/kg
    "fueloil_L": 0.039592,       # 0,980 kg/L × 40,4 MJ/kg
    "lena_kg": 0.0156,           # 15,6 MJ/kg (biomasa leñosa)
}


# ─────────────────────────────────────────────
# Catálogo base
# ─────────────────────────────────────────────

def catalogo_base() -> List[FactorEmision]:
    """Factores de emisión por defecto de la aplicación."""
    ipcc = "IPCC 2006 (Vol. 2) · GWP-100 IPCC AR6"
    ref = "Referencial — reemplazar por dato propio o del proveedor"

    factores: List[FactorEmision] = [

        # ── Alcance 1 · Combustión estacionaria ──────────────
        FactorEmision(
            "gas_natural_m3", "Gas natural — combustión estacionaria", 1,
            "Combustión estacionaria", "m3",
            _combustion(_PCI["gas_natural_m3"], {"CO2": 56100, "CH4": 1, "N2O": 0.1}),
            fuente=ipcc,
            notas="PCI 48,0 MJ/kg y densidad 0,700 kg/m³ (m³ normal).",
        ),
        FactorEmision(
            "gas_natural_kwh", "Gas natural — facturado en kWh", 1,
            "Combustión estacionaria", "kWh",
            _combustion(_PCI["gas_natural_kwh"], {"CO2": 56100, "CH4": 1, "N2O": 0.1}),
            fuente=ipcc,
            notas="Use esta variante si la boleta viene en kWh (PCI).",
        ),
        FactorEmision(
            "diesel_estacionario_L", "Diésel — caldera / generador", 1,
            "Combustión estacionaria", "L",
            _combustion(_PCI["diesel_L"], {"CO2": 74100, "CH4": 3, "N2O": 0.6}),
            fuente=ipcc,
            notas="PCI 43,0 MJ/kg y densidad 0,840 kg/L.",
        ),
        FactorEmision(
            "glp_kg", "Gas licuado (GLP) — por kg", 1,
            "Combustión estacionaria", "kg",
            _combustion(_PCI["glp_kg"], {"CO2": 63100, "CH4": 1, "N2O": 0.1}),
            fuente=ipcc,
        ),
        FactorEmision(
            "glp_L", "Gas licuado (GLP) — por litro", 1,
            "Combustión estacionaria", "L",
            _combustion(_PCI["glp_L"], {"CO2": 63100, "CH4": 1, "N2O": 0.1}),
            fuente=ipcc,
            notas="Densidad 0,540 kg/L.",
        ),
        FactorEmision(
            "fueloil_L", "Petróleo combustible N°6 — por litro", 1,
            "Combustión estacionaria", "L",
            _combustion(_PCI["fueloil_L"], {"CO2": 77400, "CH4": 3, "N2O": 0.6}),
            fuente=ipcc,
            notas="PCI 40,4 MJ/kg y densidad 0,980 kg/L.",
        ),
        FactorEmision(
            "lena_kg", "Leña / biomasa leñosa", 1,
            "Combustión estacionaria", "kg",
            _combustion(_PCI["lena_kg"], {"CH4_bio": 30, "N2O": 4}),
            co2_biogenico=112000 / 1000.0 * _PCI["lena_kg"],
            fuente=ipcc,
            notas="El CO₂ biogénico se informa por separado, no suma al total "
                  "de alcance 1 (GHG Protocol).",
        ),

        # ── Alcance 1 · Combustión móvil ─────────────────────
        FactorEmision(
            "diesel_movil_L", "Diésel — flota / equipos móviles", 1,
            "Combustión móvil", "L",
            _combustion(_PCI["diesel_L"], {"CO2": 74100, "CH4": 3.9, "N2O": 3.9}),
            fuente=ipcc,
        ),
        FactorEmision(
            "gasolina_movil_L", "Gasolina — flota liviana", 1,
            "Combustión móvil", "L",
            _combustion(_PCI["gasolina_L"], {"CO2": 69300, "CH4": 3.8, "N2O": 5.7}),
            fuente=ipcc,
            notas="Vehículo liviano con convertidor catalítico.",
        ),

        # ── Alcance 1 · Refrigerantes (recarga = fuga) ───────
        FactorEmision(
            "ref_r134a", "Refrigerante R-134a", 1, "Refrigerantes y gases", "kg",
            _mezcla({"HFC-134a": 1.0}), fuente="GWP-100 IPCC AR6",
            notas="Cargue el refrigerante repuesto en el año (equivale a la fuga).",
        ),
        FactorEmision(
            "ref_r404a", "Refrigerante R-404A", 1, "Refrigerantes y gases", "kg",
            _mezcla({"HFC-125": 0.44, "HFC-134a": 0.04, "HFC-143a": 0.52}),
            fuente="GWP-100 IPCC AR6 · composición másica de la mezcla",
        ),
        FactorEmision(
            "ref_r410a", "Refrigerante R-410A", 1, "Refrigerantes y gases", "kg",
            _mezcla({"HFC-32": 0.50, "HFC-125": 0.50}),
            fuente="GWP-100 IPCC AR6 · composición másica de la mezcla",
        ),
        FactorEmision(
            "ref_r407c", "Refrigerante R-407C", 1, "Refrigerantes y gases", "kg",
            _mezcla({"HFC-32": 0.23, "HFC-125": 0.25, "HFC-134a": 0.52}),
            fuente="GWP-100 IPCC AR6 · composición másica de la mezcla",
        ),
        FactorEmision(
            "ref_r507a", "Refrigerante R-507A", 1, "Refrigerantes y gases", "kg",
            _mezcla({"HFC-125": 0.50, "HFC-143a": 0.50}),
            fuente="GWP-100 IPCC AR6 · composición másica de la mezcla",
        ),
        FactorEmision(
            "ref_r22", "Refrigerante R-22 (HCFC-22)", 1, "Refrigerantes y gases", "kg",
            _mezcla({"HCFC-22": 1.0}), fuente="GWP-100 IPCC AR6",
        ),
        FactorEmision(
            "ref_amoniaco", "Refrigerante amoníaco R-717", 1, "Refrigerantes y gases", "kg",
            _mezcla({"NH3": 1.0}), fuente="GWP-100 IPCC AR6",
            notas="GWP = 0. Se registra para trazabilidad, no aporta CO₂e.",
        ),
        FactorEmision(
            "sf6_kg", "SF₆ — equipos eléctricos", 1, "Refrigerantes y gases", "kg",
            _mezcla({"SF6": 1.0}), fuente="GWP-100 IPCC AR6",
        ),

        # ── Alcance 1 · Proceso y efluentes ──────────────────
        FactorEmision(
            "co2_carbonatacion", "CO₂ de carbonatación liberado", 1,
            "Emisiones de proceso", "kg",
            {"CO2": 1.0},
            fuente="GHG Protocol — CO₂ de proceso de origen fósil",
            notas="Cargue el CO₂ comprado que no queda en el producto "
                  "(pérdidas de llenado, purgas, venteos).",
        ),
        FactorEmision(
            "efluente_dbo_anaerobio", "Efluente — tratamiento anaeróbico (CH₄)", 1,
            "Aguas residuales", "kgDBO",
            {"CH4": 0.6 * 0.8},
            fuente="IPCC 2006 Vol. 5 Cap. 6 — Bo = 0,6 kg CH₄/kg DBO; MCF = 0,8",
            notas="kg de DBO tratados por vía anaeróbica (reactor o laguna). "
                  "Descuente el metano capturado o quemado en antorcha.",
        ),
        FactorEmision(
            "efluente_n_n2o", "Efluente — nitrógeno descargado (N₂O)", 1,
            "Aguas residuales", "kgN",
            {"N2O": 0.005 * 44 / 28},
            fuente="IPCC 2006 Vol. 5 Cap. 6 — EF = 0,005 kg N₂O-N/kg N",
            notas="kg de nitrógeno total en el efluente descargado.",
        ),

        # ── Alcance 2 · Energía comprada ─────────────────────
        FactorEmision(
            "electricidad_sen", "Electricidad comprada — red SEN (Chile)", 2,
            "Electricidad", "kWh",
            {"CO2e": 0.3937}, fuente="Factor de red del SEN — Ministerio de Energía",
            verificar=True,
            notas="Valor de referencia. Actualícelo con el factor oficial "
                  "publicado para su año de reporte antes de reportar.",
        ),
        FactorEmision(
            "electricidad_contrato", "Electricidad — contrato/certificados (market-based)", 2,
            "Electricidad", "kWh",
            {"CO2e": 0.0}, fuente="Factor del contrato de suministro",
            verificar=True,
            notas="Ponga aquí el factor de su contrato. 0 sólo si tiene "
                  "certificados de energía renovable que lo respalden.",
        ),
        FactorEmision(
            "vapor_comprado", "Vapor / calor comprado", 2, "Energía térmica", "kWh",
            {"CO2e": 0.27}, fuente=ref, verificar=True,
        ),

        # ── Alcance 3 · Agua ─────────────────────────────────
        FactorEmision(
            "agua_potable_m3", "Agua potable suministrada", 3, "Agua", "m3",
            {"CO2e": 0.149}, fuente="DEFRA (referencial)", verificar=True,
            notas="Conecta con el balance de masa: use el caudal de entrada "
                  "de pozo/red del período.",
        ),
        FactorEmision(
            "agua_residual_m3", "Tratamiento de aguas residuales (externo)", 3, "Agua", "m3",
            {"CO2e": 0.272}, fuente="DEFRA (referencial)", verificar=True,
            notas="Volumen enviado a tratamiento de terceros.",
        ),

        # ── Alcance 3 · Transporte ───────────────────────────
        FactorEmision(
            "transporte_camion", "Transporte de carga — camión", 3,
            "Transporte y distribución", "t*km",
            {"CO2e": 0.110}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "transporte_maritimo", "Transporte de carga — marítimo", 3,
            "Transporte y distribución", "t*km",
            {"CO2e": 0.016}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "transporte_aereo", "Transporte de carga — aéreo", 3,
            "Transporte y distribución", "t*km",
            {"CO2e": 0.600}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "viaje_avion", "Viaje de negocios — avión", 3, "Viajes y traslados", "pkm",
            {"CO2e": 0.155}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "viaje_auto", "Viaje de negocios — automóvil", 3, "Viajes y traslados", "km",
            {"CO2e": 0.170}, fuente=ref, verificar=True,
        ),

        # ── Alcance 3 · Residuos ─────────────────────────────
        FactorEmision(
            "residuo_relleno", "Residuos a relleno sanitario", 3, "Residuos", "kg",
            {"CO2e": 0.450}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "residuo_reciclaje", "Residuos a reciclaje", 3, "Residuos", "kg",
            {"CO2e": 0.021}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "residuo_compostaje", "Residuos orgánicos a compostaje", 3, "Residuos", "kg",
            {"CO2e": 0.011}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "lodos_disposicion", "Lodos de PTAS a disposición", 3, "Residuos", "kg",
            {"CO2e": 0.100}, fuente=ref, verificar=True,
            notas="Lodos deshidratados retirados de la planta de tratamiento.",
        ),

        # ── Alcance 3 · Materiales e insumos ─────────────────
        FactorEmision(
            "material_pet", "PET virgen (envases)", 3, "Materiales e insumos", "kg",
            {"CO2e": 2.150}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "material_vidrio", "Vidrio (envases)", 3, "Materiales e insumos", "kg",
            {"CO2e": 0.850}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "material_aluminio", "Aluminio (latas)", 3, "Materiales e insumos", "kg",
            {"CO2e": 8.500}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "material_carton", "Cartón corrugado", 3, "Materiales e insumos", "kg",
            {"CO2e": 0.800}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "insumo_soda_caustica", "Soda cáustica (CIP)", 3, "Materiales e insumos", "kg",
            {"CO2e": 1.200}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "insumo_acido_nitrico", "Ácido nítrico (CIP)", 3, "Materiales e insumos", "kg",
            {"CO2e": 2.700}, fuente=ref, verificar=True,
        ),
        FactorEmision(
            "insumo_generico", "Insumo genérico — factor propio", 3,
            "Materiales e insumos", "kg",
            {"CO2e": 1.000}, fuente="Definido por el usuario", verificar=True,
            notas="Duplique este factor y ajuste el valor para insumos no listados.",
        ),
    ]
    return factores


# ─────────────────────────────────────────────
# CatalogoFactores
# ─────────────────────────────────────────────

class CatalogoFactores:
    """Colección de factores, indexada por id, con carga/guardado en JSON."""

    def __init__(self, factores: Optional[List[FactorEmision]] = None):
        self._factores: Dict[str, FactorEmision] = {}
        for f in (factores if factores is not None else catalogo_base()):
            self.agregar(f)

    # ── acceso ──
    def __len__(self) -> int:
        return len(self._factores)

    def __contains__(self, factor_id: str) -> bool:
        return factor_id in self._factores

    def __iter__(self):
        return iter(self._factores.values())

    def obtener(self, factor_id: str) -> FactorEmision:
        if factor_id not in self._factores:
            raise KeyError(f"factor de emisión desconocido: '{factor_id}'")
        return self._factores[factor_id]

    def listar(self, alcance: Optional[int] = None,
               categoria: Optional[str] = None,
               buscar: Optional[str] = None) -> List[FactorEmision]:
        """Factores filtrados y ordenados por alcance / categoría / nombre."""
        resultado = list(self._factores.values())
        if alcance is not None:
            resultado = [f for f in resultado if f.alcance == alcance]
        if categoria is not None:
            resultado = [f for f in resultado if f.categoria == categoria]
        if buscar:
            t = buscar.lower()
            resultado = [f for f in resultado
                         if t in f.nombre.lower() or t in f.id.lower()
                         or t in f.categoria.lower()]
        return sorted(resultado, key=lambda f: (f.alcance, f.categoria, f.nombre))

    def categorias(self, alcance: Optional[int] = None) -> List[str]:
        return sorted({f.categoria for f in self.listar(alcance=alcance)})

    # ── edición ──
    def agregar(self, factor: FactorEmision) -> None:
        self._factores[factor.id] = factor

    def eliminar(self, factor_id: str) -> None:
        self._factores.pop(factor_id, None)

    # ── persistencia ──
    def a_dict(self) -> dict:
        return {
            "version": 1,
            "gwp": "IPCC AR6 (100 años)",
            "factores": [f.a_dict() for f in self.listar()],
        }

    def guardar(self, ruta: str) -> None:
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(self.a_dict(), fh, ensure_ascii=False, indent=2)

    @staticmethod
    def desde_dict(d: dict) -> "CatalogoFactores":
        return CatalogoFactores([FactorEmision.desde_dict(x) for x in d.get("factores", [])])

    @staticmethod
    def cargar(ruta: str, combinar_con_base: bool = False) -> "CatalogoFactores":
        """
        Carga un catálogo desde JSON.

        combinar_con_base=True parte del catálogo por defecto y sobrescribe
        con los factores del archivo (útil para ajustar sólo algunos valores).
        """
        with open(ruta, "r", encoding="utf-8") as fh:
            datos = json.load(fh)
        cargados = [FactorEmision.desde_dict(x) for x in datos.get("factores", [])]
        if combinar_con_base:
            catalogo = CatalogoFactores()
            for f in cargados:
                catalogo.agregar(f)
            return catalogo
        return CatalogoFactores(cargados)


ARCHIVO_USUARIO = "factores_emision.json"


def _directorios_de_busqueda() -> List[str]:
    """
    Dónde se busca un catálogo propio, en orden de prioridad.

    Con el ejecutable de PyInstaller, `sys.executable` apunta al .exe y
    `sys._MEIPASS` a la carpeta temporal donde se desempaqueta lo empotrado;
    ejecutando desde el código fuente, ambos casos se reducen al directorio
    de trabajo y al del paquete.
    """
    directorios: List[str] = []

    if getattr(sys, "frozen", False):                    # ejecutable congelado
        directorios.append(os.path.dirname(os.path.abspath(sys.executable)))
        empotrado = getattr(sys, "_MEIPASS", "")
        if empotrado:
            directorios.append(empotrado)
    else:
        directorios.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    directorios.append(os.getcwd())
    directorios.append(os.path.join(os.path.expanduser("~"), ".emisiones"))
    return directorios


def catalogo_por_defecto(ruta_usuario: Optional[str] = None) -> CatalogoFactores:
    """
    Catálogo base, con los ajustes del usuario si existen.

    Busca `factores_emision.json` en la ruta indicada, junto al ejecutable,
    en el directorio de trabajo y en ~/.emisiones. El primero que exista se
    combina sobre el catálogo base; si no hay ninguno, devuelve el base.
    """
    candidatos: List[str] = [ruta_usuario] if ruta_usuario else []
    candidatos += [os.path.join(d, ARCHIVO_USUARIO) for d in _directorios_de_busqueda()]

    for ruta in candidatos:
        if ruta and os.path.isfile(ruta):
            return CatalogoFactores.cargar(ruta, combinar_con_base=True)
    return CatalogoFactores()
