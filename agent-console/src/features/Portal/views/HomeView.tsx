import { Avatar, Empty, Flexbox, Skeleton, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { BookOpen, Layers, Settings } from 'lucide-react';
import { memo } from 'react';

import { useWorkspaceStore } from '../../../stores';
import { PortalFileIcon } from '../components/PortalFileIcon';
import { openPortalView } from '../portalActions';
import { portalViewStyles } from '../portalViewStyles';

const styles = createStaticStyles(({ css }) => ({
  sectionTitle: css`
    margin-block: 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: ${cssVar.colorTextTertiary};
  `,
}));

/** §C.21 Home*/
export const HomeView = memo(function HomeView() {
  const portalContent = useWorkspaceStore((s) => s.portalContent);
  const { homeFiles, homeArtifact, homeTool } = portalContent;
  const loading = false;

  if (loading) {
    return (
      <Flexbox gap={12} height="100%" paddingInline={12} style={{ paddingBlock: 12 }}>
        <Skeleton active paragraph={{ rows: 3 }} />
        <Flexbox gap={8}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton.Button key={i} active style={{ height: 68, borderRadius: 8, width: '100%' }} />
          ))}
        </Flexbox>
      </Flexbox>
    );
  }

  return (
    <Flexbox className={portalViewStyles.bodyRoot} gap={12} height="100%" paddingInline={12} style={{ paddingBlock: 12 }}>
      <Text className={styles.sectionTitle}>文件</Text>
      {homeFiles.length === 0 ? (
        <div className={portalViewStyles.homeEmpty}>
          <Empty
            description="暂无知识库文件"
            icon={<Avatar size={48} style={{ background: cssVar.colorFillTertiary }} />}
          />
        </div>
      ) : (
        homeFiles.map((file) => (
          <button
            key={file.path}
            className={portalViewStyles.homeFileItem}
            type="button"
            onClick={() => openPortalView('FilePreview', { path: file.path, name: file.name })}
          >
            <Flexbox horizontal align="center" gap={8}>
              <PortalFileIcon name={file.name} />
              <Flexbox flex={1} style={{ minWidth: 0 }}>
                <Text ellipsis>{file.name}</Text>
                <Text fontSize={12} type="secondary">
                  {file.meta}
                </Text>
              </Flexbox>
            </Flexbox>
          </button>
        ))
      )}

      <Text className={styles.sectionTitle} style={{ marginTop: 8 }}>
        产物
      </Text>
      {homeArtifact ? (
        <button
          className={portalViewStyles.homeSkillItem}
          type="button"
          onClick={() =>
            openPortalView('Artifact', { title: homeArtifact.title, id: homeArtifact.id })
          }
        >
          <Flexbox horizontal align="center" gap={8}>
            <Layers size={16} />
            <Flexbox flex={1} style={{ minWidth: 0 }}>
              <Text ellipsis>{homeArtifact.title}</Text>
              <Text fontSize={12} type="secondary">
                {homeArtifact.meta}
              </Text>
            </Flexbox>
          </Flexbox>
        </button>
      ) : (
        <div className={portalViewStyles.homeEmpty}>
          <Empty description="暂无产物" icon={<BookOpen size={32} />} />
        </div>
      )}

      <button
        className={portalViewStyles.homeSkillItem}
        type="button"
        onClick={() => openPortalView('ToolUI', { ...homeTool })}
      >
        <Flexbox horizontal align="center" gap={8}>
          <Settings size={16} />
          <Flexbox flex={1} style={{ minWidth: 0 }}>
            <Text ellipsis>web-browsing › fetchPage</Text>
            <Text fontSize={12} type="secondary">
              读取 Changelog 页面 · 成功
            </Text>
          </Flexbox>
        </Flexbox>
      </button>
    </Flexbox>
  );
});
