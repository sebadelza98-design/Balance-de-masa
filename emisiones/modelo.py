"""
modelo.py
Modelos de datos del inventario de emisiones: Actividad e Inventario.

Una Actividad es un dato de entrada ("consumí 1.250 L de diésel en mayo en
la sala de calderas"). El Inventario agrupa las actividades de un período y
se guarda/abre como un archivo JSON.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
import datetime
import json
import uuid


# ─────────────────────────────────────────────
# Actividad
# ─────────────────────────────────────────────

@dataclass
class Actividad:
    """Dato de actividad ingresado por el usuario."""
    id: str = field(default_factory=lambda: "A" + str(uuid.uuid4())[:6].upper())
    descripcion: str = ""
    factor_id: str = ""
    cantidad: float = 0.0
    unidad: str = ""
    periodo: str = ""          # "2026-05", "2026", "2026-T2"… texto libre
    area: str = ""             # área / centro de costo / línea
    notas: str = ""

    def validar(self) -> List[str]:
        """Lista de problemas encontrados (vacía si la actividad es válida)."""
        problemas: List[str] = []
        if not self.factor_id:
            problemas.append("falta el factor de emisión")
        if not self.unidad:
            problemas.append("falta la unidad")
        try:
            valor = float(self.cantidad)
        except (TypeError, ValueError):
            problemas.append("la cantidad no es un número")
            return problemas
        if valor != valor:                      # NaN
            problemas.append("la cantidad no es un número")
        elif valor < 0:
            problemas.append("la cantidad es negativa")
        return problemas

    def a_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def desde_dict(d: dict) -> "Actividad":
        return Actividad(
            id=str(d.get("id") or ("A" + str(uuid.uuid4())[:6].upper())),
            descripcion=str(d.get("descripcion", "")),
            factor_id=str(d.get("factor_id", "")),
            cantidad=float(d.get("cantidad", 0.0) or 0.0),
            unidad=str(d.get("unidad", "")),
            periodo=str(d.get("periodo", "")),
            area=str(d.get("area", "")),
            notas=str(d.get("notas", "")),
        )


# ─────────────────────────────────────────────
# Inventario
# ─────────────────────────────────────────────

@dataclass
class Inventario:
    """Conjunto de actividades de una organización y un período."""
    organizacion: str = ""
    instalacion: str = ""
    periodo: str = ""
    responsable: str = ""
    notas: str = ""
    actividades: List[Actividad] = field(default_factory=list)
    creado: str = field(default_factory=lambda: datetime.date.today().isoformat())

    # ── edición ──
    def agregar(self, actividad: Actividad) -> Actividad:
        self.actividades.append(actividad)
        return actividad

    def eliminar(self, actividad_id: str) -> bool:
        antes = len(self.actividades)
        self.actividades = [a for a in self.actividades if a.id != actividad_id]
        return len(self.actividades) != antes

    def obtener(self, actividad_id: str) -> Optional[Actividad]:
        for a in self.actividades:
            if a.id == actividad_id:
                return a
        return None

    def reemplazar(self, actividad: Actividad) -> bool:
        for i, a in enumerate(self.actividades):
            if a.id == actividad.id:
                self.actividades[i] = actividad
                return True
        return False

    # ── consultas ──
    def periodos(self) -> List[str]:
        return sorted({a.periodo for a in self.actividades if a.periodo})

    def areas(self) -> List[str]:
        return sorted({a.area for a in self.actividades if a.area})

    def validar(self) -> Dict[str, List[str]]:
        """{id de actividad: problemas} para las actividades con errores."""
        return {a.id: p for a in self.actividades if (p := a.validar())}

    # ── persistencia ──
    def a_dict(self) -> dict:
        return {
            "version": 1,
            "tipo": "inventario_emisiones",
            "organizacion": self.organizacion,
            "instalacion": self.instalacion,
            "periodo": self.periodo,
            "responsable": self.responsable,
            "notas": self.notas,
            "creado": self.creado,
            "actividades": [a.a_dict() for a in self.actividades],
        }

    def guardar(self, ruta: str) -> None:
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(self.a_dict(), fh, ensure_ascii=False, indent=2)

    @staticmethod
    def desde_dict(d: dict) -> "Inventario":
        inv = Inventario(
            organizacion=str(d.get("organizacion", "")),
            instalacion=str(d.get("instalacion", "")),
            periodo=str(d.get("periodo", "")),
            responsable=str(d.get("responsable", "")),
            notas=str(d.get("notas", "")),
            creado=str(d.get("creado", datetime.date.today().isoformat())),
        )
        for x in d.get("actividades", []):
            inv.agregar(Actividad.desde_dict(x))
        return inv

    @staticmethod
    def cargar(ruta: str) -> "Inventario":
        with open(ruta, "r", encoding="utf-8") as fh:
            return Inventario.desde_dict(json.load(fh))
