"""Pruebas del motor de cálculo."""
import unittest

from emisiones.calculo import calcular_actividad, calcular_inventario, formatear
from emisiones.factores import CatalogoFactores, FactorEmision
from emisiones.modelo import Actividad, Inventario


class PruebaActividad(unittest.TestCase):

    def setUp(self):
        self.catalogo = CatalogoFactores()

    def test_calculo_directo(self):
        actividad = Actividad(descripcion="Diésel", factor_id="diesel_estacionario_L",
                              cantidad=1000, unidad="L")
        resultado = calcular_actividad(actividad, self.catalogo)
        self.assertTrue(resultado.ok)
        self.assertAlmostEqual(resultado.kg_co2e, 2685.64, places=1)
        self.assertAlmostEqual(resultado.t_co2e, resultado.kg_co2e / 1000)

    def test_convierte_la_unidad_del_dato(self):
        en_litros = calcular_actividad(
            Actividad(factor_id="diesel_estacionario_L", cantidad=2000, unidad="L"),
            self.catalogo)
        en_m3 = calcular_actividad(
            Actividad(factor_id="diesel_estacionario_L", cantidad=2, unidad="m3"),
            self.catalogo)
        self.assertAlmostEqual(en_litros.kg_co2e, en_m3.kg_co2e, places=6)

    def test_electricidad_en_mwh(self):
        resultado = calcular_actividad(
            Actividad(factor_id="electricidad_sen", cantidad=1, unidad="MWh"),
            self.catalogo)
        factor = self.catalogo.obtener("electricidad_sen").co2e_unitario()
        self.assertAlmostEqual(resultado.kg_co2e, factor * 1000)

    def test_desglose_por_gas(self):
        resultado = calcular_actividad(
            Actividad(factor_id="diesel_estacionario_L", cantidad=1000, unidad="L"),
            self.catalogo)
        self.assertEqual(set(resultado.por_gas), {"CO2", "CH4", "N2O"})
        self.assertAlmostEqual(sum(resultado.por_gas.values()), resultado.kg_co2e)
        self.assertGreater(resultado.por_gas["CO2"], resultado.por_gas["CH4"])

    def test_co2_biogenico_no_entra_al_total(self):
        resultado = calcular_actividad(
            Actividad(factor_id="lena_kg", cantidad=1000, unidad="kg"), self.catalogo)
        self.assertGreater(resultado.kg_co2_biogenico, 1000)
        self.assertLess(resultado.kg_co2e, 100)

    def test_cantidad_cero(self):
        resultado = calcular_actividad(
            Actividad(factor_id="glp_kg", cantidad=0, unidad="kg"), self.catalogo)
        self.assertTrue(resultado.ok)
        self.assertEqual(resultado.kg_co2e, 0.0)

    def test_es_lineal_en_la_cantidad(self):
        uno = calcular_actividad(
            Actividad(factor_id="glp_kg", cantidad=1, unidad="kg"), self.catalogo)
        cien = calcular_actividad(
            Actividad(factor_id="glp_kg", cantidad=100, unidad="kg"), self.catalogo)
        self.assertAlmostEqual(cien.kg_co2e, uno.kg_co2e * 100, places=6)


class PruebaErrores(unittest.TestCase):

    def setUp(self):
        self.catalogo = CatalogoFactores()

    def test_factor_inexistente(self):
        resultado = calcular_actividad(
            Actividad(factor_id="no_existe", cantidad=1, unidad="kg"), self.catalogo)
        self.assertFalse(resultado.ok)
        self.assertIn("desconocido", resultado.error)

    def test_unidad_incompatible(self):
        resultado = calcular_actividad(
            Actividad(factor_id="electricidad_sen", cantidad=5, unidad="L"), self.catalogo)
        self.assertFalse(resultado.ok)
        self.assertEqual(resultado.kg_co2e, 0.0)

    def test_cantidad_negativa(self):
        resultado = calcular_actividad(
            Actividad(factor_id="glp_kg", cantidad=-3, unidad="kg"), self.catalogo)
        self.assertFalse(resultado.ok)
        self.assertIn("negativa", resultado.error)

    def test_falta_el_factor(self):
        resultado = calcular_actividad(Actividad(cantidad=1, unidad="kg"), self.catalogo)
        self.assertFalse(resultado.ok)

    def test_el_motor_nunca_lanza(self):
        for actividad in [Actividad(), Actividad(factor_id="glp_kg", cantidad=float("nan")),
                          Actividad(factor_id="glp_kg", cantidad=1, unidad="parsecs")]:
            self.assertFalse(calcular_actividad(actividad, self.catalogo).ok)


class PruebaInventario(unittest.TestCase):

    def setUp(self):
        self.catalogo = CatalogoFactores()
        self.inventario = Inventario(organizacion="Planta", periodo="2026-05")
        self.inventario.agregar(Actividad(descripcion="Diésel", area="Calderas",
                                          periodo="2026-05",
                                          factor_id="diesel_estacionario_L",
                                          cantidad=1000, unidad="L"))
        self.inventario.agregar(Actividad(descripcion="Electricidad", area="Planta",
                                          periodo="2026-05",
                                          factor_id="electricidad_sen",
                                          cantidad=100, unidad="MWh"))
        self.inventario.agregar(Actividad(descripcion="Residuos", area="Planta",
                                          periodo="2026-06",
                                          factor_id="residuo_relleno",
                                          cantidad=2, unidad="t"))
        self.resultado = calcular_inventario(self.inventario, self.catalogo)

    def test_total_es_la_suma(self):
        suma = sum(r.kg_co2e for r in self.resultado.resultados)
        self.assertAlmostEqual(self.resultado.kg_co2e, suma)

    def test_los_desgloses_suman_el_total(self):
        for desglose in (self.resultado.por_alcance(), self.resultado.por_categoria(),
                         self.resultado.por_area(), self.resultado.por_periodo(),
                         self.resultado.por_gas()):
            self.assertAlmostEqual(sum(desglose.values()), self.resultado.kg_co2e, places=6)

    def test_reparto_por_alcance(self):
        por_alcance = self.resultado.por_alcance()
        self.assertGreater(por_alcance[1], 0)
        self.assertGreater(por_alcance[2], 0)
        self.assertGreater(por_alcance[3], 0)

    def test_participacion(self):
        total = self.resultado.kg_co2e
        self.assertAlmostEqual(self.resultado.participacion(total), 100.0)
        self.assertEqual(self.resultado.participacion(0), 0.0)

    def test_ranking_ordenado(self):
        ranking = self.resultado.ranking()
        valores = [r.kg_co2e for r in ranking]
        self.assertEqual(valores, sorted(valores, reverse=True))

    def test_periodos_separados(self):
        self.assertEqual(set(self.resultado.por_periodo()), {"2026-05", "2026-06"})

    def test_las_actividades_con_error_no_suman(self):
        antes = self.resultado.kg_co2e
        self.inventario.agregar(Actividad(descripcion="Rota", factor_id="fantasma",
                                          cantidad=99, unidad="kg"))
        despues = calcular_inventario(self.inventario, self.catalogo)
        self.assertAlmostEqual(despues.kg_co2e, antes)
        self.assertEqual(len(despues.errores), 1)

    def test_inventario_vacio(self):
        vacio = calcular_inventario(Inventario(), self.catalogo)
        self.assertEqual(vacio.kg_co2e, 0.0)
        self.assertEqual(vacio.ranking(), [])
        self.assertEqual(vacio.participacion(0), 0.0)

    def test_intensidad(self):
        intensidad = self.resultado.intensidad(50000, "u")
        self.assertAlmostEqual(intensidad, self.resultado.kg_co2e / 50000)
        self.assertIsNone(self.resultado.intensidad(0))

    def test_marca_factores_por_verificar(self):
        ids = {r.factor.id for r in self.resultado.requieren_verificacion}
        self.assertIn("electricidad_sen", ids)
        self.assertNotIn("diesel_estacionario_L", ids)


class PruebaModelo(unittest.TestCase):

    def test_ida_y_vuelta_json(self):
        import os
        import tempfile
        inventario = Inventario(organizacion="Planta", periodo="2026-05")
        inventario.agregar(Actividad(descripcion="Diésel",
                                     factor_id="diesel_estacionario_L",
                                     cantidad=1234.5, unidad="L", area="Calderas"))
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = os.path.join(carpeta, "inv.json")
            inventario.guardar(ruta)
            recargado = Inventario.cargar(ruta)
        self.assertEqual(recargado.organizacion, "Planta")
        self.assertEqual(len(recargado.actividades), 1)
        self.assertAlmostEqual(recargado.actividades[0].cantidad, 1234.5)

    def test_editar_y_eliminar(self):
        inventario = Inventario()
        actividad = inventario.agregar(Actividad(factor_id="glp_kg", cantidad=1, unidad="kg"))
        actividad_id = actividad.id
        copia = Actividad.desde_dict({**actividad.a_dict(), "cantidad": 9})
        self.assertTrue(inventario.reemplazar(copia))
        self.assertEqual(inventario.obtener(actividad_id).cantidad, 9)
        self.assertTrue(inventario.eliminar(actividad_id))
        self.assertFalse(inventario.eliminar(actividad_id))
        self.assertEqual(inventario.actividades, [])

    def test_ids_unicos(self):
        ids = {Actividad().id for _ in range(500)}
        self.assertEqual(len(ids), 500)


class PruebaFormato(unittest.TestCase):

    def test_kg_y_toneladas(self):
        self.assertIn("kg CO₂e", formatear(12.5))
        self.assertIn("t CO₂e", formatear(2500))


class PruebaGwpPersonalizado(unittest.TestCase):

    def test_se_puede_usar_otra_tabla_de_gwp(self):
        catalogo = CatalogoFactores([
            FactorEmision("m", "Metano", 1, "Prueba", "kg", {"CH4": 1.0})])
        actividad = Actividad(factor_id="m", cantidad=1, unidad="kg")
        ar6 = calcular_actividad(actividad, catalogo)
        ar4 = calcular_actividad(actividad, catalogo, gwp={"CH4": 25.0})
        self.assertAlmostEqual(ar6.kg_co2e, 29.8)
        self.assertAlmostEqual(ar4.kg_co2e, 25.0)


if __name__ == "__main__":
    unittest.main()
