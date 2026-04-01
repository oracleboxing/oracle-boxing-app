import { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const roundedStyles = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-2xl',
  full: 'rounded-full',
}

export function Skeleton({ rounded = 'md', className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={[
        'animate-pulse bg-[var(--surface-secondary)]',
        roundedStyles[rounded],
        className,
      ].join(' ')}
      {...props}
    />
  )
}
