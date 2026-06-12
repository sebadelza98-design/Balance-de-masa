import LineDetail from '../components/LineDetail';
import { LINEA_10 } from '../config/plant';

export default function Linea10() {
  return (
    <LineDetail
      lineId={LINEA_10.id}
      title="Línea 10"
      subtitle="Indicadores exclusivos de la Línea 10"
      color={LINEA_10.color}
    />
  );
}
