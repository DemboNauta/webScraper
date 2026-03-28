import { cn } from '../../lib/cn'

export function Spinner({ className, size = 16 }) {
  return (
    <svg
      className={cn('animate-spin text-muted-foreground', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
