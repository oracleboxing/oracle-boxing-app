'use client'

interface Tab {
  id: string
  label: string
}

interface PillTabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export function PillTabs({ tabs, activeTab, onChange, className = '' }: PillTabsProps) {
  return (
    <div
      className={[
        'flex gap-2 overflow-x-auto scrollbar-hide p-1',
        className,
      ].join(' ')}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer',
            activeTab === tab.id
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
