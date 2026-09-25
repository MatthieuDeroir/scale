import { FleetDetail } from "@/features/parc";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return { title: decodeURIComponent((await params).slug) };
}

export default async function FlottePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <FleetDetail slug={decodeURIComponent(slug)} />;
}
