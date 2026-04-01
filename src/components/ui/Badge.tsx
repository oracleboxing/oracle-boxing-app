import { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'gold' | 'green' | 'red' | 'purple' | 'outline'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]',
  gold: 'bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]',
  green: 'bg-[var(--accent-green)]/15 text-[var(--accent-green)]',
  red: 'bg-[var(--accent-red)]/15 text-[var(--accent-red)]',
  purple: 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]',
  outline: 'border border-[var(--border-strong)] text-[var(--text-secondary)]',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
