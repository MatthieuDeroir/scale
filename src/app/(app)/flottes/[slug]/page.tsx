import { FleetDetail } from '@/features/parc';

export default async function FlottePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FleetDetail slug={decodeURIComponent(slug)} />;
}
