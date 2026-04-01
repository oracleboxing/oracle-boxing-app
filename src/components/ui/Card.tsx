import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  elevated?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, elevated = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          'rounded-2xl border border-[var(--border)] p-4',
          elevated ? 'bg-[var(--surface-elevated)]' : 'bg-[var(--surface)]',
          hoverable ? 'cursor-pointer transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-secondary)] active:scale-[0.99]' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
