export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline bg-surface-soft/70 text-muted">
      <div className="flex flex-col gap-4 px-5 py-6 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <span className="text-center sm:text-left">© {new Date().getFullYear()} LinkLoom · 由 AI 自动评分与编排</span>
        <div className="flex shrink-0 items-center justify-center gap-5">
          <a href="/rss.xml" className="hover:text-primary transition-colors">RSS</a>
          <a href="/about" className="hover:text-primary transition-colors">关于</a>
        </div>
      </div>
    </footer>
  );
}