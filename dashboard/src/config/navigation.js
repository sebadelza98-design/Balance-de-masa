/**
 * Menú lateral de navegación. Agregar aquí nuevas páginas.
 */
export const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { path: '/', icon: '🏭', label: 'Planta General' },
    ],
  },
  {
    label: 'Líneas de producción',
    items: [
      { path: '/retornable', icon: '♻️', label: 'Retornable' },
      { path: '/one-way', icon: '🧴', label: 'One Way' },
      { path: '/linea-10', icon: '🔟', label: 'Línea 10' },
    ],
  },
  {
    label: 'Áreas de soporte',
    items: [
      { path: '/servicios', icon: '⚙️', label: 'Servicios' },
      { path: '/agua-potable', icon: '🚰', label: 'Agua Potable' },
      { path: '/elaboracion', icon: '🧪', label: 'Elaboración' },
    ],
  },
];
