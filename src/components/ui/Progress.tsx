interface ProgressProps {
  value: number // 0-100
  max?: number
  color?: 'gold' | 'green' | 'red' | 'primary'
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

const colorStyles = {
  gold: 'bg-[var(--accent-gold)]',
  green: 'bg-[var(--accent-green)]',
  red: 'bg-[var(--accent-red)]',
  primary: 'bg-[var(--accent-primary)]',
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
}

export function Progress({
  value,
  max = 100,
  color = 'gold',
  size = 'md',
  showLabel = false,
  className = '',
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={['w-full', className].join(' ')}>
      {showLabel && (
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div className={['w-full rounded-full bg-[var(--surface-secondary)]', sizeStyles[size]].join(' ')}>
        <div
          className={['rounded-full transition-all duration-300', colorStyles[color], sizeStyles[size]].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
