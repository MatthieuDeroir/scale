import { PolicyScreen } from '@/features/parc';
import { guard } from '../_components/guard';

export const metadata = { title: "Politique d'accès" };

export default async function PolitiquePage() {
  await guard('OPERATOR');
  return <PolicyScreen />;
}
