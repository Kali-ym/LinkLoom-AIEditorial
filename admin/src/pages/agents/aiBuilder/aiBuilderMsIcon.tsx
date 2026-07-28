function msIconOpsz(size: number) {
  if (size >= 48) return 48;
  if (size >= 24) return 24;
  return 20;
}

export function MsIcon({
  name,
  size = 20,
  className = ''
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined shrink-0 leading-none ${className}`}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${msIconOpsz(size)}`
      }}
    >
      {name}
    </span>
  );
}
