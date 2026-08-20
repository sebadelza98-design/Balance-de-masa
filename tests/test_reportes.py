"""Pruebas de exportación, importación y línea de comandos."""
import csv
import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout

from emisiones import reportes
from emisiones.calculo import calcular_inventario
from emisiones.cli import main
from emisiones.factores import CatalogoFactores
from emisiones.modelo import Actividad, Inventario


def _inventario_de_prueba() -> Inventario:
    inventario = Inventario(organizacion="Planta Ejemplo", periodo="2026-05",
                            instalacion="Renca", responsable="Operaciones")
    inventario.agregar(Actividad(descripcion="Diésel calderas", area="Calderas",
                                 periodo="2026-05", factor_id="diesel_estacionario_L",
                                 cantidad=1250, unidad="L"))
    inventario.agregar(Actividad(descripcion="Electricidad", area="Planta",
                                 periodo="2026-05", factor_id="electricidad_sen",
                                 cantidad=180, unidad="MWh"))
    inventario.agregar(Actividad(descripcion="Recarga R-404A", area="Frío",
                                 periodo="2026-05", factor_id="ref_r404a",
                                 cantidad=12, unidad="kg"))
    inventario.agregar(Actividad(descripcion="Leña", area="Calderas",
                                 periodo="2026-05", factor_id="lena_kg",
                                 cantidad=500, unidad="kg"))
    inventario.agregar(Actividad(descripcion="Dato malo", factor_id="electricidad_sen",
                                 cantidad=5, unidad="L"))
    return inventario


class PruebaResumen(unittest.TestCase):

    def setUp(self):
        self.resultado = calcular_inventario(_inventario_de_prueba(), CatalogoFactores())
        self.texto = reportes.resumen_texto(self.resultado)

    def test_contiene_secciones_clave(self):
        for encabezado in ("TOTAL", "EMISIONES POR ALCANCE", "EMISIONES POR CATEGORÍA",
                           "EMISIONES POR GAS", "PRINCIPALES FUENTES"):
            self.assertIn(encabezado, self.texto)

    def test_advierte_errores_y_factores_referenciales(self):
        self.assertIn("ACTIVIDADES CON ERROR", self.texto)
        self.assertIn("FACTORES REFERENCIALES", self.texto)

    def test_informa_co2_biogenico(self):
        self.assertIn("biogénico", self.texto)


class PruebaExportacion(unittest.TestCase):

    def setUp(self):
        self.resultado = calcular_inventario(_inventario_de_prueba(), CatalogoFactores())
        self.carpeta = tempfile.mkdtemp()

    def test_csv(self):
        ruta = os.path.join(self.carpeta, "detalle.csv")
        reportes.exportar_csv(self.resultado, ruta)
        with open(ruta, encoding="utf-8-sig", newline="") as fh:
            filas = list(csv.DictReader(fh, delimiter=";"))
        self.assertEqual(len(filas), 5)
        self.assertEqual(list(filas[0]), reportes.COLUMNAS_CSV)
        self.assertIn(",", filas[0]["kg_co2e"])          # decimal con coma

    def test_json(self):
        ruta = os.path.join(self.carpeta, "reporte.json")
        reportes.exportar_json(self.resultado, ruta)
        with open(ruta, encoding="utf-8") as fh:
            datos = json.load(fh)
        self.assertAlmostEqual(datos["totales"]["kg_co2e"], self.resultado.kg_co2e)
        self.assertEqual(len(datos["detalle"]), 5)
        self.assertEqual(len(datos["errores"]), 1)
        self.assertAlmostEqual(sum(datos["totales"]["por_alcance"].values()),
                               self.resultado.kg_co2e, places=6)

    def test_html(self):
        ruta = os.path.join(self.carpeta, "reporte.html")
        reportes.exportar_html(self.resultado, ruta)
        with open(ruta, encoding="utf-8") as fh:
            documento = fh.read()
        self.assertIn("<!doctype html>", documento)
        self.assertIn("Planta Ejemplo", documento)
        self.assertIn("t CO₂e", documento)
        self.assertIn("Alcance 1", documento)
        self.assertEqual(documento.count("<table"), 1)

    def test_html_escapa_el_contenido(self):
        inventario = Inventario(organizacion="<script>alert(1)</script>")
        inventario.agregar(Actividad(descripcion="<b>x</b>", factor_id="glp_kg",
                                     cantidad=1, unidad="kg"))
        ruta = os.path.join(self.carpeta, "escape.html")
        reportes.exportar_html(calcular_inventario(inventario), ruta)
        with open(ruta, encoding="utf-8") as fh:
            documento = fh.read()
        self.assertNotIn("<script>alert(1)</script>", documento)
        self.assertIn("&lt;script&gt;", documento)

    def test_catalogo_csv(self):
        ruta = os.path.join(self.carpeta, "factores.csv")
        reportes.exportar_factores_csv(CatalogoFactores(), ruta)
        with open(ruta, encoding="utf-8-sig", newline="") as fh:
            filas = list(csv.DictReader(fh, delimiter=";"))
        self.assertEqual(len(filas), len(CatalogoFactores()))

    def test_inventario_vacio_no_rompe_las_exportaciones(self):
        vacio = calcular_inventario(Inventario())
        for funcion, nombre in ((reportes.exportar_csv, "v.csv"),
                                (reportes.exportar_json, "v.json"),
                                (reportes.exportar_html, "v.html")):
            funcion(vacio, os.path.join(self.carpeta, nombre))
        with open(os.path.join(self.carpeta, "v.html"), encoding="utf-8") as fh:
            self.assertIn("Sin datos", fh.read())


class PruebaImportacion(unittest.TestCase):

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()

    def test_plantilla_se_puede_reimportar(self):
        ruta = os.path.join(self.carpeta, "plantilla.csv")
        reportes.plantilla_csv(ruta)
        inventario = reportes.importar_csv(ruta)
        self.assertEqual(len(inventario.actividades), 4)
        resultado = calcular_inventario(inventario)
        self.assertEqual(resultado.errores, [])
        self.assertGreater(resultado.kg_co2e, 0)

    def test_acepta_coma_decimal_y_separador_coma(self):
        ruta = os.path.join(self.carpeta, "datos.csv")
        with open(ruta, "w", encoding="utf-8") as fh:
            fh.write("descripcion,factor_id,cantidad,unidad,periodo,area,notas\n")
            fh.write("Diésel,diesel_estacionario_L,\"1250,5\",L,2026-05,Calderas,\n")
        inventario = reportes.importar_csv(ruta)
        self.assertEqual(len(inventario.actividades), 1)
        self.assertAlmostEqual(inventario.actividades[0].cantidad, 1250.5)

    def test_acepta_miles_con_punto(self):
        ruta = os.path.join(self.carpeta, "miles.csv")
        with open(ruta, "w", encoding="utf-8") as fh:
            fh.write("descripcion;factor_id;cantidad;unidad\n")
            fh.write("Diésel;diesel_estacionario_L;1.250,50;L\n")
        inventario = reportes.importar_csv(ruta)
        self.assertAlmostEqual(inventario.actividades[0].cantidad, 1250.5)

    def test_ignora_comentarios_y_filas_incompletas(self):
        ruta = os.path.join(self.carpeta, "sucio.csv")
        with open(ruta, "w", encoding="utf-8") as fh:
            fh.write("descripcion;factor_id;cantidad;unidad\n")
            fh.write("# comentario;;;\n")
            fh.write("Sin cantidad;glp_kg;;kg\n")
            fh.write("No numérico;glp_kg;abc;kg\n")
            fh.write("Válida;glp_kg;10;kg\n")
        inventario = reportes.importar_csv(ruta)
        self.assertEqual(len(inventario.actividades), 1)
        self.assertEqual(inventario.actividades[0].descripcion, "Válida")


class PruebaLineaDeComandos(unittest.TestCase):

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()

    def _ejecutar(self, argumentos):
        salida = io.StringIO()
        with redirect_stdout(salida):
            codigo = main(argumentos)
        return codigo, salida.getvalue()

    def test_factores(self):
        codigo, salida = self._ejecutar(["factores", "--alcance", "1"])
        self.assertEqual(codigo, 0)
        self.assertIn("diesel_estacionario_L", salida)

    def test_factores_buscar(self):
        _, salida = self._ejecutar(["factores", "--buscar", "refrigerante"])
        self.assertIn("ref_r404a", salida)
        self.assertNotIn("residuo_relleno", salida)

    def test_plantilla_y_calculo_completo(self):
        plantilla = os.path.join(self.carpeta, "datos.csv")
        self._ejecutar(["plantilla", plantilla])
        self.assertTrue(os.path.isfile(plantilla))

        detalle = os.path.join(self.carpeta, "detalle.csv")
        html = os.path.join(self.carpeta, "reporte.html")
        inventario = os.path.join(self.carpeta, "inv.json")
        codigo, salida = self._ejecutar(
            ["calcular", plantilla, "--csv", detalle, "--html", html,
             "--guardar", inventario, "--organizacion", "Planta X"])
        self.assertEqual(codigo, 0)
        self.assertIn("TOTAL", salida)
        self.assertIn("Planta X", salida)
        for ruta in (detalle, html, inventario):
            self.assertTrue(os.path.isfile(ruta), ruta)

        # el inventario guardado se puede volver a calcular
        codigo, salida = self._ejecutar(["calcular", inventario])
        self.assertEqual(codigo, 0)

    def test_modo_estricto_devuelve_error(self):
        ruta = os.path.join(self.carpeta, "malo.csv")
        with open(ruta, "w", encoding="utf-8") as fh:
            fh.write("descripcion;factor_id;cantidad;unidad\n")
            fh.write("Malo;factor_inventado;10;kg\n")
        codigo, _ = self._ejecutar(["calcular", ruta, "--estricto"])
        self.assertEqual(codigo, 1)

    def test_catalogo_propio_cambia_el_resultado(self):
        propio = os.path.join(self.carpeta, "factores.json")
        with open(propio, "w", encoding="utf-8") as fh:
            json.dump({"factores": [{"id": "electricidad_sen", "nombre": "Red",
                                     "alcance": 2, "categoria": "Electricidad",
                                     "unidad": "kWh", "gases": {"CO2e": 1.0}}]}, fh)
        datos = os.path.join(self.carpeta, "e.csv")
        with open(datos, "w", encoding="utf-8") as fh:
            fh.write("descripcion;factor_id;cantidad;unidad\n")
            fh.write("Electricidad;electricidad_sen;1;MWh\n")
        _, salida = self._ejecutar(["--catalogo", propio, "calcular", datos])
        self.assertIn("1,000 t CO₂e", salida)

    def test_archivo_inexistente(self):
        with self.assertRaises(SystemExit):
            self._ejecutar(["calcular", os.path.join(self.carpeta, "no_existe.csv")])


if __name__ == "__main__":
    unittest.main()
