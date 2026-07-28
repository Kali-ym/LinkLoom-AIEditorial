/** index.html `positionFloatingMenu` / `positionPlusFlyout` + 统一浮层定位 */

export interface FloatingPositionOptions {
  preferAbove?: boolean;
  gap?: number;
  margin?: number;
  align?: 'start' | 'end' | 'center';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function clearFloatingMenuStyles(menuEl: HTMLElement): void {
  menuEl.style.visibility = '';
  menuEl.style.display = '';
}

/** 在菜单已可见（CSS .open）时测量尺寸并定位，不写入 display */
export function measureFloatingMenu(menuEl: HTMLElement, measure: () => void): void {
  menuEl.style.visibility = 'hidden';
  measure();
  menuEl.style.visibility = '';
}


/** 通用 fixed 浮层：相对锚点自动翻转、贴边 */
export function positionFloatingPanel(
  menuEl: HTMLElement,
  anchorEl: HTMLElement,
  options: FloatingPositionOptions = {},
): void {
  const { preferAbove = false, gap = 6, margin = 8, align = 'start' } = options;

  menuEl.style.position = 'fixed';
  menuEl.style.bottom = 'auto';
  menuEl.style.right = 'auto';

  const rect = anchorEl.getBoundingClientRect();
  const menuW = menuEl.offsetWidth || 220;
  const menuH = menuEl.offsetHeight || 200;

  let left: number;
  if (align === 'end') {
    left = rect.right - menuW;
  } else if (align === 'center') {
    left = rect.left + (rect.width - menuW) / 2;
  } else {
    left = rect.left;
  }
  left = clamp(left, margin, window.innerWidth - menuW - margin);

  let top = preferAbove ? rect.top - menuH - gap : rect.bottom + gap;
  if (top < margin) top = rect.bottom + gap;
  if (top + menuH > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - menuH - gap);
  }

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}

/** 相对输入卡片内边距对齐（slash / mention 菜单） */
export function positionInputCardMenu(menuEl: HTMLElement, cardEl: HTMLElement): void {
  menuEl.style.position = 'fixed';
  menuEl.style.bottom = 'auto';
  menuEl.style.right = 'auto';

  const inset = 20;
  const gap = 4;
  const margin = 8;
  const cardRect = cardEl.getBoundingClientRect();
  const menuH = menuEl.offsetHeight || 200;
  const width = Math.min(400, Math.max(220, cardRect.width - inset * 2));

  menuEl.style.width = `${width}px`;
  menuEl.style.maxWidth = `${width}px`;

  let left = cardRect.left + inset;
  left = clamp(left, margin, window.innerWidth - width - margin);

  let top = cardRect.top - menuH - gap;
  if (top < margin) top = cardRect.bottom + gap;
  if (top + menuH > window.innerHeight - margin) {
    top = Math.max(margin, cardRect.top - menuH - gap);
  }

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}

/** 右键菜单等：相对点击坐标，自动避让视口 */
export function positionAtPoint(
  menuEl: HTMLElement,
  x: number,
  y: number,
  margin = 8,
): void {
  menuEl.style.position = 'fixed';
  menuEl.style.bottom = 'auto';
  menuEl.style.right = 'auto';

  const menuW = menuEl.offsetWidth || 160;
  const menuH = menuEl.offsetHeight || 200;

  let left = x;
  let top = y;
  if (left + menuW > window.innerWidth - margin) left = window.innerWidth - menuW - margin;
  if (top + menuH > window.innerHeight - margin) top = y - menuH;
  left = clamp(left, margin, window.innerWidth - menuW - margin);
  top = clamp(top, margin, window.innerHeight - menuH - margin);

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}

export function positionFloatingMenu(
  menuEl: HTMLElement,
  anchorEl: HTMLElement,
  preferAbove = false,
): void {
  positionFloatingPanel(menuEl, anchorEl, { preferAbove, align: 'start' });
}

export function positionPlusFlyout(
  panel: HTMLElement,
  anchorItem: HTMLElement,
  menuEl: HTMLElement,
): void {
  panel.style.visibility = 'hidden';
  panel.classList.add('open');
  const itemRect = anchorItem.getBoundingClientRect();
  const menuRect = menuEl.getBoundingClientRect();
  const panelW = panel.offsetWidth || 240;
  const panelH = panel.offsetHeight || 200;
  const gap = -2;
  let left = menuRect.right + gap;
  let top = itemRect.top;
  if (left + panelW > window.innerWidth - 8) {
    left = menuRect.left - panelW - gap;
  }
  if (top + panelH > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - panelH - 8);
  }
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.visibility = '';
}

export function getInputCardElement(): HTMLElement | null {
  return document.getElementById('inputCard');
}

/** 打开浮层时定位，并在 resize / scroll 时重算 */
export function bindFloatingReposition(reposition: () => void): () => void {
  const onReposition = () => reposition();
  window.addEventListener('resize', onReposition);
  window.addEventListener('scroll', onReposition, true);
  return () => {
    window.removeEventListener('resize', onReposition);
    window.removeEventListener('scroll', onReposition, true);
  };
}
