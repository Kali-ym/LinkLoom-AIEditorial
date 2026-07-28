import { Command } from 'cmdk';
import { cloneElement, isValidElement, memo, type ComponentProps, type ReactNode } from 'react';

import { useCommandMenuContext } from '../CommandMenuContext';
import { commandMenuStyles as styles } from '../styles';

type BaseCommandItemProps = Omit<ComponentProps<typeof Command.Item>, 'children' | 'title'> & {
  forceMount?: boolean;
  unpinned?: boolean;
};

type SimpleCommandItemProps = BaseCommandItemProps & {
  children: ReactNode;
  icon: ReactNode;
  variant?: 'simple';
};

type DetailedCommandItemProps = BaseCommandItemProps & {
  description?: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  trailingLabel?: ReactNode;
  variant: 'detailed';
};

type CommandItemProps = SimpleCommandItemProps | DetailedCommandItemProps;

/** §C.28*/
export const CommandItem = memo(function CommandItem(props: CommandItemProps) {
  const { search } = useCommandMenuContext();
  const shouldRender = props.unpinned ? !!search : true;

  if (!shouldRender) return null;

  if (props.variant === 'detailed') {
    const { icon, title, description, trailingLabel, unpinned: _u, ...itemProps } = props;
    return (
      <Command.Item {...itemProps}>
        <div className={styles.itemContent}>
          <div className={styles.itemIcon}>{icon}</div>
          <div className={styles.itemDetails}>
            <div className={styles.itemTitle}>{title}</div>
            {description ? <div className={styles.itemDescription}>{description}</div> : null}
          </div>
          {trailingLabel ? <div className={styles.itemType}>{trailingLabel}</div> : null}
        </div>
      </Command.Item>
    );
  }

  const { icon, children, unpinned: _u, ...itemProps } = props;
  const iconWithClass =
    isValidElement(icon) && typeof icon.type !== 'string'
      ? cloneElement(icon, { className: styles.icon } as never)
      : icon;

  return (
    <Command.Item {...itemProps}>
      {iconWithClass}
      <div className={styles.itemContent}>
        <div className={styles.itemLabel}>{children}</div>
      </div>
    </Command.Item>
  );
});
