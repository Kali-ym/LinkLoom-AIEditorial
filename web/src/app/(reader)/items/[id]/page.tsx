import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentPanel } from '@/components/ContentPanel';
import { ItemDetailView } from '@/components/item/ItemDetailView';
import { fetchItemDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchItemDetail(id);
  if (!item) return { title: '未找到' };
  return {
    title: item.title,
    description: item.summary?.slice(0, 160) || undefined
  };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await fetchItemDetail(id);
  if (!item) notFound();

  return (
    <ContentPanel className="overflow-visible">
      <ItemDetailView item={item} />
    </ContentPanel>
  );
}
