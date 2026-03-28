import { cn } from '../../lib/cn'

const variants = {
  default: 'bg-primary/10 text-primary border-primary/20',
  phone: 'bg-green-50 text-green-700 border-green-200',
  email: 'bg-blue-50 text-blue-700 border-blue-200',
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
  facebook: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  tripadvisor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  address: 'bg-orange-50 text-orange-700 border-orange-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  muted: 'bg-muted text-muted-foreground border-transparent',
}

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        variants[variant] || variants.default,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
