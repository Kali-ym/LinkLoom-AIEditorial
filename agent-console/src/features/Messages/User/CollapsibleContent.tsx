import { createStaticStyles } from 'antd-style';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const DEFAULT_MAX_HEIGHT = 280;
const VIEWPORT_RATIO = 0.35;
const OVERFLOW_THRESHOLD = 32;

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    position: relative;
    width: 100%;
  `,
  contentCollapsed: css`
    overflow: hidden;
    mask-image: linear-gradient(to bottom, #000 calc(100% - 48px), transparent);
  `,
  contentExpanded: css`
    overflow: visible;
  `,
  toggleButton: css`
    cursor: pointer;
    display: inline-flex;
    gap: 4px;
    align-items: center;
    block-size: 24px;
    padding-inline: 10px;
    border: none;
    border-radius: 12px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillQuaternary};
    transition:
      color 150ms ${cssVar.motionEaseOut},
      background 150ms ${cssVar.motionEaseOut};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  toggleWrapper: css`
    display: flex;
    justify-content: center;
    margin-block-start: 6px;
  `,
}));

const computeThreshold = () => {
  if (typeof window === 'undefined') return DEFAULT_MAX_HEIGHT;
  return Math.min(DEFAULT_MAX_HEIGHT, Math.round(window.innerHeight * VIEWPORT_RATIO));
};

/** Upstream `User/components/CollapsibleContent.tsx` */
export const CollapsibleContent = memo(function CollapsibleContent({
  children,
}: {
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState(() => computeThreshold());
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(true);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => setNaturalHeight(el.scrollHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setMaxHeight(computeThreshold());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldCollapse = naturalHeight > maxHeight + OVERFLOW_THRESHOLD;
  const isCollapsed = shouldCollapse && collapsed;

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <div className={styles.container}>
      <div
        className={isCollapsed ? styles.contentCollapsed : styles.contentExpanded}
        ref={contentRef}
        style={isCollapsed ? { maxHeight } : undefined}
      >
        {children}
      </div>
      {shouldCollapse && (
        <div className={styles.toggleWrapper}>
          <button className={styles.toggleButton} type="button" onClick={handleToggle}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {collapsed ? '展开全文' : '收起'}
          </button>
        </div>
      )}
    </div>
  );
});
