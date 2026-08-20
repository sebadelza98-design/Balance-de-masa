"""Pruebas de conversión de unidades."""
import unittest

from emisiones import unidades


class PruebaConversion(unittest.TestCase):

    def test_misma_unidad(self):
        self.assertEqual(unidades.convertir(5, "L", "L"), 5.0)

    def test_volumen(self):
        self.assertAlmostEqual(unidades.convertir(1, "m3", "L"), 1000.0)
        self.assertAlmostEqual(unidades.convertir(2500, "L", "m3"), 2.5)
        self.assertAlmostEqual(unidades.convertir(1, "hL", "L"), 100.0)

    def test_energia(self):
        self.assertAlmostEqual(unidades.convertir(1, "MWh", "kWh"), 1000.0)
        self.assertAlmostEqual(unidades.convertir(3.6, "MJ", "kWh"), 1.0)
        self.assertAlmostEqual(unidades.convertir(1, "TJ", "GJ"), 1000.0)

    def test_masa(self):
        self.assertAlmostEqual(unidades.convertir(1, "t", "kg"), 1000.0)
        self.assertAlmostEqual(unidades.convertir(500, "g", "kg"), 0.5)

    def test_transporte(self):
        self.assertAlmostEqual(unidades.convertir(1000, "kg*km", "t*km"), 1.0)

    def test_ida_y_vuelta(self):
        for desde, hacia in [("m3", "L"), ("MWh", "kWh"), ("t", "kg"), ("mi", "km")]:
            ida = unidades.convertir(7.5, desde, hacia)
            self.assertAlmostEqual(unidades.convertir(ida, hacia, desde), 7.5)


class PruebaNormalizacion(unittest.TestCase):

    def test_alias(self):
        self.assertEqual(unidades.normalizar("LTS"), "L")
        self.assertEqual(unidades.normalizar("m³"), "m3")
        self.assertEqual(unidades.normalizar("toneladas"), "t")
        self.assertEqual(unidades.normalizar("kwh"), "kWh")
        self.assertEqual(unidades.normalizar(" litros "), "L")

    def test_dimension(self):
        self.assertEqual(unidades.dimension("m3"), "volumen")
        self.assertEqual(unidades.dimension("kWh"), "energia")
        self.assertEqual(unidades.dimension("t*km"), "transporte")

    def test_compatibles(self):
        self.assertIn("MWh", unidades.compatibles("kWh"))
        self.assertNotIn("L", unidades.compatibles("kWh"))


class PruebaErrores(unittest.TestCase):

    def test_incompatible(self):
        with self.assertRaises(unidades.UnidadIncompatible):
            unidades.convertir(1, "kWh", "L")

    def test_desconocida(self):
        with self.assertRaises(unidades.UnidadDesconocida):
            unidades.convertir(1, "barriles", "L")
        with self.assertRaises(unidades.UnidadDesconocida):
            unidades.normalizar("")


if __name__ == "__main__":
    unittest.main()
