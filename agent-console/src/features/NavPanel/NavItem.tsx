import {
  type BlockProps,
  type GenericItemType,
  type IconProps,
  Block,
  Center,
  ContextMenuTrigger,
  Flexbox,
  Icon,
  Text,
} from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type ReactNode, memo } from 'react';

import { NeuralNetworkLoading } from '../../components/NeuralNetworkLoading';
import { isModifierClick } from '../../utils/navigation';

export const NAV_ITEM_ACTION_CLASS_NAME = 'nav-item-actions';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    user-select: none;
    overflow: hidden;
    min-width: 32px;

    .${NAV_ITEM_ACTION_CLASS_NAME} {
      width: 0;
      margin-inline-end: 2px;
      opacity: 0;
      transition: opacity 0.2s ${cssVar.motionEaseOut};

      &:has([data-popup-open]) {
        width: unset;
        opacity: 1;
      }
    }

    &:hover {
      .${NAV_ITEM_ACTION_CLASS_NAME} {
        width: unset;
        opacity: 1;
      }
    }
  `,
}));

export interface NavItemSlots {
  iconPostfix?: ReactNode;
  titlePrefix?: ReactNode;
}

export interface NavItemProps extends Omit<BlockProps, 'children' | 'title'> {
  actions?: ReactNode;
  active?: boolean;
  contextMenuItems?: GenericItemType[] | (() => GenericItemType[]);
  description?: ReactNode;
  disabled?: boolean;
  extra?: ReactNode;
  href?: string;
  icon?: IconProps['icon'];
  iconSize?: number;
  loading?: boolean;
  slots?: NavItemSlots;
  title: ReactNode;
  titleColor?: string;
}

/** §C.7 NavItem*/
export const NavItem = memo<NavItemProps>(function NavItem({
  className,
  actions,
  active,
  contextMenuItems,
  href,
  icon,
  iconSize = 18,
  title,
  titleColor,
  description,
  onClick,
  disabled,
  loading,
  extra,
  slots,
  ...rest
}) {
  const iconColor = active ? cssVar.colorText : cssVar.colorTextDescription;
  const textColor = titleColor ?? (active ? cssVar.colorText : cssVar.colorTextSecondary);
  const variant = active ? 'filled' : 'borderless';
  const { titlePrefix, iconPostfix } = slots ?? {};

  const linkProps = href
    ? {
        as: 'a' as const,
        href,
        style: { color: 'inherit', textDecoration: 'none' },
      }
    : {};

  const content = (
    <Block
      horizontal
      align="center"
      className={cx(styles.container, className)}
      clickable={!disabled}
      gap={8}
      height={description ? undefined : 36}
      paddingBlock={description ? 4 : undefined}
      paddingInline={4}
      variant={variant}
      onClick={(e) => {
        if (href && !isModifierClick(e)) {
          e.preventDefault();
        }
        if (disabled) return;
        onClick?.(e);
      }}
      {...linkProps}
      {...rest}
    >
      {icon && (
        <Center flex="none" height={28} width={28}>
          {loading ? (
            <NeuralNetworkLoading size={iconSize} />
          ) : (
            <Icon color={iconColor} icon={icon} size={iconSize} />
          )}
        </Center>
      )}
      {iconPostfix}
      <Flexbox horizontal align="center" flex={1} gap={8} style={{ overflow: 'hidden' }}>
        {titlePrefix}
        {description ? (
          <Flexbox flex={1} gap={1} style={{ overflow: 'hidden' }}>
            <Text color={textColor} ellipsis title={typeof title === 'string' ? title : undefined}>
              {title}
            </Text>
            {description}
          </Flexbox>
        ) : (
          <Text
            color={textColor}
            ellipsis
            style={{ flex: 1 }}
            title={typeof title === 'string' ? title : undefined}
          >
            {title}
          </Text>
        )}
        <Flexbox
          horizontal
          align="center"
          gap={2}
          justify="flex-end"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {extra}
          {actions && (
            <Flexbox
              horizontal
              align="center"
              className={NAV_ITEM_ACTION_CLASS_NAME}
              gap={2}
              justify="flex-end"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {actions}
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
    </Block>
  );

  if (!contextMenuItems) return content;
  return <ContextMenuTrigger items={contextMenuItems}>{content}</ContextMenuTrigger>;
});
