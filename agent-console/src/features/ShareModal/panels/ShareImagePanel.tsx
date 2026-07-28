import { Button, Flexbox, Checkbox, Form, Markdown, Segmented, Text, type FormItemProps } from '@lobehub/ui';
import { toJpeg, toPng } from 'html-to-image';
import { CopyIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useLayoutStore } from '../../../stores';
import { showToast } from '../../../services/ui/toast';
import { useShareData } from '../ShareDataProvider';
import { shareModalStyles } from '../shareModalStyles';
import { SharePreviewBox } from './SharePreviewBox';

enum ImageType {
  JPG = 'jpeg',
  PNG = 'png',
}

enum WidthMode {
  Narrow = 'narrow',
  Wide = 'wide',
}

interface ShareImageFieldType {
  imageType: ImageType;
  widthMode: WidthMode;
  withFooter: boolean;
  withSystemRole: boolean;
}

const DEFAULT_FIELD_VALUE: ShareImageFieldType = {
  imageType: ImageType.JPG,
  widthMode: WidthMode.Wide,
  withFooter: true,
  withSystemRole: false,
};

export const ShareImagePanel = memo(function ShareImagePanel() {
  const [fieldValue, setFieldValue] = useState(DEFAULT_FIELD_VALUE);
  const [copyLoading, setCopyLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const { agentName, dbMessages, systemRole, title } = useShareData();

  const visibleMessages = useMemo(
    () => dbMessages.filter((m) => m.content && m.content !== '...'),
    [dbMessages],
  );

  const capture = useCallback(async () => {
    if (!previewRef.current) return null;
    const options = { cacheBust: true, pixelRatio: 2 };
    return fieldValue.imageType === ImageType.PNG
      ? toPng(previewRef.current, options)
      : toJpeg(previewRef.current, { ...options, quality: 0.92 });
  }, [fieldValue.imageType]);

  const handleCopy = useCallback(async () => {
    setCopyLoading(true);
    try {
      const dataUrl = await capture();
      if (!dataUrl) return;
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('图片已复制');
    } catch {
      showToast('复制失败，请尝试下载');
    } finally {
      setCopyLoading(false);
    }
  }, [capture]);

  const handleDownload = useCallback(async () => {
    setDownloadLoading(true);
    try {
      const dataUrl = await capture();
      if (!dataUrl) return;
      const extension = fieldValue.imageType === ImageType.PNG ? 'png' : 'jpg';
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = `${title}.${extension}`;
      anchor.click();
    } catch {
      showToast('下载失败');
    } finally {
      setDownloadLoading(false);
    }
  }, [capture, fieldValue.imageType, title]);

  const widthModeOptions = [
    { label: '宽', value: WidthMode.Wide },
    { label: '窄', value: WidthMode.Narrow },
  ];

  const imageTypeOptions = [
    { label: 'JPG', value: ImageType.JPG },
    { label: 'PNG', value: ImageType.PNG },
  ];

  const settings: FormItemProps[] = [
    {
      children: <Segmented options={widthModeOptions} />,
      label: '宽度',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'widthMode',
    },
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
      label: '包含页脚',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'withFooter',
      valuePropName: 'checked',
    },
    {
      children: <Segmented options={imageTypeOptions} />,
      label: '图片格式',
      layout: 'horizontal',
      minWidth: undefined,
      name: 'imageType',
    },
  ];

  const buttons = (
    <>
      <Button
        block
        icon={CopyIcon}
        loading={copyLoading}
        size={isMobileViewport ? undefined : 'large'}
        type="primary"
        onClick={handleCopy}
      >
        复制
      </Button>
      <Button
        block
        loading={downloadLoading}
        size={isMobileViewport ? undefined : 'large'}
        onClick={handleDownload}
      >
        下载
      </Button>
    </>
  );

  return (
    <>
      <Flexbox className={shareModalStyles.body} gap={16} horizontal={!isMobileViewport}>
        <SharePreviewBox narrow={fieldValue.widthMode === WidthMode.Narrow}>
          <div ref={previewRef}>
            <Flexbox gap={12}>
              <Text strong style={{ fontSize: 18 }}>
                {title}
              </Text>
              {fieldValue.withSystemRole && systemRole.trim() ? (
                <Markdown variant="chat">{systemRole.trim()}</Markdown>
              ) : null}
              {visibleMessages.map((message) => (
                <Flexbox gap={4} key={message.id}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {message.role}
                  </Text>
                  <Markdown variant="chat">{message.content}</Markdown>
                </Flexbox>
              ))}
              {fieldValue.withFooter ? (
                <Flexbox
                  horizontal
                  align="center"
                  justify="space-between"
                  style={{
                    borderTop: '1px solid var(--console-vars-color-border-secondary, rgba(0,0,0,0.06))',
                    marginTop: 8,
                    paddingTop: 12,
                  }}
                >
                  <Text type="secondary">{agentName}</Text>
                  <Text type="secondary">LinkLoom Agent Console</Text>
                </Flexbox>
              ) : null}
            </Flexbox>
          </div>
        </SharePreviewBox>
        <Flexbox className={shareModalStyles.sidebar} gap={12}>
          <Form
            initialValues={DEFAULT_FIELD_VALUE}
            items={settings}
            itemsType="flat"
            onValuesChange={(_, values) => setFieldValue(values as ShareImageFieldType)}
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
