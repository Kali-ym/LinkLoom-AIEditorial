import { Button, Checkbox, copyToClipboard, Flexbox, Form, Markdown, type FormItemProps } from '@lobehub/ui';
import { CopyIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { useLayoutStore } from '../../../stores';
import { showToast } from '../../../services/ui/toast';
import { useShareData } from '../ShareDataProvider';
import { shareModalStyles } from '../shareModalStyles';
import {
  exportTextFile,
  generateShareMarkdown,
  type ShareTextFieldType,
} from '../shareExportUtils';
import { SharePreviewBox } from './SharePreviewBox';

const DEFAULT_FIELD_VALUE: ShareTextFieldType = {
  includeTool: true,
  includeUser: true,
  withRole: true,
  withSystemRole: false,
};

export const ShareTextPanel = memo(function ShareTextPanel() {
  const [fieldValue, setFieldValue] = useState(DEFAULT_FIELD_VALUE);
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const { displayMessages, systemRole, title } = useShareData();

  const content = useMemo(
    () =>
      generateShareMarkdown({
        ...fieldValue,
        messages: displayMessages,
        systemRole,
        title,
      }).replaceAll('\n\n\n', '\n'),
    [displayMessages, fieldValue, systemRole, title],
  );

  const settings: FormItemProps[] = [
    {
      children: <Checkbox />,
      label: '包含系统角色',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'withSystemRole',
      valuePropName: 'checked',
    },
    {
      children: <Checkbox />,
      label: '包含角色标签',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'withRole',
      valuePropName: 'checked',
    },
    {
      children: <Checkbox />,
      label: '包含用户消息',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'includeUser',
      valuePropName: 'checked',
    },
    {
      children: <Checkbox />,
      label: '包含工具消息',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'includeTool',
      valuePropName: 'checked',
    },
  ];

  const buttons = (
    <>
      <Button
        block
        icon={CopyIcon}
        size={isMobileViewport ? undefined : 'large'}
        type="primary"
        onClick={async () => {
          await copyToClipboard(content);
          showToast('已复制');
        }}
      >
        复制
      </Button>
      <Button
        block
        size={isMobileViewport ? undefined : 'large'}
        onClick={() => exportTextFile(content, `${title}.md`)}
      >
        下载文件
      </Button>
    </>
  );

  return (
    <>
      <Flexbox className={shareModalStyles.body} gap={16} horizontal={!isMobileViewport}>
        <SharePreviewBox>
          <Markdown variant="chat">{content}</Markdown>
        </SharePreviewBox>
        <Flexbox className={shareModalStyles.sidebar} gap={12}>
          <Form
            initialValues={DEFAULT_FIELD_VALUE}
            items={settings}
            itemsType="flat"
            onValuesChange={(_, values) => setFieldValue(values as ShareTextFieldType)}
          />
          {!isMobileViewport && buttons}
        </Flexbox>
      </Flexbox>
      {isMobileViewport && (
        <Flexbox horizontal className={shareModalStyles.footer} gap={8}>
          {buttons}
        </Flexbox>
      )}
    </>
  );
});
