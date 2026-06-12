import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import AppLayout from './layout/AppLayout';
import PlantaGeneral from './pages/PlantaGeneral';
import Retornable from './pages/Retornable';
import OneWay from './pages/OneWay';
import Linea10 from './pages/Linea10';
import Servicios from './pages/Servicios';
import AguaPotable from './pages/AguaPotable';
import Elaboracion from './pages/Elaboracion';

/**
 * Rutas de la aplicación. Se usa HashRouter para que el build estático
 * funcione desde cualquier servidor/carpeta sin configuración extra.
 */
export default function App() {
  return (
    <DashboardProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<PlantaGeneral />} />
            <Route path="/retornable" element={<Retornable />} />
            <Route path="/one-way" element={<OneWay />} />
            <Route path="/linea-10" element={<Linea10 />} />
            <Route path="/servicios" element={<Servicios />} />
            <Route path="/agua-potable" element={<AguaPotable />} />
            <Route path="/elaboracion" element={<Elaboracion />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </DashboardProvider>
  );
}
