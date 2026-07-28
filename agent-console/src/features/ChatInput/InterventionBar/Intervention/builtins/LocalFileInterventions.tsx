import { Flexbox, Icon, Text } from '@lobehub/ui';
import { ArrowRight } from 'lucide-react';
import { memo } from 'react';

import { CommandSnippet } from '../../CommandSnippet';
import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';
import { FilePathLabel } from './FilePathLabel';

export const ReadFileIntervention = memo(function ReadFileIntervention({
  args,
}: BuiltinInterventionProps) {
  const path = typeof args.path === 'string' ? args.path : '';
  const loc = Array.isArray(args.loc) ? args.loc : null;

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="代理请求读取以下文件，批准后将从工作区加载内容。"
        title="读取文件"
      >
        <FilePathLabel path={path} />
        {loc && loc.length >= 2 ? (
          <div className={interventionStyles.metaRow}>
            <span className={interventionStyles.metaChip}>
              行 {loc[0]} – {loc[1]}
            </span>
          </div>
        ) : null}
      </InterventionSection>
    </Flexbox>
  );
});

export const ListFilesIntervention = memo(function ListFilesIntervention({
  args,
}: BuiltinInterventionProps) {
  const path = typeof args.path === 'string' ? args.path : '';

  return (
    <InterventionSection description="将列出该目录下的文件与文件夹。" title="目录浏览">
      <FilePathLabel path={path} />
    </InterventionSection>
  );
});

export const GlobFilesIntervention = memo(function GlobFilesIntervention({
  args,
}: BuiltinInterventionProps) {
  const pattern = typeof args.pattern === 'string' ? args.pattern : '';

  return (
    <Flexbox gap={12}>
      <InterventionSection description="将按 glob 模式匹配工作区内的文件路径。" title="文件匹配" />
      <CommandSnippet language="text" text={pattern || '—'} />
    </Flexbox>
  );
});

export const GrepContentIntervention = memo(function GrepContentIntervention({
  args,
}: BuiltinInterventionProps) {
  const pattern = typeof args.pattern === 'string' ? args.pattern : '';
  const scope = typeof args.scope === 'string' ? args.scope : undefined;
  const glob = typeof args.glob === 'string' ? args.glob : undefined;
  const type = typeof args.type === 'string' ? args.type : undefined;

  return (
    <Flexbox gap={12}>
      <InterventionSection description="将在指定范围内搜索匹配正则的内容。" title="内容搜索">
        {scope ? <FilePathLabel label="范围" path={scope} /> : null}
        <div className={interventionStyles.metaRow}>
          {glob ? <span className={interventionStyles.metaChip}>glob: {glob}</span> : null}
          {type ? <span className={interventionStyles.metaChip}>type: {type}</span> : null}
        </div>
      </InterventionSection>
      <CommandSnippet language="regex" text={pattern || '—'} />
    </Flexbox>
  );
});

export const SearchFilesIntervention = memo(function SearchFilesIntervention({
  args,
}: BuiltinInterventionProps) {
  const keywords = typeof args.keywords === 'string' ? args.keywords : '';
  const scope = typeof args.scope === 'string' ? args.scope : undefined;

  return (
    <Flexbox gap={12}>
      <InterventionSection description="将按关键词在工作区中检索文件。" title="关键词搜索">
        {scope ? <FilePathLabel label="范围" path={scope} /> : null}
        <div className={interventionStyles.metaRow}>
          <span className={interventionStyles.metaChip}>{keywords || '—'}</span>
        </div>
      </InterventionSection>
    </Flexbox>
  );
});

export const RenameFileIntervention = memo(function RenameFileIntervention({
  args,
}: BuiltinInterventionProps) {
  const filePath = typeof args.path === 'string' ? args.path : '';
  const newName = typeof args.newName === 'string' ? args.newName : '';
  const baseName = filePath.split(/[/\\]/).pop() ?? filePath;

  return (
    <Flexbox gap={12}>
      <InterventionSection description="批准后将重命名以下文件。" title="重命名">
        <FilePathLabel path={filePath} />
      </InterventionSection>
      <InterventionPanel>
        <Flexbox horizontal align="center" gap={12}>
          <Text style={{ fontFamily: 'var(--console-vars-font-family-code)', fontSize: 13 }} type="secondary">
            {baseName}
          </Text>
          <Icon icon={ArrowRight} size={14} />
          <Text style={{ fontFamily: 'var(--console-vars-font-family-code)', fontSize: 13, fontWeight: 600 }}>
            {newName}
          </Text>
        </Flexbox>
      </InterventionPanel>
    </Flexbox>
  );
});
