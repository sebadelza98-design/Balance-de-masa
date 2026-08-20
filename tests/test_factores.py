"""Pruebas del catálogo de factores de emisión."""
import json
import os
import tempfile
import unittest

from emisiones.factores import (GWP_AR6, CatalogoFactores, FactorEmision,
                                catalogo_base, catalogo_por_defecto)


class PruebaValoresDerivados(unittest.TestCase):
    """Los factores de combustión deben coincidir con el cálculo a mano."""

    def setUp(self):
        self.catalogo = CatalogoFactores()

    def _co2e(self, factor_id):
        return self.catalogo.obtener(factor_id).co2e_unitario()

    def test_gas_natural(self):
        # 0,0336 GJ/m³ × 56,1 kg CO₂/GJ = 1,8850 kg CO₂/m³ (+ CH₄ y N₂O)
        self.assertAlmostEqual(self._co2e("gas_natural_m3"), 1.8869, places=3)

    def test_diesel_estacionario(self):
        # 0,03612 GJ/L × 74,1 kg CO₂/GJ = 2,6765 kg CO₂/L
        self.assertAlmostEqual(self._co2e("diesel_estacionario_L"), 2.6856, places=3)

    def test_diesel_movil_emite_mas_que_estacionario(self):
        # mismo CO₂, pero más CH₄ y N₂O por el ciclo del motor
        self.assertGreater(self._co2e("diesel_movil_L"), self._co2e("diesel_estacionario_L"))

    def test_gasolina(self):
        self.assertAlmostEqual(self._co2e("gasolina_movil_L"), 2.3422, places=3)

    def test_glp_kg_y_litro_son_coherentes(self):
        # densidad del GLP: 0,540 kg/L
        self.assertAlmostEqual(self._co2e("glp_L"), self._co2e("glp_kg") * 0.54, places=4)

    def test_mezcla_refrigerante(self):
        # R-404A = 44% HFC-125 + 4% HFC-134a + 52% HFC-143a
        esperado = (0.44 * GWP_AR6["HFC-125"] + 0.04 * GWP_AR6["HFC-134a"]
                    + 0.52 * GWP_AR6["HFC-143a"])
        self.assertAlmostEqual(self._co2e("ref_r404a"), esperado, places=6)
        self.assertAlmostEqual(self._co2e("ref_r410a"), 2255.5, places=6)

    def test_refrigerante_puro_equivale_a_su_gwp(self):
        self.assertAlmostEqual(self._co2e("ref_r134a"), GWP_AR6["HFC-134a"])

    def test_amoniaco_no_aporta_co2e(self):
        self.assertEqual(self._co2e("ref_amoniaco"), 0.0)

    def test_co2_de_proceso(self):
        self.assertAlmostEqual(self._co2e("co2_carbonatacion"), 1.0)

    def test_biomasa_separa_co2_biogenico(self):
        lena = self.catalogo.obtener("lena_kg")
        self.assertGreater(lena.co2_biogenico, 1.0)      # se contabiliza aparte
        self.assertLess(lena.co2e_unitario(), 0.1)       # sólo CH₄ y N₂O entran al total

    def test_efluente_anaerobio(self):
        # Bo 0,6 kg CH₄/kg DBO × MCF 0,8 × GWP 29,8
        self.assertAlmostEqual(self._co2e("efluente_dbo_anaerobio"), 0.48 * 29.8, places=6)


class PruebaCatalogo(unittest.TestCase):

    def setUp(self):
        self.catalogo = CatalogoFactores()

    def test_todos_los_factores_son_validos(self):
        for factor in self.catalogo:
            self.assertIn(factor.alcance, (1, 2, 3), factor.id)
            self.assertTrue(factor.gases, f"{factor.id} no declara gases")
            self.assertGreaterEqual(factor.co2e_unitario(), 0.0, factor.id)
            for gas in factor.gases:
                self.assertIn(gas, GWP_AR6, f"{factor.id} usa un gas sin GWP")

    def test_identificadores_unicos(self):
        ids = [f.id for f in catalogo_base()]
        self.assertEqual(len(ids), len(set(ids)))

    def test_filtros(self):
        alcance1 = self.catalogo.listar(alcance=1)
        self.assertTrue(all(f.alcance == 1 for f in alcance1))
        self.assertTrue(self.catalogo.listar(buscar="diesel"))
        self.assertEqual(self.catalogo.listar(buscar="zzzz"), [])

    def test_factor_inexistente(self):
        with self.assertRaises(KeyError):
            self.catalogo.obtener("no_existe")

    def test_gas_sin_gwp(self):
        factor = FactorEmision("x", "X", 1, "C", "kg", {"GAS_RARO": 1.0})
        with self.assertRaises(ValueError):
            factor.co2e_unitario()

    def test_ida_y_vuelta_json(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = os.path.join(carpeta, "factores.json")
            self.catalogo.guardar(ruta)
            recargado = CatalogoFactores.cargar(ruta)
            self.assertEqual(len(recargado), len(self.catalogo))
            for original in self.catalogo:
                self.assertAlmostEqual(original.co2e_unitario(),
                                       recargado.obtener(original.id).co2e_unitario())

    def test_catalogo_propio_sobrescribe_el_base(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = os.path.join(carpeta, "mios.json")
            with open(ruta, "w", encoding="utf-8") as fh:
                json.dump({"factores": [{
                    "id": "electricidad_sen", "nombre": "Red propia", "alcance": 2,
                    "categoria": "Electricidad", "unidad": "kWh",
                    "gases": {"CO2e": 0.25},
                }]}, fh)
            combinado = catalogo_por_defecto(ruta)
            self.assertAlmostEqual(
                combinado.obtener("electricidad_sen").co2e_unitario(), 0.25)
            # el resto del catálogo base sigue disponible
            self.assertIn("diesel_estacionario_L", combinado)


if __name__ == "__main__":
    unittest.main()


class PruebaBusquedaDeCatalogo(unittest.TestCase):
    """El catálogo propio debe encontrarse junto al ejecutable o en el cwd."""

    def test_busca_en_el_directorio_de_trabajo(self):
        with tempfile.TemporaryDirectory() as carpeta:
            with open(os.path.join(carpeta, "factores_emision.json"), "w",
                      encoding="utf-8") as fh:
                json.dump({"factores": [{"id": "glp_kg", "nombre": "GLP propio",
                                         "alcance": 1, "categoria": "Combustión estacionaria",
                                         "unidad": "kg", "gases": {"CO2e": 3.5}}]}, fh)
            anterior = os.getcwd()
            try:
                os.chdir(carpeta)
                catalogo = catalogo_por_defecto()
            finally:
                os.chdir(anterior)
        self.assertAlmostEqual(catalogo.obtener("glp_kg").co2e_unitario(), 3.5)
        self.assertIn("diesel_estacionario_L", catalogo)

    def test_sin_archivo_devuelve_el_catalogo_base(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as carpeta:
            with mock.patch("emisiones.factores._directorios_de_busqueda",
                            return_value=[carpeta]):
                catalogo = catalogo_por_defecto()
        self.assertEqual(len(catalogo), len(catalogo_base()))
