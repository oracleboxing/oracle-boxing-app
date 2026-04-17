'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Drill, DrillCategory, DrillDifficulty, GradeLevel, Json } from '@/lib/supabase/types'

type LibraryStatusFilter = 'all' | 'active' | 'inactive' | 'curated' | 'needs-review'

type DrillInsight = {
  stepsCount: number
  focusPointsCount: number
  mistakesCount: number
  rawLinkCount: number
  completenessScore: number
  completenessLabel: string
}

const STATUS_FILTER_LABELS: Record<LibraryStatusFilter, string> = {
  all: 'All library rows',
  active: 'Active only',
  inactive: 'Inactive only',
  curated: 'Curated only',
  'needs-review': 'Needs review',
}

function formatGradeLevel(value: GradeLevel | null) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatCategory(value: DrillCategory | null) {
  if (!value) return 'Uncategorised'
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatDifficulty(value: DrillDifficulty) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function countJsonItems(value: Json | null) {
  return Array.isArray(value) ? value.length : 0
}

function jsonToStringList(value: Json | null) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function buildDrillInsight(drill: Drill): DrillInsight {
  const stepsCount = countJsonItems(drill.steps_json)
  const focusPointsCount = countJsonItems(drill.focus_points_json)
  const mistakesCount = countJsonItems(drill.common_mistakes_json)
  const rawLinkCount = drill.raw_candidate_ids?.length ?? 0
  const completenessScore = [
    Boolean(drill.summary),
    Boolean(drill.description),
    stepsCount > 0,
    focusPointsCount > 0,
    mistakesCount > 0,
    Boolean(drill.what_it_trains),
    Boolean(drill.when_to_assign),
    Boolean(drill.coach_demo_quote),
  ].filter(Boolean).length

  const completenessLabel =
    completenessScore >= 7 ? 'Rich detail' : completenessScore >= 4 ? 'Usable detail' : 'Thin detail'

  return {
    stepsCount,
    focusPointsCount,
    mistakesCount,
    rawLinkCount,
    completenessScore,
    completenessLabel,
  }
}

function getSearchHaystack(drill: Drill) {
  return [
    drill.title,
    drill.slug,
    drill.summary,
    drill.description,
    drill.what_it_trains,
    drill.when_to_assign,
    drill.category,
    drill.difficulty,
    drill.grade_level,
    ...(drill.skill_tags ?? []),
    ...(drill.format_tags ?? []),
    ...(drill.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getDrillTone(drill: Drill) {
  if (drill.is_active && drill.is_curated) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
  }

  if (!drill.is_active) {
    return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
  }

  return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

export function DrillLibraryClient({ drills }: { drills: Drill[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>('active')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | string>('all')
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all')
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(drills[0]?.id ?? null)

  const drillInsights = useMemo(() => {
    const insights = new Map<string, DrillInsight>()

    for (const drill of drills) {
      insights.set(drill.id, buildDrillInsight(drill))
    }

    return insights
  }, [drills])

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(drills.map((drill) => drill.category).filter((category): category is DrillCategory => Boolean(category)))
      ).sort(),
    [drills]
  )

  const availableDifficulties = useMemo(
    () =>
      Array.from(
        new Set(
          drills.map((drill) => drill.difficulty).filter((difficulty): difficulty is DrillDifficulty => Boolean(difficulty))
        )
      ).sort(),
    [drills]
  )

  const availableGrades = useMemo(
    () => Array.from(new Set(drills.map((drill) => drill.grade_level ?? 'unassigned'))).sort(),
    [drills]
  )

  const filteredDrills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return drills.filter((drill) => {
      if (statusFilter === 'active' && !drill.is_active) return false
      if (statusFilter === 'inactive' && drill.is_active) return false
      if (statusFilter === 'curated' && !drill.is_curated) return false
      if (statusFilter === 'needs-review' && drill.is_curated) return false

      if (categoryFilter !== 'all' && drill.category !== categoryFilter) return false
      if (difficultyFilter !== 'all' && drill.difficulty !== difficultyFilter) return false

      const drillGrade = drill.grade_level ?? 'unassigned'
      if (gradeFilter !== 'all' && drillGrade !== gradeFilter) return false

      if (normalizedQuery && !getSearchHaystack(drill).includes(normalizedQuery)) return false

      return true
    })
  }, [drills, query, statusFilter, categoryFilter, difficultyFilter, gradeFilter])

  useEffect(() => {
    if (filteredDrills.length === 0) {
      setSelectedDrillId(null)
      return
    }

    if (!selectedDrillId || !filteredDrills.some((drill) => drill.id === selectedDrillId)) {
      setSelectedDrillId(filteredDrills[0].id)
    }
  }, [filteredDrills, selectedDrillId])

  const selectedDrill = filteredDrills.find((drill) => drill.id === selectedDrillId) ?? filteredDrills[0] ?? null

  const summary = useMemo(() => {
    const activeCount = drills.filter((drill) => drill.is_active).length
    const curatedCount = drills.filter((drill) => drill.is_curated).length
    const gradeAssignedCount = drills.filter((drill) => drill.grade_level).length
    const categoryCount = availableCategories.length

    return {
      totalCount: drills.length,
      activeCount,
      curatedCount,
      gradeAssignedCount,
      categoryCount,
    }
  }, [drills, availableCategories.length])

  if (drills.length === 0) {
    return (
      <EmptyState
        title="No curated drills yet"
        body="The drills table is reachable, but it is still empty. Once canonical drills are promoted into drills, they will show up here instead of in the raw review queue."
      />
    )
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Curated library rows" value={summary.totalCount} hint="All rows in drills" />
        <SummaryCard label="Active drills" value={summary.activeCount} hint="Ready for app use" />
        <SummaryCard label="Marked curated" value={summary.curatedCount} hint="Canonical-quality rows" />
        <SummaryCard label="Categories in use" value={summary.categoryCount} hint={`${summary.gradeAssignedCount} rows have a grade`} />
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Browse curated drills</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Search the clean library layer without mixing in raw candidate noise.
            </p>
          </div>

          <div className="grid w-full gap-3 md:grid-cols-2 xl:w-auto xl:grid-cols-5">
            <input
              type="text"
              placeholder="Search title, tags, summary..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as LibraryStatusFilter)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">All categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {formatCategory(category)}
                </option>
              ))}
            </select>

            <select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">All difficulties</option>
              {availableDifficulties.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {formatDifficulty(difficulty)}
                </option>
              ))}
            </select>

            <select
              value={gradeFilter}
              onChange={(event) => setGradeFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">All grades</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {formatGradeLevel(grade === 'unassigned' ? null : (grade as GradeLevel))}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredDrills.length === 0 ? (
        <EmptyState title="No matching drills" body="Nothing in the curated drills table matches the current search and filter combination." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{filteredDrills.length} matching drills</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Curated library index</p>
              </div>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {filteredDrills.map((drill) => {
                const insight = drillInsights.get(drill.id)
                const isSelected = selectedDrill?.id === drill.id

                return (
                  <button
                    key={drill.id}
                    type="button"
                    onClick={() => setSelectedDrillId(drill.id)}
                    className={`w-full px-5 py-4 text-left transition-colors ${
                      isSelected ? 'bg-[var(--surface-secondary)]' : 'hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">{drill.title}</h3>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDrillTone(drill)}`}>
                            {drill.is_active ? (drill.is_curated ? 'Active curated' : 'Active draft') : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{drill.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-tertiary)]">
                          <span>{formatCategory(drill.category)}</span>
                          <span>•</span>
                          <span>{formatDifficulty(drill.difficulty)}</span>
                          <span>•</span>
                          <span>{formatGradeLevel(drill.grade_level)}</span>
                          <span>•</span>
                          <span>{insight?.completenessLabel ?? 'Detail unknown'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-[var(--text-secondary)] lg:min-w-44">
                        <Stat label="Steps" value={insight?.stepsCount ?? 0} compact />
                        <Stat label="Focus" value={insight?.focusPointsCount ?? 0} compact />
                        <Stat label="Mistakes" value={insight?.mistakesCount ?? 0} compact />
                        <Stat label="Sources" value={insight?.rawLinkCount ?? 0} compact />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            {selectedDrill ? <DrillDetail drill={selectedDrill} insight={drillInsights.get(selectedDrill.id) ?? buildDrillInsight(selectedDrill)} /> : null}
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-tertiary)]">{hint}</p>
    </div>
  )
}

function Stat({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function DetailSection({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{emptyText}</p>
      )}
    </div>
  )
}

function TagRow({ title, tags }: { title: string; tags: string[] }) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={`${title}-${tag}`}
            className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function DrillDetail({ drill, insight }: { drill: Drill; insight: DrillInsight }) {
  const steps = jsonToStringList(drill.steps_json)
  const focusPoints = jsonToStringList(drill.focus_points_json)
  const commonMistakes = jsonToStringList(drill.common_mistakes_json)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDrillTone(drill)}`}>
            {drill.is_active ? (drill.is_curated ? 'Active curated' : 'Active draft') : 'Inactive'}
          </span>
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {formatCategory(drill.category)}
          </span>
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {formatDifficulty(drill.difficulty)}
          </span>
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {formatGradeLevel(drill.grade_level)}
          </span>
        </div>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{drill.title}</h2>
        <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{drill.summary}</p>
        {drill.description ? <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{drill.description}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Steps" value={insight.stepsCount} />
        <Stat label="Focus points" value={insight.focusPointsCount} />
        <Stat label="Common mistakes" value={insight.mistakesCount} />
        <Stat label="Source links" value={insight.rawLinkCount} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetaCard label="Slug" value={drill.slug} />
        <MetaCard label="Detail quality" value={`${insight.completenessLabel} (${insight.completenessScore}/8)`} />
        <MetaCard label="What it trains" value={drill.what_it_trains || 'Not written yet'} />
        <MetaCard label="When to assign" value={drill.when_to_assign || 'Not written yet'} />
        <MetaCard label="Source file" value={drill.source_file || 'No source file linked'} />
        <MetaCard label="Source type" value={drill.source_type || 'No source type linked'} />
        <MetaCard label="Updated" value={formatDateTime(drill.updated_at)} />
        <MetaCard label="Created" value={formatDateTime(drill.created_at)} />
      </div>

      {drill.coach_demo_quote ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Coach demo quote</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">“{drill.coach_demo_quote}”</p>
        </div>
      ) : null}

      <TagRow title="Skill tags" tags={drill.skill_tags ?? []} />
      <TagRow title="Format tags" tags={drill.format_tags ?? []} />
      <TagRow title="Other tags" tags={drill.tags ?? []} />

      <DetailSection title="Steps" items={steps} emptyText="No steps have been written for this drill yet." />
      <DetailSection title="Focus points" items={focusPoints} emptyText="No focus points have been written for this drill yet." />
      <DetailSection title="Common mistakes" items={commonMistakes} emptyText="No common mistakes have been written for this drill yet." />
    </div>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
