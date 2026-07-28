import { fetchHotEvents } from '@/lib/api';
import { ContentPanel } from '@/components/ContentPanel';
import { HotBoard } from '@/components/hot/HotBoard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { boards } = await fetchHotEvents();
  return (
    <ContentPanel>
      <HotBoard boards={boards} />
    </ContentPanel>
  );
}
