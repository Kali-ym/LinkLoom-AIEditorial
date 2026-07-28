import { ReactNode } from 'react';
import { Footer } from './Footer';

/** 仅在部分页面底部展示页脚；日报页等全屏布局不展示。 */
export function FooterGate({ children }: { children?: ReactNode }) {
  return null;
}

export function FooterVisible() {
  return <Footer />;
}
