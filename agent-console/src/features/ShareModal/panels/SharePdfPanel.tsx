import { Button, Checkbox, Flexbox, Form, Markdown, Text, type FormItemProps } from '@lobehub/ui';
import { FileText } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { useLayoutStore } from '../../../stores';
import { showToast } from '../../../services/ui/toast';
import { useShareData } from '../ShareDataProvider';
import { shareModalStyles } from '../shareModalStyles';
import { generateShareMarkdown, type ShareTextFieldType } from '../shareExportUtils';
import { SharePreviewBox } from './SharePreviewBox';

const DEFAULT_FIELD_VALUE: ShareTextFieldType = {
  includeTool: true,
  includeUser: true,
  withRole: true,
  withSystemRole: false,
};

export const SharePdfPanel = memo(function SharePdfPanel() {
  const [fieldValue, setFieldValue] = useState(DEFAULT_FIELD_VALUE);
  const [generating, setGenerating] = useState(false);
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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 480));
      showToast('PDF 导出需服务端 API（演示）');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Flexbox className={shareModalStyles.body} gap={16} horizontal={!isMobileViewport}>
      <SharePreviewBox>
        {content.trim() ? (
          <Markdown variant="chat">{content}</Markdown>
        ) : (
          <Flexbox align="center" justify="center" style={{ minHeight: 160 }}>
            <Text type="secondary">暂无内容可预览</Text>
          </Flexbox>
        )}
      </SharePreviewBox>
      <Flexbox className={shareModalStyles.sidebar} gap={12}>
        <Form
          initialValues={DEFAULT_FIELD_VALUE}
          items={settings}
          itemsType="flat"
          onValuesChange={(_, values) => setFieldValue(values as ShareTextFieldType)}
        />
        <Button
          block
          icon={generating ? undefined : FileText}
          loading={generating}
          size={isMobileViewport ? undefined : 'large'}
          type="primary"
          onClick={handleGenerate}
        >
          {generating ? '生成中…' : '生成 PDF'}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});
