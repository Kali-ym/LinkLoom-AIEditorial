import { Center, Empty } from '@lobehub/ui';
import { MessageSquareText } from 'lucide-react';
import { memo } from 'react';

/** §C.50*/
export const TopicEmpty = memo(function TopicEmpty({ search = false }: { search?: boolean }) {
  return (
    <Center height="100%" style={{ minHeight: '50vh' }} width="100%">
      <Empty
        description={
          search
            ? '暂无搜索结果'
            : '点击发送左侧按钮可将当前会话保存为历史话题，便于日后查阅与继续。'
        }
        descriptionProps={{ fontSize: 14 }}
        icon={MessageSquareText}
        style={{ maxWidth: 400 }}
      />
    </Center>
  );
});
