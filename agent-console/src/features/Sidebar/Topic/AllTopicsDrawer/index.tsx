import { Flexbox, SearchBar } from '@lobehub/ui';
import { lazy, memo, Suspense, useState } from 'react';

import { SideBarDrawer } from '../../../NavPanel/SideBarDrawer';
import { SkeletonList } from '../../../NavPanel/SkeletonList';
import { useTopicStore } from '../../../../stores';

const Content = lazy(() => import('./Content'));

/** §C.50*/
export const AllTopicsDrawer = memo(function AllTopicsDrawer() {
  const open = useTopicStore((s) => s.allTopicsDrawerOpen);
  const closeAllTopicsDrawer = useTopicStore((s) => s.closeAllTopicsDrawer);
  const [searchKeyword, setSearchKeyword] = useState('');

  return (
    <SideBarDrawer
      open={open}
      subHeader={
        <Flexbox paddingBlock="0 8px" paddingInline={8}>
          <SearchBar
            allowClear
            placeholder="搜索话题…"
            value={searchKeyword}
            onChange={(e) => {
              const next = e.target.value;
              setSearchKeyword(next);
              if (!next.trim()) {
                useTopicStore.getState().clearTopicSearch();
              }
            }}
            onSearch={(keyword) => setSearchKeyword(keyword)}
          />
        </Flexbox>
      }
      title="话题"
      onClose={closeAllTopicsDrawer}
    >
      <Suspense
        fallback={
          <Flexbox gap={1} paddingBlock={1} paddingInline={4}>
            <SkeletonList rows={3} />
          </Flexbox>
        }
      >
        <Content open={open} searchKeyword={searchKeyword} />
      </Suspense>
    </SideBarDrawer>
  );
});
