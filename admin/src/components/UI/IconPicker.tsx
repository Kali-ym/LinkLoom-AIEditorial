import React from 'react';
import { motion } from 'framer-motion';

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (icon: string) => void;
  currentIcon?: string;
}

const RECOMMENDED_ICONS = [
  'label', 'newspaper', 'article', 'menu_book', 'school',
  'code', 'terminal', 'psychology', 'smart_toy', 'auto_awesome',
  'trending_up', 'bolt', 'rocket_launch', 'database', 'cloud',
  'public', 'forum', 'record_voice_over', 'video_library', 'radio',
  'biotech', 'science', 'hub', 'extension', 'star', 'favorite',
  'settings', 'person', 'group', 'notifications', 'mail', 'search',
  'home', 'dashboard', 'list', 'grid_view', 'history', 'category'
];

const IconPicker: React.FC<IconPickerProps> = ({ isOpen, onClose, onSelect, currentIcon }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background Overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 shadow-modal w-full max-w-md overflow-hidden z-10"
      >
        <div className="px-6 py-4 border-b border-hairline-soft dark:border-white/5 flex items-center justify-between bg-surface-soft/80 dark:bg-white/[0.02]">
          <h3 className="font-medium text-text-ink dark:text-white">选择分类图标</h3>
          <button onClick={onClose} className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-white/5 dark:hover:text-white rounded-full transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-6 gap-3 max-h-[320px] overflow-y-auto pr-2">
            {RECOMMENDED_ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => {
                  onSelect(icon);
                  onClose();
                }}
                className={`
                  p-3 rounded-2xl flex items-center justify-center transition-all
                  ${currentIcon === icon 
                    ? 'bg-ink text-white dark:bg-white dark:text-ink shadow-subtle scale-110' 
                    : 'bg-surface-soft dark:bg-white/5 text-text-charcoal dark:text-text-secondary hover:bg-surface-lavender hover:text-ink-deep'}
                `}
                title={icon}
              >
                <span className="material-symbols-outlined text-2xl">{icon}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-4 bg-surface-soft/80 dark:bg-white/[0.02] border-t border-hairline-soft dark:border-white/5 text-center">
          <p className="text-xs text-text-stone">
            也可以在设置页面直接输入 Material Symbols 名称
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default IconPicker;
