import { Button, copyToClipboard, Checkbox, Flexbox, Form, Segmented, type FormItemProps } from '@lobehub/ui';
import { CopyIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { useLayoutStore } from '../../../stores';
import { showToast } from '../../../services/ui/toast';
import { useShareData } from '../ShareDataProvider';
import { shareModalStyles } from '../shareModalStyles';
import {
  exportTextFile,
  generateShareFullExport,
  generateShareMessagesJson,
  type ShareJsonFieldType,
} from '../shareExportUtils';
import { SharePreviewBox } from './SharePreviewBox';

const DEFAULT_FIELD_VALUE: ShareJsonFieldType = {
  exportMode: 'full',
  includeTool: true,
  withSystemRole: true,
};

export const ShareJsonPanel = memo(function ShareJsonPanel() {
  const [fieldValue, setFieldValue] = useState(DEFAULT_FIELD_VALUE);
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const { dbMessages, systemRole, title, topic } = useShareData();

  const data = useMemo(() => {
    if (fieldValue.exportMode === 'simple') {
      return generateShareMessagesJson({
        ...fieldValue,
        messages: dbMessages,
        systemRole,
      });
    }
    return generateShareFullExport({
      ...fieldValue,
      messages: dbMessages,
      systemRole,
      topic,
    });
  }, [dbMessages, fieldValue, systemRole, topic]);

  const content = JSON.stringify(data, null, 2);

  const exportModeOptions = [
    { label: '完整', value: 'full' as const },
    { label: '精简', value: 'simple' as const },
  ];

  const settings: FormItemProps[] = [
    {
      children: (
        <Segmented
          block
          options={exportModeOptions}
          value={fieldValue.exportMode}
          onChange={(value) =>
            setFieldValue((prev) => ({
              ...prev,
              exportMode: value as ShareJsonFieldType['exportMode'],
            }))
          }
        />
      ),
      label: '导出模式',
      layout: 'vertical',
      minWidth: undefined,
      name: 'exportMode',
    },
    {
      children: <Checkbox />,
      label: '包含系统角色',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'withSystemRole',
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
        onClick={() => exportTextFile(content, `${title}.json`)}
      >
        下载文件
      </Button>
    </>
  );

  return (
    <>
      <Flexbox className={shareModalStyles.body} gap={16} horizontal={!isMobileViewport}>
        <SharePreviewBox>
          <pre
            style={{
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </pre>
        </SharePreviewBox>
        <Flexbox className={shareModalStyles.sidebar} gap={12}>
          <Form
            initialValues={DEFAULT_FIELD_VALUE}
            items={settings}
            itemsType="flat"
            onValuesChange={(_, values) =>
              setFieldValue((prev) => ({ ...prev, ...(values as Partial<ShareJsonFieldType>) }))
            }
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
