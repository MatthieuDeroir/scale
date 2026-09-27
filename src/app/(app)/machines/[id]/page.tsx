import { MachinePage } from '@/features/parc';

export const metadata = { title: 'Machine' };

export default async function MachineRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MachinePage id={id} />;
}
