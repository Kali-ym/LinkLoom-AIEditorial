import { Command } from 'cmdk';
import { Monitor, Moon, Sun } from 'lucide-react';
import { memo } from 'react';

import { useTheme } from '../../context/ThemeContext';
import { commandStrings } from './commandStrings';
import { commandMenuStyles as styles } from './styles';
import { useCommandMenu } from './useCommandMenu';

/** §C.41 主题子页 */
export const ThemeMenu = memo(function ThemeMenu() {
  const { handleThemeChange } = useCommandMenu();
  const { theme } = useTheme();

  return (
    <>
      <Command.Item value="theme-light" onSelect={() => handleThemeChange('light')}>
        <Sun className={styles.icon} />
        <div className={styles.itemContent}>
          <div className={styles.itemDetails}>
            <div className={styles.itemLabel}>{commandStrings.themeLight}</div>
            {theme === 'light' ? (
              <div className={styles.itemDescription}>{commandStrings.themeCurrent}</div>
            ) : null}
          </div>
        </div>
      </Command.Item>
      <Command.Item value="theme-dark" onSelect={() => handleThemeChange('dark')}>
        <Moon className={styles.icon} />
        <div className={styles.itemContent}>
          <div className={styles.itemDetails}>
            <div className={styles.itemLabel}>{commandStrings.themeDark}</div>
            {theme === 'dark' ? (
              <div className={styles.itemDescription}>{commandStrings.themeCurrent}</div>
            ) : null}
          </div>
        </div>
      </Command.Item>
      <Command.Item value="theme-system" onSelect={() => handleThemeChange('system')}>
        <Monitor className={styles.icon} />
        <div className={styles.itemContent}>
          <div className={styles.itemDetails}>
            <div className={styles.itemLabel}>{commandStrings.themeSystem}</div>
          </div>
        </div>
      </Command.Item>
    </>
  );
});
