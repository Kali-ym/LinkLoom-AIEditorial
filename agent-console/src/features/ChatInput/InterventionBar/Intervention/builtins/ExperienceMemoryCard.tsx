import { Accordion, AccordionItem, Avatar, Flexbox, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow: hidden;
    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;
    background: ${cssVar.colorBgContainer};
  `,
  content: css`
    padding-block: 12px;
    padding-inline: 16px;
  `,
  detail: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${cssVar.colorTextSecondary};
  `,
  header: css`
    padding-block: 10px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  keyLearning: css`
    font-size: 14px;
    line-height: 1.6;
    color: ${cssVar.colorText};
  `,
  keyLearningLabel: css`
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorWarning};
  `,
  section: css`
    padding: 4px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  starItem: css`
    display: grid;
    grid-template-columns: 20px 1fr;
    gap: 8px 12px;
    padding-block-end: 12px;
  `,
  starRail: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  `,
  starLine: css`
    flex: 1;
    width: 1px;
    min-height: 12px;
    background: ${cssVar.colorBorderSecondary};
  `,
  stepContent: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${cssVar.colorTextSecondary};
    white-space: pre-wrap;
  `,
  summary: css`
    font-size: 14px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
  tags: css`
    padding-block-start: 8px;
    border-block-start: 1px dashed ${cssVar.colorBorderSecondary};
  `,
  title: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
}));

export interface ExperienceMemoryData {
  details?: string;
  keyLearning?: string;
  summary?: string;
  tags?: string[];
  title?: string;
  withExperience?: {
    action?: string;
    keyLearning?: string;
    possibleOutcome?: string;
    reasoning?: string;
    situation?: string;
  };
}

/** Ported from upstream `ExperienceMemoryCard` */
export const ExperienceMemoryCard = memo(function ExperienceMemoryCard({
  data,
}: {
  data?: ExperienceMemoryData;
}) {
  const { summary, details, tags, title, withExperience } = data || {};
  const { situation, reasoning, action, possibleOutcome, keyLearning } = withExperience || {};
  const hasStarContent = Boolean(situation || reasoning || action || possibleOutcome);

  if (!summary && !details && !tags?.length && !title && !hasStarContent && !keyLearning) {
    return null;
  }

  const starItems = [
    { avatar: 'S', content: situation, title: 'Situation' },
    { avatar: 'T', content: reasoning, title: 'Task' },
    { avatar: 'A', content: action, title: 'Action' },
    { avatar: 'R', content: possibleOutcome, title: 'Result' },
  ].filter((item) => item.content);

  return (
    <Flexbox className={styles.container}>
      <Flexbox horizontal align="center" className={styles.header} gap={8}>
        <Flexbox flex={1}>
          <div className={styles.title}>{title || '经验记忆'}</div>
        </Flexbox>
      </Flexbox>

      {hasStarContent ? (
        <>
          {(summary || tags?.length) ? (
            <Accordion gap={0}>
              <AccordionItem
                itemKey="summary"
                paddingBlock={8}
                paddingInline={8}
                styles={{ base: { marginBlock: 4, marginInline: 4 } }}
                title={
                  <Text fontSize={12} type="secondary" weight={500}>
                    Summary
                  </Text>
                }
              >
                <Flexbox gap={8} paddingBlock="8px 12px" paddingInline={8}>
                  {summary ? <div className={styles.summary}>{summary}</div> : null}
                  {details ? <div className={styles.detail}>{details}</div> : null}
                  {tags && tags.length > 0 ? (
                    <Flexbox horizontal className={styles.tags} gap={8} wrap="wrap">
                      {tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Flexbox>
                  ) : null}
                </Flexbox>
              </AccordionItem>
            </Accordion>
          ) : null}

          <Accordion className={styles.section} defaultExpandedKeys={['star']} gap={0}>
            <AccordionItem
              itemKey="star"
              paddingBlock={8}
              paddingInline={8}
              title={
                <Text fontSize={12} type="secondary" weight={500}>
                  STAR
                </Text>
              }
            >
              <Flexbox gap={0} paddingBlock="8px 12px" paddingInline={8}>
                {starItems.map((item, index) => (
                  <div className={styles.starItem} key={item.title}>
                    <div className={styles.starRail}>
                      <Avatar
                        shadow
                        avatar={item.avatar}
                        shape="square"
                        size={20}
                        style={{
                          border: `1px solid ${cssVar.colorBorderSecondary}`,
                          fontSize: 11,
                        }}
                      />
                      {index < starItems.length - 1 ? <div className={styles.starLine} /> : null}
                    </div>
                    <Flexbox gap={4}>
                      <Text fontSize={12} type="secondary" weight={500}>
                        {item.title}
                      </Text>
                      <div className={styles.stepContent}>{item.content}</div>
                    </Flexbox>
                  </div>
                ))}
              </Flexbox>
            </AccordionItem>
          </Accordion>

          {keyLearning ? (
            <Flexbox
              className={styles.section}
              gap={8}
              style={{ paddingBlock: 16, paddingInline: 12 }}
            >
              <span className={styles.keyLearningLabel}>Key Learning</span>
              <div className={styles.keyLearning}>{keyLearning}</div>
            </Flexbox>
          ) : null}
        </>
      ) : (
        <Flexbox className={styles.content} gap={8}>
          {summary ? <div className={styles.summary}>{summary}</div> : null}
          {details ? <div className={styles.detail}>{details}</div> : null}
          {keyLearning ? <div className={styles.keyLearning}>{keyLearning}</div> : null}
          {tags && tags.length > 0 ? (
            <Flexbox horizontal className={styles.tags} gap={8} wrap="wrap">
              {tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Flexbox>
          ) : null}
        </Flexbox>
      )}
    </Flexbox>
  );
});
