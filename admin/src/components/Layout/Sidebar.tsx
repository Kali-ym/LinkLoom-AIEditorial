import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { adminBrand } from '../../config/adminBrand';
import { getAdminUiLang } from '../../utils/adminUiLocale';
import { AdminBrandMark } from '../AdminBrandMark';

interface SidebarProps {
  onMobileClose?: () => void;
  version?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onMobileClose, version }) => {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const brand = adminBrand(getAdminUiLang());

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (onMobileClose) onMobileClose();
  };

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose();
  };

  const navItems = [
    { name: '调度中心', icon: 'dashboard_customize', path: '/scheduling' },
    { name: '内容筛选', icon: 'filter_list', path: '/selection' },
    { name: '生成预览', icon: 'auto_awesome', path: '/generation' },
    { name: '多智能体', icon: 'smart_toy', path: '/agents' },
    { name: '运营中心', icon: 'monitoring', path: '/ops' },
    { name: '知识与记忆', icon: 'library_books', path: '/knowledge' },
    { name: '历史存档', icon: 'history', path: '/history' },
    { name: '系统设置', icon: 'settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-hairline dark:border-white/5 bg-canvas dark:bg-background-dark flex flex-col h-screen transition-colors">
      <div className="p-6 pb-2">
        {/* Brand wordmark — yellow-square signature inspired by Miro */}
        <div className="flex items-center gap-3 mb-8">
          <AdminBrandMark size="md" className="shadow-subtle" />
          <div className="flex flex-col leading-tight">
            <h1 className="text-text-ink dark:text-white text-[15px] font-semibold tracking-tight">
              {brand.productTitle}
            </h1>
            <p className="text-text-steel dark:text-text-secondary text-[11px] font-normal">
              {brand.tagline}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-ink text-white dark:bg-white dark:text-ink shadow-subtle'
                    : 'text-text-charcoal dark:text-text-secondary hover:bg-surface dark:hover:bg-white/5 hover:text-text-ink dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? '' : 'group-hover:text-text-ink dark:group-hover:text-white'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[13.5px] font-medium tracking-tight">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto px-4 pb-6 pt-4 border-t border-hairline dark:border-white/5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <button
            onClick={toggleTheme}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full text-[12.5px] font-medium text-text-charcoal dark:text-text-secondary border border-hairline dark:border-white/10 hover:border-ink hover:text-ink dark:hover:border-white dark:hover:text-white transition-colors"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            {theme === 'dark' ? '浅色' : '深色'}
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-text-steel border border-hairline dark:border-white/10 hover:border-brand-red hover:text-brand-red dark:hover:border-brand-red transition-colors"
            title="退出登录"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>

        {version && (
          <div className="mt-3 px-2 text-[11px] text-text-stone dark:text-slate-500 tracking-wide">
            版本 v{version}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
