import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { adminBrand } from '../../config/adminBrand';
import { getAdminUiLang } from '../../utils/adminUiLocale';
import { AdminBrandMark } from '../AdminBrandMark';

interface AppLayoutProps {
  children: React.ReactNode;
}

const APP_VERSION = __APP_VERSION__;

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const brand = adminBrand(getAdminUiLang());

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden bg-background-light dark:bg-background-dark transition-colors duration-300">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar version={APP_VERSION} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-[60] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] w-64 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:hidden`}
      >
        <Sidebar onMobileClose={() => setIsSidebarOpen(false)} version={APP_VERSION} />
      </div>

      <main className="flex-1 flex flex-col h-full relative scroll-smooth text-text-ink dark:text-white overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-3 sm:p-4 border-b border-hairline dark:border-white/5 bg-canvas/85 dark:bg-background-dark/70 backdrop-blur-md sticky top-0 z-20 transition-colors">
          <div className="flex items-center gap-2.5">
            <AdminBrandMark size="sm" className="shadow-subtle" />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-[14px] text-text-ink dark:text-white tracking-tight">
                {brand.productTitle}
              </span>
              <span className="text-[10.5px] text-text-steel dark:text-slate-400">
                v{APP_VERSION}
              </span>
            </div>
          </div>
          <button
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-hairline dark:border-white/10 text-text-ink dark:text-white hover:bg-surface dark:hover:bg-white/5 transition-colors"
            onClick={toggleSidebar}
            aria-label="打开菜单"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        </div>

        <div className="flex-1 px-3 sm:px-4 md:px-10 lg:px-12 py-4 sm:py-6 md:py-10 w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
