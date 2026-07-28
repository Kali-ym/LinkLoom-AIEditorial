type BrandMarkProps = {
  size?: 'sm' | 'md';
  className?: string;
};

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9'
} as const;

export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] ${SIZES[size]} ${className}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG asset */}
      <img src="/icon.svg" alt="" className="h-full w-full" width={36} height={36} />
    </span>
  );
}
