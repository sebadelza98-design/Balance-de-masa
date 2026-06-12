# Balance-de-masa
Codigo para crear un balance de masa planta agua

## Contenido

- **`dashboard.html`** — El mismo dashboard en **un solo archivo HTML
  autocontenido**: descárgalo y ábrelo con doble clic en cualquier navegador.
  No requiere internet, npm ni servidor (Chart.js va embebido). Se genera con
  `cd dashboard && npm run build:standalone`.

- **`dashboard/`** — Dashboard web interactivo (React + Vite + Recharts) para
  monitorear el desempeño operacional y el consumo de agua de la planta:
  Planta General, Retornable, One Way, Línea 10, Servicios, Agua Potable y
  Elaboración. Funciona con datos simulados y está preparado para conectarse
  a los Excel mensuales. Ver [dashboard/README.md](dashboard/README.md).

  ```bash
  cd dashboard && npm install && npm run dev
  ```

- **`Balance_Masa_Agua_Colab_(1).ipynb`** — Notebook de Google Colab con el
  solver de balance de masa hídrico (Streamlit + diagramas Sankey).
