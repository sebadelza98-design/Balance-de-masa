"""
gui.py
Interfaz gráfica de la calculadora de emisiones (Tkinter, sin dependencias).

Cuatro pestañas:
    1. Datos de actividad — ingreso y edición de consumos
    2. Factores           — catálogo consultable y editable
    3. Resultados         — totales, gráfico de barras y detalle
    4. Reporte            — resumen imprimible y exportación

Se usa sólo la biblioteca estándar para que el ejecutable generado con
PyInstaller sea liviano y no requiera instalar nada en el equipo destino.
"""
from __future__ import annotations
from typing import Dict, List, Optional
import csv
import os
import webbrowser

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from .calculo import (ResultadoInventario, calcular_actividad, calcular_inventario,
                      formatear)
from .factores import (ALCANCES, CatalogoFactores, FactorEmision, NOMBRES_GAS,
                       catalogo_por_defecto)
from .modelo import Actividad, Inventario
from . import reportes
from . import unidades

APP_NOMBRE = "Calculadora de Emisiones GEI"
VERSION = "1.0.0"

# Paleta
C_FONDO = "#f4f6f7"
C_PANEL = "#ffffff"
C_TINTA = "#12222b"
C_SUAVE = "#5b7280"
C_ACENTO = "#0f7b6c"
C_ALCANCE = {1: "#c0392b", 2: "#e08a1e", 3: "#2b6cb0"}


# ─────────────────────────────────────────────
# Aplicación
# ─────────────────────────────────────────────

class AplicacionEmisiones(tk.Tk):
    """Ventana principal."""

    def __init__(self, ruta_catalogo: Optional[str] = None,
                 ruta_inventario: Optional[str] = None):
        super().__init__()
        self.title(APP_NOMBRE)
        self.geometry("1120x730")
        self.minsize(940, 620)
        self.configure(bg=C_FONDO)

        self.catalogo: CatalogoFactores = catalogo_por_defecto(ruta_catalogo)
        self.inventario: Inventario = Inventario()
        self.resultado: Optional[ResultadoInventario] = None
        self.archivo_actual: Optional[str] = None
        self.actividad_editando: Optional[str] = None

        self._configurar_estilo()
        self._construir_menu()
        self._construir_cabecera()
        self._construir_pestanas()
        self._construir_barra_estado()

        if ruta_inventario and os.path.isfile(ruta_inventario):
            self._abrir_archivo(ruta_inventario)
        else:
            self._recalcular()

        self.protocol("WM_DELETE_WINDOW", self._salir)

    # ── estilo ──────────────────────────────
    def _configurar_estilo(self) -> None:
        estilo = ttk.Style(self)
        if "clam" in estilo.theme_names():
            estilo.theme_use("clam")
        estilo.configure(".", background=C_FONDO, foreground=C_TINTA,
                         font=("Segoe UI", 10))
        estilo.configure("TFrame", background=C_FONDO)
        estilo.configure("Panel.TFrame", background=C_PANEL, relief="flat")
        estilo.configure("TLabelframe", background=C_PANEL)
        estilo.configure("TLabelframe.Label", background=C_PANEL,
                         foreground=C_SUAVE, font=("Segoe UI", 9, "bold"))
        estilo.configure("TLabel", background=C_FONDO)
        estilo.configure("Panel.TLabel", background=C_PANEL)
        estilo.configure("Titulo.TLabel", background=C_ACENTO, foreground="white",
                         font=("Segoe UI", 15, "bold"))
        estilo.configure("Sub.TLabel", background=C_ACENTO, foreground="#d6ece7",
                         font=("Segoe UI", 9))
        estilo.configure("Suave.TLabel", background=C_PANEL, foreground=C_SUAVE,
                         font=("Segoe UI", 9))
        estilo.configure("Total.TLabel", background=C_PANEL, foreground=C_ACENTO,
                         font=("Segoe UI", 22, "bold"))
        estilo.configure("Aviso.TLabel", background="#fff8e6", foreground="#8a6100",
                         font=("Segoe UI", 9))
        estilo.configure("Accion.TButton", font=("Segoe UI", 10, "bold"),
                         background=C_ACENTO, foreground="white", padding=7)
        estilo.map("Accion.TButton",
                   background=[("active", "#0c6355"), ("disabled", "#9db9b3")])
        estilo.configure("TButton", padding=5)
        estilo.configure("Treeview", background=C_PANEL, fieldbackground=C_PANEL,
                         rowheight=24, font=("Segoe UI", 9))
        estilo.configure("Treeview.Heading", font=("Segoe UI", 9, "bold"))
        estilo.configure("TNotebook", background=C_FONDO, borderwidth=0)
        estilo.configure("TNotebook.Tab", padding=(18, 9), font=("Segoe UI", 10))

    # ── menú ────────────────────────────────
    def _construir_menu(self) -> None:
        barra = tk.Menu(self)

        archivo = tk.Menu(barra, tearoff=0)
        archivo.add_command(label="Nuevo inventario", accelerator="Ctrl+N",
                            command=self._nuevo)
        archivo.add_command(label="Abrir…", accelerator="Ctrl+O", command=self._abrir)
        archivo.add_command(label="Guardar", accelerator="Ctrl+S", command=self._guardar)
        archivo.add_command(label="Guardar como…", command=self._guardar_como)
        archivo.add_separator()
        archivo.add_command(label="Importar actividades desde CSV…", command=self._importar_csv)
        archivo.add_command(label="Crear plantilla CSV…", command=self._crear_plantilla)
        archivo.add_separator()
        archivo.add_command(label="Exportar reporte HTML…", command=self._exportar_html)
        archivo.add_command(label="Exportar detalle CSV…", command=self._exportar_csv)
        archivo.add_command(label="Exportar reporte JSON…", command=self._exportar_json)
        archivo.add_separator()
        archivo.add_command(label="Salir", command=self._salir)
        barra.add_cascade(label="Archivo", menu=archivo)

        factores = tk.Menu(barra, tearoff=0)
        factores.add_command(label="Editar factor seleccionado…",
                             command=self._editar_factor)
        factores.add_command(label="Agregar factor propio…", command=self._nuevo_factor)
        factores.add_separator()
        factores.add_command(label="Importar catálogo JSON…", command=self._importar_catalogo)
        factores.add_command(label="Exportar catálogo JSON…", command=self._exportar_catalogo)
        factores.add_command(label="Exportar catálogo CSV…", command=self._exportar_catalogo_csv)
        factores.add_separator()
        factores.add_command(label="Restaurar catálogo por defecto",
                             command=self._restaurar_catalogo)
        barra.add_cascade(label="Factores", menu=factores)

        ayuda = tk.Menu(barra, tearoff=0)
        ayuda.add_command(label="Cómo se calcula", command=self._ayuda_metodo)
        ayuda.add_command(label="Acerca de", command=self._acerca_de)
        barra.add_cascade(label="Ayuda", menu=ayuda)

        self.config(menu=barra)
        self.bind("<Control-n>", lambda e: self._nuevo())
        self.bind("<Control-o>", lambda e: self._abrir())
        self.bind("<Control-s>", lambda e: self._guardar())

    # ── cabecera ────────────────────────────
    def _construir_cabecera(self) -> None:
        cabecera = tk.Frame(self, bg=C_ACENTO, height=64)
        cabecera.pack(fill="x", side="top")
        cabecera.pack_propagate(False)

        izq = tk.Frame(cabecera, bg=C_ACENTO)
        izq.pack(side="left", padx=20, pady=10)
        ttk.Label(izq, text=APP_NOMBRE, style="Titulo.TLabel").pack(anchor="w")
        ttk.Label(izq, text="Alcances 1, 2 y 3 · GHG Protocol · GWP-100 IPCC AR6",
                  style="Sub.TLabel").pack(anchor="w")

        self.var_total_cabecera = tk.StringVar(value="0,000 t CO₂e")
        der = tk.Frame(cabecera, bg=C_ACENTO)
        der.pack(side="right", padx=20)
        tk.Label(der, textvariable=self.var_total_cabecera, bg=C_ACENTO, fg="white",
                 font=("Segoe UI", 19, "bold")).pack(anchor="e", pady=(12, 0))
        tk.Label(der, text="total del inventario", bg=C_ACENTO, fg="#d6ece7",
                 font=("Segoe UI", 9)).pack(anchor="e")

    # ── pestañas ────────────────────────────
    def _construir_pestanas(self) -> None:
        self.pestanas = ttk.Notebook(self)
        self.pestanas.pack(fill="both", expand=True, padx=12, pady=(10, 6))

        self.tab_datos = ttk.Frame(self.pestanas)
        self.tab_factores = ttk.Frame(self.pestanas)
        self.tab_resultados = ttk.Frame(self.pestanas)
        self.tab_reporte = ttk.Frame(self.pestanas)

        self.pestanas.add(self.tab_datos, text="  1 · Datos de actividad  ")
        self.pestanas.add(self.tab_factores, text="  2 · Factores  ")
        self.pestanas.add(self.tab_resultados, text="  3 · Resultados  ")
        self.pestanas.add(self.tab_reporte, text="  4 · Reporte  ")

        self._construir_tab_datos()
        self._construir_tab_factores()
        self._construir_tab_resultados()
        self._construir_tab_reporte()

        self.pestanas.bind("<<NotebookTabChanged>>", lambda e: self._recalcular())

    def _construir_barra_estado(self) -> None:
        self.var_estado = tk.StringVar(value="Listo. Cargue sus datos de consumo.")
        barra = tk.Frame(self, bg="#e6eaec", height=26)
        barra.pack(fill="x", side="bottom")
        tk.Label(barra, textvariable=self.var_estado, bg="#e6eaec", fg=C_SUAVE,
                 font=("Segoe UI", 9), anchor="w").pack(side="left", padx=14, pady=4)

    # ─────────────────────────────────────────
    # Pestaña 1 · Datos de actividad
    # ─────────────────────────────────────────
    def _construir_tab_datos(self) -> None:
        contenedor = self.tab_datos

        # Datos del inventario
        marco_inv = ttk.LabelFrame(contenedor, text=" Identificación del inventario ",
                                   padding=12)
        marco_inv.pack(fill="x", padx=6, pady=(10, 6))

        self.var_org = tk.StringVar()
        self.var_instalacion = tk.StringVar()
        self.var_periodo_inv = tk.StringVar()
        self.var_responsable = tk.StringVar()

        campos = [("Organización", self.var_org, 26), ("Instalación", self.var_instalacion, 22),
                  ("Período", self.var_periodo_inv, 12), ("Responsable", self.var_responsable, 20)]
        for col, (etiqueta, variable, ancho) in enumerate(campos):
            celda = ttk.Frame(marco_inv, style="Panel.TFrame")
            celda.grid(row=0, column=col, sticky="w", padx=(0, 18))
            ttk.Label(celda, text=etiqueta, style="Suave.TLabel").pack(anchor="w")
            entrada = ttk.Entry(celda, textvariable=variable, width=ancho)
            entrada.pack(anchor="w")
            variable.trace_add("write", lambda *_: self._sincronizar_inventario())

        # Formulario de actividad
        marco_form = ttk.LabelFrame(contenedor, text=" Agregar dato de actividad ", padding=12)
        marco_form.pack(fill="x", padx=6, pady=6)

        self.var_alcance = tk.StringVar()
        self.var_categoria = tk.StringVar()
        self.var_factor = tk.StringVar()
        self.var_cantidad = tk.StringVar()
        self.var_unidad = tk.StringVar()
        self.var_descripcion = tk.StringVar()
        self.var_periodo = tk.StringVar()
        self.var_area = tk.StringVar()

        fila1 = ttk.Frame(marco_form, style="Panel.TFrame")
        fila1.pack(fill="x", pady=(0, 8))

        self.combo_alcance = self._campo_combo(
            fila1, "Alcance", self.var_alcance,
            [ALCANCES[a] for a in (1, 2, 3)], 46, self._al_cambiar_alcance)
        self.combo_categoria = self._campo_combo(
            fila1, "Categoría", self.var_categoria, [], 30, self._al_cambiar_categoria)

        fila2 = ttk.Frame(marco_form, style="Panel.TFrame")
        fila2.pack(fill="x", pady=(0, 8))
        self.combo_factor = self._campo_combo(
            fila2, "Fuente de emisión", self.var_factor, [], 58, self._al_cambiar_factor)
        self.combo_unidad = self._campo_combo(fila2, "Unidad", self.var_unidad, [], 10)
        self._campo_entrada(fila2, "Cantidad", self.var_cantidad, 14)

        fila3 = ttk.Frame(marco_form, style="Panel.TFrame")
        fila3.pack(fill="x")
        self._campo_entrada(fila3, "Descripción", self.var_descripcion, 34)
        self._campo_entrada(fila3, "Período", self.var_periodo, 12)
        self._campo_entrada(fila3, "Área / centro de costo", self.var_area, 20)

        acciones = ttk.Frame(fila3, style="Panel.TFrame")
        acciones.pack(side="left", padx=(18, 0), pady=(14, 0))
        self.boton_agregar = ttk.Button(acciones, text="Agregar  ➜", style="Accion.TButton",
                                        command=self._agregar_actividad)
        self.boton_agregar.pack(side="left")
        ttk.Button(acciones, text="Limpiar", command=self._limpiar_formulario).pack(
            side="left", padx=6)

        self.var_previo = tk.StringVar(value="")
        ttk.Label(marco_form, textvariable=self.var_previo, style="Suave.TLabel").pack(
            anchor="w", pady=(10, 0))

        # Tabla de actividades
        marco_tabla = ttk.LabelFrame(contenedor, text=" Actividades cargadas ", padding=8)
        marco_tabla.pack(fill="both", expand=True, padx=6, pady=(6, 10))

        columnas = ("descripcion", "factor", "alcance", "cantidad", "unidad",
                    "periodo", "area", "emisiones")
        titulos = {"descripcion": "Descripción", "factor": "Fuente de emisión",
                   "alcance": "Alc.", "cantidad": "Cantidad", "unidad": "Unidad",
                   "periodo": "Período", "area": "Área", "emisiones": "kg CO₂e"}
        anchos = {"descripcion": 230, "factor": 230, "alcance": 45, "cantidad": 105,
                  "unidad": 65, "periodo": 85, "area": 130, "emisiones": 120}

        contenido = ttk.Frame(marco_tabla)
        contenido.pack(fill="both", expand=True)
        self.tabla = ttk.Treeview(contenido, columns=columnas, show="headings",
                                  selectmode="browse")
        for col in columnas:
            self.tabla.heading(col, text=titulos[col])
            self.tabla.column(col, width=anchos[col],
                              anchor="e" if col in ("cantidad", "emisiones", "alcance") else "w")
        barra_v = ttk.Scrollbar(contenido, orient="vertical", command=self.tabla.yview)
        self.tabla.configure(yscrollcommand=barra_v.set)
        self.tabla.pack(side="left", fill="both", expand=True)
        barra_v.pack(side="right", fill="y")
        self.tabla.tag_configure("error", background="#fdf1f0", foreground="#a03027")
        self.tabla.tag_configure("verificar", background="#fff8e6")
        self.tabla.bind("<Double-1>", lambda e: self._editar_actividad())

        botones = ttk.Frame(marco_tabla)
        botones.pack(fill="x", pady=(8, 0))
        ttk.Button(botones, text="Editar", command=self._editar_actividad).pack(side="left")
        ttk.Button(botones, text="Duplicar", command=self._duplicar_actividad).pack(
            side="left", padx=6)
        ttk.Button(botones, text="Eliminar", command=self._eliminar_actividad).pack(side="left")
        ttk.Button(botones, text="Vaciar tabla", command=self._vaciar).pack(side="left", padx=6)
        ttk.Button(botones, text="Ver resultados  ➜", style="Accion.TButton",
                   command=lambda: self.pestanas.select(self.tab_resultados)).pack(side="right")

        self._al_cambiar_alcance()

    def _campo_combo(self, padre, etiqueta, variable, valores, ancho, callback=None):
        celda = ttk.Frame(padre, style="Panel.TFrame")
        celda.pack(side="left", padx=(0, 14))
        ttk.Label(celda, text=etiqueta, style="Suave.TLabel").pack(anchor="w")
        combo = ttk.Combobox(celda, textvariable=variable, values=valores,
                             width=ancho, state="readonly")
        combo.pack(anchor="w")
        if callback:
            combo.bind("<<ComboboxSelected>>", lambda e: callback())
        return combo

    def _campo_entrada(self, padre, etiqueta, variable, ancho):
        celda = ttk.Frame(padre, style="Panel.TFrame")
        celda.pack(side="left", padx=(0, 14))
        ttk.Label(celda, text=etiqueta, style="Suave.TLabel").pack(anchor="w")
        entrada = ttk.Entry(celda, textvariable=variable, width=ancho)
        entrada.pack(anchor="w")
        entrada.bind("<Return>", lambda e: self._agregar_actividad())
        return entrada

    # ── lógica del formulario ───────────────
    def _alcance_seleccionado(self) -> int:
        for numero, texto in ALCANCES.items():
            if texto == self.var_alcance.get():
                return numero
        return 1

    def _al_cambiar_alcance(self) -> None:
        if not self.var_alcance.get():
            self.var_alcance.set(ALCANCES[1])
        categorias = self.catalogo.categorias(alcance=self._alcance_seleccionado())
        self.combo_categoria["values"] = categorias
        if categorias:
            self.var_categoria.set(categorias[0])
        self._al_cambiar_categoria()

    def _al_cambiar_categoria(self) -> None:
        self._factores_visibles = self.catalogo.listar(
            alcance=self._alcance_seleccionado(),
            categoria=self.var_categoria.get() or None)
        etiquetas = [f.nombre + (" ⚠" if f.verificar else "") for f in self._factores_visibles]
        self.combo_factor["values"] = etiquetas
        if etiquetas:
            self.var_factor.set(etiquetas[0])
        else:
            self.var_factor.set("")
        self._al_cambiar_factor()

    def _factor_seleccionado(self) -> Optional[FactorEmision]:
        etiquetas = list(self.combo_factor["values"])
        if self.var_factor.get() in etiquetas:
            return self._factores_visibles[etiquetas.index(self.var_factor.get())]
        return None

    def _al_cambiar_factor(self) -> None:
        factor = self._factor_seleccionado()
        if factor is None:
            self.combo_unidad["values"] = []
            self.var_previo.set("")
            return
        compatibles = unidades.compatibles(factor.unidad)
        self.combo_unidad["values"] = compatibles
        if self.var_unidad.get() not in compatibles:
            self.var_unidad.set(factor.unidad)
        texto = (f"Factor: {factor.co2e_unitario():,.5f} kg CO₂e por {factor.unidad}"
                 f"   ·   {factor.fuente}")
        if factor.verificar:
            texto += "   ⚠ valor referencial: verifíquelo antes de reportar"
        if factor.notas:
            texto += f"\n{factor.notas}"
        self.var_previo.set(texto)

    def _leer_cantidad(self) -> Optional[float]:
        crudo = self.var_cantidad.get().strip().replace(" ", "")
        if not crudo:
            messagebox.showwarning(APP_NOMBRE, "Ingrese la cantidad consumida.")
            return None
        if "," in crudo and "." in crudo:
            crudo = crudo.replace(".", "").replace(",", ".")
        else:
            crudo = crudo.replace(",", ".")
        try:
            valor = float(crudo)
        except ValueError:
            messagebox.showerror(APP_NOMBRE, f"«{self.var_cantidad.get()}» no es un número.")
            return None
        if valor < 0:
            messagebox.showwarning(APP_NOMBRE, "La cantidad no puede ser negativa.")
            return None
        return valor

    def _agregar_actividad(self) -> None:
        factor = self._factor_seleccionado()
        if factor is None:
            messagebox.showwarning(APP_NOMBRE, "Elija una fuente de emisión.")
            return
        cantidad = self._leer_cantidad()
        if cantidad is None:
            return

        actividad = Actividad(
            descripcion=self.var_descripcion.get().strip() or factor.nombre,
            factor_id=factor.id,
            cantidad=cantidad,
            unidad=self.var_unidad.get() or factor.unidad,
            periodo=self.var_periodo.get().strip() or self.var_periodo_inv.get().strip(),
            area=self.var_area.get().strip(),
        )
        if self.actividad_editando:
            actividad.id = self.actividad_editando
            self.inventario.reemplazar(actividad)
            self.actividad_editando = None
            self.boton_agregar.config(text="Agregar  ➜")
            mensaje = "Actividad actualizada"
        else:
            self.inventario.agregar(actividad)
            mensaje = "Actividad agregada"

        calculo = calcular_actividad(actividad, self.catalogo)
        self.var_estado.set(f"{mensaje}: {actividad.descripcion} — {formatear(calculo.kg_co2e)}")
        self.var_cantidad.set("")
        self.var_descripcion.set("")
        self._recalcular()

    def _limpiar_formulario(self) -> None:
        self.var_cantidad.set("")
        self.var_descripcion.set("")
        self.var_area.set("")
        self.actividad_editando = None
        self.boton_agregar.config(text="Agregar  ➜")

    def _actividad_seleccionada(self) -> Optional[Actividad]:
        seleccion = self.tabla.selection()
        if not seleccion:
            messagebox.showinfo(APP_NOMBRE, "Seleccione una actividad de la tabla.")
            return None
        return self.inventario.obtener(seleccion[0])

    def _editar_actividad(self) -> None:
        actividad = self._actividad_seleccionada()
        if actividad is None:
            return
        try:
            factor = self.catalogo.obtener(actividad.factor_id)
        except KeyError:
            messagebox.showerror(APP_NOMBRE,
                                 f"El factor «{actividad.factor_id}» ya no existe.")
            return
        self.var_alcance.set(ALCANCES[factor.alcance])
        self._al_cambiar_alcance()
        self.var_categoria.set(factor.categoria)
        self._al_cambiar_categoria()
        etiquetas = list(self.combo_factor["values"])
        for etiqueta in etiquetas:
            if etiqueta.startswith(factor.nombre):
                self.var_factor.set(etiqueta)
                break
        self._al_cambiar_factor()
        self.var_cantidad.set(f"{actividad.cantidad:g}")
        self.var_unidad.set(actividad.unidad)
        self.var_descripcion.set(actividad.descripcion)
        self.var_periodo.set(actividad.periodo)
        self.var_area.set(actividad.area)
        self.actividad_editando = actividad.id
        self.boton_agregar.config(text="Guardar cambios")
        self.var_estado.set(f"Editando «{actividad.descripcion}». "
                            "Modifique los campos y pulse Guardar cambios.")

    def _duplicar_actividad(self) -> None:
        actividad = self._actividad_seleccionada()
        if actividad is None:
            return
        copia = Actividad.desde_dict({**actividad.a_dict(), "id": ""})
        copia.descripcion = f"{actividad.descripcion} (copia)"
        self.inventario.agregar(copia)
        self._recalcular()
        self.var_estado.set(f"Duplicada: {copia.descripcion}")

    def _eliminar_actividad(self) -> None:
        actividad = self._actividad_seleccionada()
        if actividad is None:
            return
        if messagebox.askyesno(APP_NOMBRE,
                               f"¿Eliminar «{actividad.descripcion or actividad.id}»?"):
            self.inventario.eliminar(actividad.id)
            self._recalcular()
            self.var_estado.set("Actividad eliminada.")

    def _vaciar(self) -> None:
        if not self.inventario.actividades:
            return
        if messagebox.askyesno(APP_NOMBRE, "¿Eliminar todas las actividades cargadas?"):
            self.inventario.actividades = []
            self._recalcular()
            self.var_estado.set("Tabla vaciada.")

    # ─────────────────────────────────────────
    # Pestaña 2 · Factores
    # ─────────────────────────────────────────
    def _construir_tab_factores(self) -> None:
        contenedor = self.tab_factores

        superior = ttk.Frame(contenedor)
        superior.pack(fill="x", padx=6, pady=(10, 6))
        ttk.Label(superior, text="Buscar:").pack(side="left")
        self.var_buscar_factor = tk.StringVar()
        entrada = ttk.Entry(superior, textvariable=self.var_buscar_factor, width=32)
        entrada.pack(side="left", padx=8)
        entrada.bind("<KeyRelease>", lambda e: self._refrescar_factores())
        ttk.Button(superior, text="Editar factor", command=self._editar_factor).pack(side="left")
        ttk.Button(superior, text="Agregar propio", command=self._nuevo_factor).pack(
            side="left", padx=6)
        ttk.Button(superior, text="Eliminar", command=self._eliminar_factor).pack(side="left")
        ttk.Label(superior, text="⚠ = valor referencial, reemplácelo por su dato oficial",
                  foreground="#8a6100").pack(side="right")

        marco = ttk.Frame(contenedor)
        marco.pack(fill="both", expand=True, padx=6, pady=(0, 10))
        columnas = ("id", "nombre", "alcance", "categoria", "unidad", "valor", "fuente")
        titulos = {"id": "Identificador", "nombre": "Nombre", "alcance": "Alc.",
                   "categoria": "Categoría", "unidad": "Unidad",
                   "valor": "kg CO₂e / unidad", "fuente": "Fuente"}
        anchos = {"id": 175, "nombre": 265, "alcance": 45, "categoria": 165,
                  "unidad": 60, "valor": 125, "fuente": 260}
        self.tabla_factores = ttk.Treeview(marco, columns=columnas, show="headings",
                                           selectmode="browse")
        for col in columnas:
            self.tabla_factores.heading(col, text=titulos[col])
            self.tabla_factores.column(
                col, width=anchos[col],
                anchor="e" if col in ("valor", "alcance") else "w")
        barra = ttk.Scrollbar(marco, orient="vertical", command=self.tabla_factores.yview)
        self.tabla_factores.configure(yscrollcommand=barra.set)
        self.tabla_factores.pack(side="left", fill="both", expand=True)
        barra.pack(side="right", fill="y")
        self.tabla_factores.tag_configure("verificar", background="#fff8e6")
        self.tabla_factores.bind("<Double-1>", lambda e: self._editar_factor())

        self._refrescar_factores()

    def _refrescar_factores(self) -> None:
        self.tabla_factores.delete(*self.tabla_factores.get_children())
        for f in self.catalogo.listar(buscar=self.var_buscar_factor.get() or None):
            self.tabla_factores.insert(
                "", "end", iid=f.id,
                values=(f.id, f.nombre + (" ⚠" if f.verificar else ""), f.alcance,
                        f.categoria, f.unidad, f"{f.co2e_unitario():,.5f}", f.fuente),
                tags=("verificar",) if f.verificar else ())

    def _editar_factor(self) -> None:
        seleccion = self.tabla_factores.selection()
        if not seleccion:
            messagebox.showinfo(APP_NOMBRE, "Seleccione un factor de la lista.")
            return
        DialogoFactor(self, self.catalogo.obtener(seleccion[0]), self._guardar_factor)

    def _nuevo_factor(self) -> None:
        base = FactorEmision(id="factor_propio", nombre="Factor propio", alcance=1,
                             categoria="Definidos por el usuario", unidad="kg",
                             gases={"CO2e": 1.0}, fuente="Dato propio", verificar=True)
        DialogoFactor(self, base, self._guardar_factor, nuevo=True)

    def _guardar_factor(self, factor: FactorEmision) -> None:
        self.catalogo.agregar(factor)
        self._refrescar_factores()
        self._al_cambiar_alcance()
        self._recalcular()
        self.var_estado.set(f"Factor guardado: {factor.id}")

    def _eliminar_factor(self) -> None:
        seleccion = self.tabla_factores.selection()
        if not seleccion:
            return
        factor_id = seleccion[0]
        en_uso = [a for a in self.inventario.actividades if a.factor_id == factor_id]
        if en_uso:
            messagebox.showwarning(
                APP_NOMBRE,
                f"No se puede eliminar: {len(en_uso)} actividad(es) usan este factor.")
            return
        if messagebox.askyesno(APP_NOMBRE, f"¿Eliminar el factor «{factor_id}»?"):
            self.catalogo.eliminar(factor_id)
            self._refrescar_factores()
            self._al_cambiar_alcance()

    # ─────────────────────────────────────────
    # Pestaña 3 · Resultados
    # ─────────────────────────────────────────
    def _construir_tab_resultados(self) -> None:
        contenedor = self.tab_resultados

        self.marco_tarjetas = ttk.Frame(contenedor)
        self.marco_tarjetas.pack(fill="x", padx=6, pady=(10, 4))

        medio = ttk.Frame(contenedor)
        medio.pack(fill="both", expand=True, padx=6, pady=6)

        marco_grafico = ttk.LabelFrame(medio, text=" Distribución de las emisiones ", padding=8)
        marco_grafico.pack(side="left", fill="both", expand=True)

        controles = ttk.Frame(marco_grafico)
        controles.pack(fill="x", pady=(0, 6))
        ttk.Label(controles, text="Agrupar por:").pack(side="left")
        self.var_agrupar = tk.StringVar(value="Categoría")
        combo = ttk.Combobox(controles, textvariable=self.var_agrupar, width=16,
                             state="readonly",
                             values=["Categoría", "Alcance", "Área", "Período", "Gas"])
        combo.pack(side="left", padx=8)
        combo.bind("<<ComboboxSelected>>", lambda e: self._dibujar_grafico())

        self.lienzo = tk.Canvas(marco_grafico, bg=C_PANEL, highlightthickness=0, height=300)
        self.lienzo.pack(fill="both", expand=True)
        self.lienzo.bind("<Configure>", lambda e: self._dibujar_grafico())

        marco_top = ttk.LabelFrame(medio, text=" Principales fuentes ", padding=8)
        marco_top.pack(side="right", fill="both", padx=(10, 0))
        self.tabla_top = ttk.Treeview(marco_top, columns=("fuente", "kg", "pct"),
                                      show="headings", height=12, selectmode="none")
        for col, titulo, ancho, anclaje in (("fuente", "Actividad", 210, "w"),
                                            ("kg", "t CO₂e", 90, "e"),
                                            ("pct", "%", 55, "e")):
            self.tabla_top.heading(col, text=titulo)
            self.tabla_top.column(col, width=ancho, anchor=anclaje)
        self.tabla_top.pack(fill="both", expand=True)

        self.marco_avisos = ttk.Frame(contenedor)
        self.marco_avisos.pack(fill="x", padx=6, pady=(0, 10))

    def _tarjeta(self, padre, titulo: str, valor: str, pie: str, color: str) -> None:
        tarjeta = tk.Frame(padre, bg=C_PANEL, highlightbackground="#dfe6ea",
                           highlightthickness=1)
        tarjeta.pack(side="left", fill="both", expand=True, padx=4)
        tk.Frame(tarjeta, bg=color, width=5).pack(side="left", fill="y")
        interior = tk.Frame(tarjeta, bg=C_PANEL)
        interior.pack(side="left", fill="both", expand=True, padx=12, pady=9)
        tk.Label(interior, text=titulo.upper(), bg=C_PANEL, fg=C_SUAVE,
                 font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tk.Label(interior, text=valor, bg=C_PANEL, fg=C_TINTA,
                 font=("Segoe UI", 16, "bold")).pack(anchor="w")
        tk.Label(interior, text=pie, bg=C_PANEL, fg=C_SUAVE,
                 font=("Segoe UI", 8)).pack(anchor="w")

    def _refrescar_resultados(self) -> None:
        for hijo in self.marco_tarjetas.winfo_children():
            hijo.destroy()
        for hijo in self.marco_avisos.winfo_children():
            hijo.destroy()
        if self.resultado is None:
            return

        res = self.resultado
        self._tarjeta(self.marco_tarjetas, "Total inventario",
                      f"{res.t_co2e:,.3f} t", "alcances 1 + 2 + 3", C_ACENTO)
        for alcance, kg in res.por_alcance().items():
            if alcance not in (1, 2, 3):
                continue
            self._tarjeta(self.marco_tarjetas, f"Alcance {alcance}", f"{kg / 1000:,.3f} t",
                          f"{res.participacion(kg):.1f}% del total", C_ALCANCE[alcance])

        self.tabla_top.delete(*self.tabla_top.get_children())
        for r in res.ranking(12):
            self.tabla_top.insert("", "end", values=(
                (r.actividad.descripcion or r.actividad.factor_id)[:40],
                f"{r.t_co2e:,.3f}", f"{res.participacion(r.kg_co2e):.1f}"))

        avisos: List[str] = []
        if res.errores:
            avisos.append(f"✗ {len(res.errores)} actividad(es) con error quedaron fuera "
                          "del total — revise la pestaña de datos.")
        ids = sorted({r.factor.id for r in res.requieren_verificacion if r.factor})
        if ids:
            avisos.append("⚠ Factores referenciales en uso (verifíquelos antes de "
                          "reportar): " + ", ".join(ids[:6]) +
                          (f" y {len(ids) - 6} más" if len(ids) > 6 else ""))
        if res.kg_co2_biogenico:
            avisos.append(f"CO₂ biogénico: {res.kg_co2_biogenico:,.1f} kg — se informa "
                          "aparte, fuera de los alcances 1/2/3.")
        for texto in avisos:
            tk.Label(self.marco_avisos, text=texto, bg="#fff8e6", fg="#8a6100",
                     font=("Segoe UI", 9), anchor="w", padx=10, pady=5).pack(
                fill="x", pady=2)

        self._dibujar_grafico()

    def _datos_grafico(self) -> Dict[str, float]:
        if self.resultado is None:
            return {}
        modo = self.var_agrupar.get()
        if modo == "Alcance":
            return {f"Alcance {a}": kg for a, kg in self.resultado.por_alcance().items()
                    if a in (1, 2, 3)}
        if modo == "Área":
            return {str(k): v for k, v in self.resultado.por_area().items()}
        if modo == "Período":
            return {str(k): v for k, v in self.resultado.por_periodo().items()}
        if modo == "Gas":
            return {NOMBRES_GAS.get(g, g): kg for g, kg in self.resultado.por_gas().items()}
        return {str(k): v for k, v in self.resultado.por_categoria().items()}

    def _dibujar_grafico(self) -> None:
        lienzo = self.lienzo
        lienzo.delete("all")
        datos = {k: v for k, v in self._datos_grafico().items() if v > 0}
        ancho = lienzo.winfo_width() or 600
        alto = lienzo.winfo_height() or 300

        if not datos:
            lienzo.create_text(ancho / 2, alto / 2,
                               text="Sin datos para graficar.\nCargue actividades "
                                    "en la pestaña 1.",
                               fill=C_SUAVE, font=("Segoe UI", 11), justify="center")
            return

        datos = dict(sorted(datos.items(), key=lambda kv: -kv[1])[:12])
        total = sum(datos.values())
        maximo = max(datos.values())
        margen_izq, margen_der = 190, 130
        alto_fila = min(30, max(18, (alto - 24) // max(len(datos), 1)))
        y = 14

        for etiqueta, valor in datos.items():
            largo = (ancho - margen_izq - margen_der) * (valor / maximo)
            lienzo.create_text(margen_izq - 10, y + alto_fila / 2 - 2, text=etiqueta[:28],
                               anchor="e", fill=C_TINTA, font=("Segoe UI", 9))
            lienzo.create_rectangle(margen_izq, y, ancho - margen_der, y + alto_fila - 7,
                                    fill="#eef2f3", outline="")
            lienzo.create_rectangle(margen_izq, y, margen_izq + max(largo, 2),
                                    y + alto_fila - 7, fill=C_ACENTO, outline="")
            lienzo.create_text(ancho - margen_der + 10, y + alto_fila / 2 - 2,
                               text=f"{valor / 1000:,.3f} t   {valor / total * 100:.1f}%",
                               anchor="w", fill=C_SUAVE, font=("Segoe UI", 9))
            y += alto_fila

    # ─────────────────────────────────────────
    # Pestaña 4 · Reporte
    # ─────────────────────────────────────────
    def _construir_tab_reporte(self) -> None:
        contenedor = self.tab_reporte

        botones = ttk.Frame(contenedor)
        botones.pack(fill="x", padx=6, pady=(10, 4))
        ttk.Button(botones, text="Ver reporte HTML", style="Accion.TButton",
                   command=self._ver_html).pack(side="left")
        ttk.Button(botones, text="Exportar HTML…", command=self._exportar_html).pack(
            side="left", padx=6)
        ttk.Button(botones, text="Exportar CSV…", command=self._exportar_csv).pack(side="left")
        ttk.Button(botones, text="Exportar JSON…", command=self._exportar_json).pack(
            side="left", padx=6)
        ttk.Button(botones, text="Copiar resumen",
                   command=self._copiar_resumen).pack(side="left")

        marco = ttk.Frame(contenedor)
        marco.pack(fill="both", expand=True, padx=6, pady=(4, 10))
        self.texto_reporte = tk.Text(marco, wrap="none", bg=C_PANEL, fg=C_TINTA,
                                     font=("Consolas", 10), relief="flat", padx=14, pady=12)
        barra_v = ttk.Scrollbar(marco, orient="vertical", command=self.texto_reporte.yview)
        barra_h = ttk.Scrollbar(marco, orient="horizontal", command=self.texto_reporte.xview)
        self.texto_reporte.configure(yscrollcommand=barra_v.set, xscrollcommand=barra_h.set)
        self.texto_reporte.grid(row=0, column=0, sticky="nsew")
        barra_v.grid(row=0, column=1, sticky="ns")
        barra_h.grid(row=1, column=0, sticky="ew")
        marco.rowconfigure(0, weight=1)
        marco.columnconfigure(0, weight=1)

    def _refrescar_reporte(self) -> None:
        if self.resultado is None:
            return
        self.texto_reporte.configure(state="normal")
        self.texto_reporte.delete("1.0", "end")
        self.texto_reporte.insert("1.0", reportes.resumen_texto(self.resultado))
        self.texto_reporte.configure(state="disabled")

    def _copiar_resumen(self) -> None:
        if self.resultado is None:
            return
        self.clipboard_clear()
        self.clipboard_append(reportes.resumen_texto(self.resultado))
        self.var_estado.set("Resumen copiado al portapapeles.")

    def _ver_html(self) -> None:
        if not self._hay_datos():
            return
        destino = os.path.join(os.path.expanduser("~"), "reporte_emisiones.html")
        try:
            reportes.exportar_html(self.resultado, destino)
            webbrowser.open(f"file://{destino}")
            self.var_estado.set(f"Reporte abierto en el navegador: {destino}")
        except OSError as exc:
            messagebox.showerror(APP_NOMBRE, f"No se pudo generar el reporte:\n{exc}")

    # ─────────────────────────────────────────
    # Cálculo y refresco
    # ─────────────────────────────────────────
    def _sincronizar_inventario(self) -> None:
        self.inventario.organizacion = self.var_org.get()
        self.inventario.instalacion = self.var_instalacion.get()
        self.inventario.periodo = self.var_periodo_inv.get()
        self.inventario.responsable = self.var_responsable.get()

    def _recalcular(self) -> None:
        self.resultado = calcular_inventario(self.inventario, self.catalogo)
        self._refrescar_tabla()
        self._refrescar_resultados()
        self._refrescar_reporte()
        self.var_total_cabecera.set(f"{self.resultado.t_co2e:,.3f} t CO₂e")

    def _refrescar_tabla(self) -> None:
        self.tabla.delete(*self.tabla.get_children())
        if self.resultado is None:
            return
        for r in self.resultado.resultados:
            a = r.actividad
            etiquetas = ()
            if not r.ok:
                etiquetas = ("error",)
            elif r.factor and r.factor.verificar:
                etiquetas = ("verificar",)
            self.tabla.insert("", "end", iid=a.id, tags=etiquetas, values=(
                a.descripcion,
                (r.factor.nombre if r.factor else a.factor_id),
                r.alcance or "—",
                f"{a.cantidad:,.2f}",
                a.unidad,
                a.periodo,
                a.area,
                (f"{r.kg_co2e:,.2f}" if r.ok else r.error[:34]),
            ))

    def _hay_datos(self) -> bool:
        if self.resultado is None or not self.inventario.actividades:
            messagebox.showinfo(APP_NOMBRE,
                                "Primero cargue datos de actividad en la pestaña 1.")
            return False
        return True

    # ─────────────────────────────────────────
    # Archivo
    # ─────────────────────────────────────────
    def _nuevo(self) -> None:
        if self.inventario.actividades and not messagebox.askyesno(
                APP_NOMBRE, "¿Descartar el inventario actual y empezar uno nuevo?"):
            return
        self.inventario = Inventario()
        self.archivo_actual = None
        for variable in (self.var_org, self.var_instalacion,
                         self.var_periodo_inv, self.var_responsable):
            variable.set("")
        self._limpiar_formulario()
        self._recalcular()
        self.title(APP_NOMBRE)
        self.var_estado.set("Inventario nuevo.")

    def _abrir(self) -> None:
        ruta = filedialog.askopenfilename(
            title="Abrir inventario",
            filetypes=[("Inventario de emisiones", "*.json"), ("Todos", "*.*")])
        if ruta:
            self._abrir_archivo(ruta)

    def _abrir_archivo(self, ruta: str) -> None:
        try:
            self.inventario = Inventario.cargar(ruta)
        except (OSError, ValueError, KeyError) as exc:
            messagebox.showerror(APP_NOMBRE, f"No se pudo abrir el archivo:\n{exc}")
            return
        self.archivo_actual = ruta
        self.var_org.set(self.inventario.organizacion)
        self.var_instalacion.set(self.inventario.instalacion)
        self.var_periodo_inv.set(self.inventario.periodo)
        self.var_responsable.set(self.inventario.responsable)
        self._recalcular()
        self.title(f"{APP_NOMBRE} — {os.path.basename(ruta)}")
        self.var_estado.set(f"Abierto: {ruta} ({len(self.inventario.actividades)} actividades)")

    def _guardar(self) -> None:
        if not self.archivo_actual:
            self._guardar_como()
            return
        self._sincronizar_inventario()
        try:
            self.inventario.guardar(self.archivo_actual)
        except OSError as exc:
            messagebox.showerror(APP_NOMBRE, f"No se pudo guardar:\n{exc}")
            return
        self.var_estado.set(f"Guardado: {self.archivo_actual}")

    def _guardar_como(self) -> None:
        ruta = filedialog.asksaveasfilename(
            title="Guardar inventario", defaultextension=".json",
            initialfile="inventario_emisiones.json",
            filetypes=[("Inventario de emisiones", "*.json")])
        if not ruta:
            return
        self.archivo_actual = ruta
        self._guardar()
        self.title(f"{APP_NOMBRE} — {os.path.basename(ruta)}")

    def _importar_csv(self) -> None:
        ruta = filedialog.askopenfilename(
            title="Importar actividades desde CSV",
            filetypes=[("Planilla CSV", "*.csv"), ("Todos", "*.*")])
        if not ruta:
            return
        try:
            importado = reportes.importar_csv(ruta)
        except (OSError, UnicodeDecodeError, csv.Error) as exc:
            messagebox.showerror(APP_NOMBRE, f"No se pudo importar:\n{exc}")
            return
        if not importado.actividades:
            messagebox.showwarning(APP_NOMBRE,
                                   "El archivo no tiene filas válidas.\nUse Archivo → "
                                   "Crear plantilla CSV para ver el formato esperado.")
            return
        for actividad in importado.actividades:
            self.inventario.agregar(actividad)
        self._recalcular()
        self.var_estado.set(f"Importadas {len(importado.actividades)} actividad(es) de "
                            f"{os.path.basename(ruta)}")

    def _crear_plantilla(self) -> None:
        ruta = filedialog.asksaveasfilename(
            title="Crear plantilla CSV", defaultextension=".csv",
            initialfile="datos_emisiones.csv", filetypes=[("Planilla CSV", "*.csv")])
        if not ruta:
            return
        reportes.plantilla_csv(ruta, self.catalogo)
        self.var_estado.set(f"Plantilla creada: {ruta}")
        messagebox.showinfo(APP_NOMBRE,
                            "Plantilla creada.\n\nLlénela con sus consumos y luego use\n"
                            "Archivo → Importar actividades desde CSV.")

    def _exportar(self, funcion, titulo: str, extension: str, tipos) -> None:
        if not self._hay_datos():
            return
        ruta = filedialog.asksaveasfilename(title=titulo, defaultextension=extension,
                                            filetypes=tipos)
        if not ruta:
            return
        try:
            funcion(self.resultado, ruta)
        except OSError as exc:
            messagebox.showerror(APP_NOMBRE, f"No se pudo exportar:\n{exc}")
            return
        self.var_estado.set(f"Exportado: {ruta}")

    def _exportar_html(self) -> None:
        self._exportar(reportes.exportar_html, "Exportar reporte HTML", ".html",
                       [("Página web", "*.html")])

    def _exportar_csv(self) -> None:
        self._exportar(reportes.exportar_csv, "Exportar detalle CSV", ".csv",
                       [("Planilla CSV", "*.csv")])

    def _exportar_json(self) -> None:
        self._exportar(reportes.exportar_json, "Exportar reporte JSON", ".json",
                       [("JSON", "*.json")])

    def _importar_catalogo(self) -> None:
        ruta = filedialog.askopenfilename(title="Importar catálogo de factores",
                                          filetypes=[("Catálogo JSON", "*.json")])
        if not ruta:
            return
        try:
            self.catalogo = CatalogoFactores.cargar(ruta, combinar_con_base=True)
        except (OSError, ValueError, KeyError) as exc:
            messagebox.showerror(APP_NOMBRE, f"No se pudo importar el catálogo:\n{exc}")
            return
        self._refrescar_factores()
        self._al_cambiar_alcance()
        self._recalcular()
        self.var_estado.set(f"Catálogo importado: {ruta}")

    def _exportar_catalogo(self) -> None:
        ruta = filedialog.asksaveasfilename(title="Exportar catálogo", defaultextension=".json",
                                            initialfile="factores_emision.json",
                                            filetypes=[("Catálogo JSON", "*.json")])
        if ruta:
            self.catalogo.guardar(ruta)
            self.var_estado.set(f"Catálogo exportado: {ruta}")

    def _exportar_catalogo_csv(self) -> None:
        ruta = filedialog.asksaveasfilename(title="Exportar catálogo CSV",
                                            defaultextension=".csv",
                                            initialfile="factores_emision.csv",
                                            filetypes=[("Planilla CSV", "*.csv")])
        if ruta:
            reportes.exportar_factores_csv(self.catalogo, ruta)
            self.var_estado.set(f"Catálogo exportado: {ruta}")

    def _restaurar_catalogo(self) -> None:
        if messagebox.askyesno(APP_NOMBRE,
                               "¿Restaurar los factores por defecto?\n"
                               "Se perderán los factores propios que haya agregado."):
            self.catalogo = CatalogoFactores()
            self._refrescar_factores()
            self._al_cambiar_alcance()
            self._recalcular()
            self.var_estado.set("Catálogo restaurado.")

    # ─────────────────────────────────────────
    # Ayuda
    # ─────────────────────────────────────────
    def _ayuda_metodo(self) -> None:
        messagebox.showinfo(
            "Cómo se calcula",
            "Para cada dato de actividad:\n\n"
            "  emisiones = cantidad × factor de emisión × GWP del gas\n\n"
            "• La cantidad se convierte a la unidad del factor (m³→L, MWh→kWh…).\n"
            "• Cada gas (CO₂, CH₄, N₂O, HFC…) se convierte a CO₂ equivalente con su\n"
            "  potencial de calentamiento global a 100 años del IPCC AR6.\n"
            "• Los factores de combustión se derivan de los parámetros del IPCC 2006:\n"
            "  poder calorífico inferior, densidad y kg de gas por TJ.\n"
            "• El CO₂ biogénico (leña, biomasa) se informa por separado, fuera de los\n"
            "  alcances 1, 2 y 3, según el GHG Protocol.\n\n"
            "Los factores marcados con ⚠ son referenciales: reemplácelos por el dato\n"
            "de su proveedor o del organismo oficial antes de emitir un reporte.")

    def _acerca_de(self) -> None:
        messagebox.showinfo(
            "Acerca de",
            f"{APP_NOMBRE}\nVersión {VERSION}\n\n"
            "Calculadora de emisiones de gases de efecto invernadero\n"
            "para alcances 1, 2 y 3 (GHG Protocol).\n\n"
            "Funciona sin conexión y no envía datos a ningún servidor.\n"
            "Repositorio: Balance-de-masa")

    def _salir(self) -> None:
        if self.inventario.actividades and not self.archivo_actual:
            if messagebox.askyesno(APP_NOMBRE,
                                   "Hay datos sin guardar. ¿Guardar antes de salir?"):
                self._guardar_como()
        self.destroy()


# ─────────────────────────────────────────────
# Diálogo de edición de factores
# ─────────────────────────────────────────────

class DialogoFactor(tk.Toplevel):
    """Ventana para crear o ajustar un factor de emisión."""

    def __init__(self, padre, factor: FactorEmision, al_guardar, nuevo: bool = False):
        super().__init__(padre)
        self.title("Nuevo factor" if nuevo else f"Editar factor — {factor.id}")
        self.configure(bg=C_PANEL)
        self.resizable(False, False)
        self.transient(padre)
        self.grab_set()

        self.factor = factor
        self.al_guardar = al_guardar
        self.nuevo = nuevo

        self.var_id = tk.StringVar(value=factor.id)
        self.var_nombre = tk.StringVar(value=factor.nombre)
        self.var_alcance = tk.StringVar(value=str(factor.alcance))
        self.var_categoria = tk.StringVar(value=factor.categoria)
        self.var_unidad = tk.StringVar(value=factor.unidad)
        self.var_valor = tk.StringVar(value=f"{factor.co2e_unitario():.6f}")
        self.var_fuente = tk.StringVar(value=factor.fuente)
        self.var_verificar = tk.BooleanVar(value=factor.verificar)

        marco = ttk.Frame(self, padding=16, style="Panel.TFrame")
        marco.pack(fill="both", expand=True)

        campos = [
            ("Identificador", self.var_id, 30, nuevo),
            ("Nombre", self.var_nombre, 40, True),
            ("Categoría", self.var_categoria, 30, True),
            ("Fuente / referencia", self.var_fuente, 40, True),
        ]
        fila = 0
        for etiqueta, variable, ancho, editable in campos:
            ttk.Label(marco, text=etiqueta, style="Suave.TLabel").grid(
                row=fila, column=0, sticky="w", pady=4, padx=(0, 10))
            entrada = ttk.Entry(marco, textvariable=variable, width=ancho)
            if not editable:
                entrada.state(["disabled"])
            entrada.grid(row=fila, column=1, sticky="w", pady=4)
            fila += 1

        ttk.Label(marco, text="Alcance", style="Suave.TLabel").grid(
            row=fila, column=0, sticky="w", pady=4)
        ttk.Combobox(marco, textvariable=self.var_alcance, values=["1", "2", "3"],
                     width=6, state="readonly").grid(row=fila, column=1, sticky="w", pady=4)
        fila += 1

        ttk.Label(marco, text="Unidad del factor", style="Suave.TLabel").grid(
            row=fila, column=0, sticky="w", pady=4)
        todas = sorted({u for tabla in unidades.UNIDADES.values() for u in tabla})
        ttk.Combobox(marco, textvariable=self.var_unidad, values=todas, width=10,
                     state="readonly").grid(row=fila, column=1, sticky="w", pady=4)
        fila += 1

        ttk.Label(marco, text="kg CO₂e por unidad", style="Suave.TLabel").grid(
            row=fila, column=0, sticky="w", pady=4)
        ttk.Entry(marco, textvariable=self.var_valor, width=18).grid(
            row=fila, column=1, sticky="w", pady=4)
        fila += 1

        ttk.Checkbutton(marco, text="Valor referencial — pendiente de verificar",
                        variable=self.var_verificar).grid(
            row=fila, column=1, sticky="w", pady=(8, 4))
        fila += 1

        if factor.gases and set(factor.gases) != {"CO2e"}:
            aviso = ("Este factor está desglosado por gas "
                     f"({', '.join(factor.gases)}).\nSi edita el valor, se reemplazará "
                     "por un único valor agregado en CO₂e.")
            ttk.Label(marco, text=aviso, style="Aviso.TLabel", padding=8,
                      background="#fff8e6", wraplength=420).grid(
                row=fila, column=0, columnspan=2, sticky="ew", pady=(8, 4))
            fila += 1

        botones = ttk.Frame(marco, style="Panel.TFrame")
        botones.grid(row=fila, column=0, columnspan=2, sticky="e", pady=(14, 0))
        ttk.Button(botones, text="Cancelar", command=self.destroy).pack(side="right", padx=6)
        ttk.Button(botones, text="Guardar", style="Accion.TButton",
                   command=self._guardar).pack(side="right")

        self.bind("<Escape>", lambda e: self.destroy())

    def _guardar(self) -> None:
        identificador = self.var_id.get().strip()
        if not identificador:
            messagebox.showwarning("Factor", "El identificador no puede estar vacío.",
                                   parent=self)
            return
        try:
            valor = float(self.var_valor.get().strip().replace(",", "."))
        except ValueError:
            messagebox.showerror("Factor", "El valor debe ser un número.", parent=self)
            return

        original = self.factor
        cambio_valor = abs(valor - original.co2e_unitario()) > 1e-12
        if cambio_valor or set(original.gases) == {"CO2e"} or self.nuevo:
            gases = {"CO2e": valor}
        else:
            gases = dict(original.gases)

        nuevo = FactorEmision(
            id=identificador,
            nombre=self.var_nombre.get().strip() or identificador,
            alcance=int(self.var_alcance.get()),
            categoria=self.var_categoria.get().strip() or "Definidos por el usuario",
            unidad=self.var_unidad.get() or "kg",
            gases=gases,
            co2_biogenico=original.co2_biogenico,
            fuente=self.var_fuente.get().strip(),
            verificar=self.var_verificar.get(),
            notas=original.notas,
        )
        self.al_guardar(nuevo)
        self.destroy()


# ─────────────────────────────────────────────
# Punto de entrada
# ─────────────────────────────────────────────

def ejecutar(ruta_catalogo: Optional[str] = None,
             ruta_inventario: Optional[str] = None) -> None:
    """Abre la ventana principal."""
    app = AplicacionEmisiones(ruta_catalogo=ruta_catalogo, ruta_inventario=ruta_inventario)
    app.mainloop()
