# 💧 AquaPlant — Dashboard de Monitoreo de Planta de Agua

Dashboard web interactivo para monitorear el desempeño operacional y el
consumo de agua de una planta embotelladora: balance hídrico general,
líneas de producción, servicios auxiliares, agua potable y elaboración.

> **Estado actual:** la aplicación funciona 100 % con **datos simulados
> (mock)** deterministas, para validar diseño y navegación. La capa de
> datos ya está preparada para reemplazar el mock por la lectura de los
> archivos Excel mensuales **sin tocar la capa de visualización**.

## 🚀 Puesta en marcha

```bash
cd dashboard
npm install
npm run dev        # desarrollo → http://localhost:5173
npm run build      # build de producción → dist/
npm run preview    # sirve el build localmente
```

## 🗺️ Páginas

| Ruta            | Página          | Contenido |
|-----------------|-----------------|-----------|
| `/`             | Planta General  | 8 KPIs globales (ratio agua/bebida, producción, pozos, Nano, % rechazo NF, % recuperación WUR, CIP+enjuague, eficiencia RO), tendencias diarias, evolución mensual, comparación de períodos, ranking y distribución de consumidores, tabla semafórica |
| `/retornable`   | Retornable      | Líneas 1, 2, 3, 4, 5 y 11: consumo diario, acumulado, comparación entre líneas, ranking, eficiencia con semáforos, histórico mensual |
| `/one-way`      | One Way         | Agua, producción, ratio, tendencias, comparación con período anterior e histórico mensual |
| `/linea-10`     | Línea 10        | Ídem One Way, exclusivo de Línea 10 |
| `/servicios`    | Servicios       | Torres de enfriamiento, calderas, CIP y auxiliares: diario apilado, distribución porcentual, acumulado mensual, históricos |
| `/agua-potable` | Agua Potable    | Producción, consumo, pérdidas y eficiencia; balance diario, distribución por destino, tendencia mensual |
| `/elaboracion`  | Elaboración     | Agua, producto elaborado, ratio, tendencias y comparaciones mensuales |

Filtros globales en el encabezado (aplican a todas las páginas):
**fecha inicial**, **fecha final**, **mes**, **año** e indicador de
**última actualización**. Cada KPI se compara automáticamente contra el
**período anterior de igual longitud**.

## 🏗️ Arquitectura

```
dashboard/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx                 # entry point
    ├── App.jsx                  # rutas
    ├── config/                  # ⚙️ configuración declarativa
    │   ├── plant.js             #    catálogo: líneas, pozos, servicios, colores
    │   ├── metrics.js           #    KPIs: unidades, metas, umbrales semafóricos
    │   └── navigation.js        #    menú lateral
    ├── context/
    │   └── DashboardContext.jsx # filtros globales + datos del período actual/anterior
    ├── services/                # 📊 capa de datos
    │   ├── dataService.js       #    FACHADA única usada por la UI
    │   ├── transforms.js        #    agregaciones, KPIs, comparaciones (puras)
    │   └── providers/
    │       ├── mockProvider.js  #    datos simulados deterministas (activo)
    │       └── excelProvider.js #    plantilla para los Excel reales
    ├── hooks/                   # useHistoricalRecords, useSortableTable
    ├── layout/                  # AppLayout, Sidebar, Header (filtros)
    ├── components/              # KpiCard, ChartCard, DataTable, semáforos…
    ├── charts/                  # envoltorios Recharts reutilizables
    │   ├── TrendChart.jsx       #    líneas (diario/mensual)
    │   ├── AreaTrendChart.jsx   #    áreas (apilables)
    │   ├── BarsChart.jsx        #    barras (agrupadas/apiladas)
    │   ├── DonutChart.jsx       #    torta/donut con total central
    │   ├── RankingChart.jsx     #    barras horizontales
    │   └── PeriodCompareChart.jsx # actual vs anterior alineado por día
    ├── pages/                   # una página por área de la planta
    └── utils/                   # formato es-CL y fechas ISO
```

### Flujo de datos

```
Excel/mock ─▶ provider ─▶ dataService (fachada) ─▶ DashboardContext
                                                        │
                              transforms.js (KPIs, series, rankings)
                                                        │
                                              páginas ─▶ charts/components
```

Las páginas **nunca** acceden a un proveedor directamente: solo a
`dataService` + `transforms`. Por eso el origen de datos es intercambiable.

## 🔌 Conexión futura a los Excel mensuales

Los archivos reales (p. ej. `05_Mapa_Agua_Mayo.xlsx`, hoja `METROSCUB`,
un registro por día del mes) se integran así:

1. `npm install xlsx`
2. Completar `COLUMN_MAP` en `src/services/providers/excelProvider.js`
   con los encabezados reales de la hoja (el contrato `DailyRecord` está
   documentado en `mockProvider.js` — todas las cifras en m³/día).
3. Implementar `parseWorkbook()` (la estructura ya está esbozada) y
   cargar los archivos vía `<input type="file">`, carpeta compartida o
   endpoint backend.
4. En `src/services/dataService.js` cambiar:

   ```js
   const ACTIVE_PROVIDER = 'excel';
   ```

Ninguna página, gráfico ni KPI requiere modificaciones.

## 🎨 Stack

- **React 18 + Vite** — SPA modular y rápida
- **React Router** (HashRouter: el build estático funciona en cualquier carpeta/servidor)
- **Recharts** — gráficos interactivos (líneas, áreas, barras, donut, ranking)
- CSS propio con design tokens (tema industrial oscuro, responsivo, sin dependencias de UI)

## ➕ Cómo extender

- **Nueva página:** crear `src/pages/X.jsx`, registrar la ruta en
  `App.jsx` y el ítem de menú en `config/navigation.js`.
- **Nuevo KPI:** definirlo en `config/metrics.js` (umbrales/colores) y
  calcularlo en `services/transforms.js`.
- **Nueva línea/servicio:** agregarla al catálogo `config/plant.js`;
  las vistas de retornable/servicios la incorporan automáticamente.
