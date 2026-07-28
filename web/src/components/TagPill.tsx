export function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-hairline bg-canvas px-2.5 py-0.5 text-[11px] font-medium text-body">
      {children}
    </span>
  );
}
