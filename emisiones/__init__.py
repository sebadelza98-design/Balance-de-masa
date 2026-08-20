"""
Calculadora de emisiones de gases de efecto invernadero.

Aplicación de escritorio y de consola para estimar las emisiones de una
instalación a partir de sus datos de consumo (combustibles, electricidad,
refrigerantes, agua, residuos, transporte e insumos), siguiendo el GHG
Protocol para los alcances 1, 2 y 3.

Uso rápido:

    from emisiones import Inventario, Actividad, calcular_inventario

    inventario = Inventario(organizacion="Planta", periodo="2026-05")
    inventario.agregar(Actividad(descripcion="Diésel calderas",
                                 factor_id="diesel_estacionario_L",
                                 cantidad=1250, unidad="L"))
    resultado = calcular_inventario(inventario)
    print(resultado.t_co2e)
"""
from .calculo import (ResultadoActividad, ResultadoInventario, calcular_actividad,
                      calcular_inventario, formatear)
from .factores import (ALCANCES, GWP_AR6, CatalogoFactores, FactorEmision,
                       catalogo_base, catalogo_por_defecto)
from .modelo import Actividad, Inventario
from .unidades import convertir

__version__ = "1.0.0"

__all__ = [
    "Actividad", "Inventario", "FactorEmision", "CatalogoFactores",
    "ResultadoActividad", "ResultadoInventario",
    "calcular_actividad", "calcular_inventario", "formatear", "convertir",
    "catalogo_base", "catalogo_por_defecto", "ALCANCES", "GWP_AR6",
    "__version__",
]
