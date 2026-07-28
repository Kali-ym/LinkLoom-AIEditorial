import React from 'react';

type FileTreeNodeProps = {
  items: any[];
  skillId: string;
  selectedPath: string | null;
  onSelect: (skillId: string, path: string) => void;
  depth?: number;
};

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  items,
  skillId,
  selectedPath,
  onSelect,
  depth = 0
}) => (
  <div className={depth > 0 ? 'ml-3 border-l border-hairline-soft dark:border-white/5 pl-2' : ''}>
    {items.map((item: any) => (
      <div key={item.path}>
        {item.type === 'dir' ? (
          <div>
            <div className="flex items-center gap-1.5 py-1 px-1.5 text-text-slate dark:text-text-secondary">
              <span className="material-symbols-outlined text-sm">folder</span>
              <span className="text-[11px] font-bold">{item.name}</span>
            </div>
            {item.children && (
              <FileTreeNode items={item.children} skillId={skillId} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
            )}
          </div>
        ) : (
          <button
            onClick={() => onSelect(skillId, item.path)}
            className={`w-full flex items-center gap-1.5 py-1 px-1.5 rounded-full text-left transition-all ${
              selectedPath === item.path
                ? 'bg-surface-lavender text-ink-deep dark:bg-white/10 dark:text-white'
                : 'text-text-charcoal dark:text-text-secondary hover:bg-surface dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {item.name.endsWith('.md') ? 'article' : item.name.endsWith('.py') || item.name.endsWith('.js') || item.name.endsWith('.ts') ? 'code' : 'description'}
            </span>
            <span className="text-[11px] truncate flex-1">{item.name}</span>
            <span className="text-[9px] text-text-stone flex-shrink-0">{item.size < 1024 ? `${item.size}B` : `${(item.size / 1024).toFixed(1)}K`}</span>
          </button>
        )}
      </div>
    ))}
  </div>
);

export default FileTreeNode;
