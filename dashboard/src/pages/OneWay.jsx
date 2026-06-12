import LineDetail from '../components/LineDetail';
import { LINEA_ONE_WAY } from '../config/plant';

export default function OneWay() {
  return (
    <LineDetail
      lineId={LINEA_ONE_WAY.id}
      title="Línea One Way"
      subtitle="Envasado no retornable (PET / lata)"
      color={LINEA_ONE_WAY.color}
    />
  );
}
