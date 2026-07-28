type AdminBrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-12 w-12'
} as const;

export function AdminBrandMark({ size = 'md', className = '' }: AdminBrandMarkProps) {
  const src = `${import.meta.env.BASE_URL}icon.svg`;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] ${SIZES[size]} ${className}`}
      aria-hidden
    >
      <img src={src} alt="" className="h-full w-full" width={40} height={40} />
    </span>
  );
}

export default AdminBrandMark;
