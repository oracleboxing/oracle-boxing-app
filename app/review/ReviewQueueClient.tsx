'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { AiDecision, Drill, Json, RawDrillCandidate, ReviewStatus } from '@/lib/supabase/types'

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'merged', 'rejected']
const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  merged: 'Merged',
  rejected: 'Rejected',
}

const STATUS_SORT_ORDER: Record<ReviewStatus, number> = {
  pending: 0,
  approved: 1,
  merged: 2,
  rejected: 3,
}

const REVIEW_ROUTE_SHORTCUTS: Record<ReviewRouteKey, '1' | '2' | '3'> = {
  'approve-ready': '1',
  'merge-sweep': '2',
  'thin-cleanup': '3',
}

const MERGE_TARGET_SHORTCUT_KEYS = ['4', '5', '6', '7', '8', '9'] as const

const REVIEW_QUEUE_ROW_SHORTCUTS = 'Enter S X Space Escape J K ArrowDown ArrowUp N P L G Shift+G Home End PageDown PageUp F [ ] , .'
const REVIEW_RETURN_TO_QUEUE_SHORTCUTS = 'Escape'
const REVIEW_SEARCH_SHORTCUTS = '/ Control+K Meta+K Enter ArrowDown ArrowUp Escape'
const REVIEW_HELP_SHORTCUTS = 'Shift+/'
const REVIEW_SUGGESTED_ACTION_SHORTCUTS = 'Enter S'
const REVIEW_SELECT_SHORTCUTS = 'X Space'
const REVIEW_SELECT_ALL_VISIBLE_PENDING_SHORTCUTS = 'Shift+X'
const REVIEW_CLEAR_SELECTION_SHORTCUTS = 'C'
const REVIEW_APPROVE_SHORTCUTS = 'A'
const REVIEW_REJECT_SHORTCUTS = 'R'
const REVIEW_MERGE_SHORTCUTS = 'M'
const REVIEW_BULK_APPROVE_SHORTCUTS = 'Shift+A'
const REVIEW_BULK_REJECT_SHORTCUTS = 'Shift+R'
const REVIEW_BULK_MERGE_SHORTCUTS = 'Shift+M'
const REVIEW_COPY_CANDIDATE_HANDOFF_SHORTCUTS = 'Y'
const REVIEW_COPY_MERGE_HANDOFF_SHORTCUTS = 'Shift+Y'
const REVIEW_COPY_FAMILY_HANDOFF_SHORTCUTS = 'Shift+H'
const REVIEW_SELECT_PENDING_FAMILY_ROWS_SHORTCUTS = 'Shift+F'
const REVIEW_COPY_QUEUE_HANDOFF_SHORTCUTS = 'H'
const REVIEW_COPY_VIEW_SHORTCUTS = 'V'
const REVIEW_RESET_VIEW_SHORTCUTS = '0'
const REVIEW_PEEL_BACK_SHORTCUTS = 'Backspace'
const REVIEW_FAMILY_FOCUS_SHORTCUTS = 'F'
const REVIEW_PREVIOUS_VISIBLE_SHORTCUTS = 'K ArrowUp'
const REVIEW_NEXT_VISIBLE_SHORTCUTS = 'J ArrowDown'
const REVIEW_PREVIOUS_PENDING_SHORTCUTS = 'P'
const REVIEW_NEXT_PENDING_SHORTCUTS = 'N'
const REVIEW_LEAD_VISIBLE_SHORTCUTS = 'L'
const REVIEW_PREVIOUS_DUPLICATE_FAMILY_SHORTCUTS = '['
const REVIEW_NEXT_DUPLICATE_FAMILY_SHORTCUTS = ']'
const REVIEW_PREVIOUS_FAMILY_ROW_SHORTCUTS = ','
const REVIEW_NEXT_FAMILY_ROW_SHORTCUTS = '.'
const REVIEW_MERGE_TARGET_SHORTCUTS = "4 5 6 7 8 9 ArrowLeft ArrowRight ; '"
const REVIEW_MERGE_TARGET_HELP_ID = 'review-merge-target-help'
const REVIEW_FILTER_SELECT_SHORTCUTS = 'Escape'
const REVIEW_FILTER_SELECT_HELP_ID = 'review-filter-select-help'
const REVIEW_QUEUE_KEYBOARD_HELP_ID = 'review-queue-keyboard-help'
const REVIEW_QUEUE_NAVIGATION_SHORTCUTS = "J K ArrowDown ArrowUp N P L G Shift+G Home End PageDown PageUp Enter S X Space Escape F [ ] , . 4 5 6 7 8 9 ArrowLeft ArrowRight ; ' 1 2 3 O Shift+O Backspace 0 ?"

const REVIEW_SHORTCUT_GROUPS = [
  {
    title: 'Navigate the queue',
    shortcuts: [
      { keys: ['/', 'Focus search'], description: 'Jump into search and select the current query.' },
      { keys: ['⌘/Ctrl + K', 'Focus search'], description: 'Open search from anywhere in the queue without leaving the keyboard flow.' },
      { keys: ['↓ / ↑ from search', 'Enter queue'], description: 'Jump from the search box straight into the selected row, or the first or last visible result.' },
      { keys: ['Enter from search', 'Open lead + focus queue'], description: 'Open the lead search result and hand keyboard control straight back to the queue.' },
      { keys: ['Esc from search', 'Back to queue'], description: 'When the search is already empty, leave the field and return focus to the active queue row.' },
      {
        keys: ['Tab into a row', 'Sync selection'],
        description:
          'Selecting any checkbox or action button also makes that row the active keyboard context, and queue shortcuts keep working from those controls without stealing Enter or Space.',
      },
      { keys: ['j / ↓', 'Next visible'], description: 'Move to the next visible row in the current slice.' },
      { keys: ['k / ↑', 'Previous visible'], description: 'Move to the previous visible row.' },
      { keys: ['PageDown / PageUp', 'Jump 10 rows'], description: 'Leap through longer visible slices without mashing single-row navigation.' },
      { keys: ['g / Shift + g / Home / End', 'Queue edges'], description: 'Jump straight to the first or last visible row in the current slice.' },
      { keys: ['n', 'Next pending'], description: 'Skip to the next pending row.' },
      { keys: ['p', 'Previous pending'], description: 'Jump back to the previous pending row.' },
      { keys: ['l', 'Lead row'], description: 'Snap to the lead candidate in the current slice.' },
    ],
  },
  {
    title: 'Work duplicate families',
    shortcuts: [
      { keys: ['f', 'Family focus'], description: 'Toggle focus on the selected candidate family.' },
      { keys: ['Shift + f', 'Select pending family'], description: 'Add or remove every pending row in the selected family from the bulk set.' },
      { keys: ['[ / ]', 'Family hop'], description: 'Move to the previous or next pending family.' },
      { keys: [', / .', 'Family row'], description: 'Step through rows inside the current family.' },
      { keys: ['← / → or ; / \'' , 'Merge target'], description: 'Cycle the canonical merge target without leaving the keyboard.' },
      { keys: ['4 / 5 / 6 / 7 / 8 / 9', 'Pick target'], description: 'Jump straight to the top visible merge targets by rank when multiple drill matches are surfaced.' },
      { keys: ['Shift + h', 'Copy family notes'], description: 'Copy the current duplicate-family handoff scaffold without leaving the keyboard.' },
    ],
  },
  {
    title: 'Select and act',
    shortcuts: [
      { keys: ['x / Space', 'Toggle select'], description: 'Add or remove the selected row from the bulk set.' },
      { keys: ['c', 'Clear selection'], description: 'Clear the full bulk selection, including rows hidden by the current slice.' },
      { keys: ['a / r / m', 'Approve, reject, merge'], description: 'Run the primary action on the selected pending row.' },
      { keys: ['Enter / s', 'Suggested action'], description: 'Apply the queue recommendation for the selected row without leaving the keyboard.' },
      { keys: ['Shift + x', 'Select visible pending'], description: 'Select every visible pending row at once.' },
      { keys: ['Shift + a / r / m', 'Bulk act'], description: 'Approve, reject, or merge the bulk selection.' },
    ],
  },
  {
    title: 'Routing and cleanup',
    shortcuts: [
      { keys: ['1 / 2 / 3', 'Route jump'], description: 'Jump into the highest-value review route.' },
      { keys: ['o / Shift + o', 'Cycle sort'], description: 'Step through queue sort modes without leaving the keyboard or opening the sort dropdown.' },
      { keys: ['b / t / d / i / e / u', 'Focus current row context'], description: 'Toggle the selected row’s source batch, drill type, difficulty, AI recommendation, grade, or review status filter without leaving the keyboard.' },
      { keys: ['h', 'Copy queue handoff'], description: 'Copy the current review-slice handoff without leaving the keyboard.' },
      { keys: ['v', 'Copy view link'], description: 'Copy the current review queue URL, including any active filters or scoped review set.' },
      { keys: ['y / Shift + y', 'Copy handoff'], description: 'Copy the selected row or merge handoff summary.' },
      { keys: ['0', 'Reset view'], description: 'Snap the queue back to the default pending triage view and clear bulk selection in one move.' },
      { keys: ['Backspace', 'Peel back'], description: 'Clear bulk selection first, then peel back the most recent active view modifier.' },
      { keys: ['Esc', 'Dismiss, reset, or return'], description: 'Close help and hand focus back to the queue, dismiss feedback, jump back from detail-panel or row controls into the active queue row, or clear active modifiers when nothing else is in the way.' },
      { keys: ['?', 'Shortcut help'], description: 'Open or close this keyboard reference.' },
    ],
  },
] as const

type SortMode = 'triage' | 'pending-first' | 'duplicate-pressure' | 'completeness' | 'newest' | 'grade'
type AiDecisionFilter = 'all' | AiDecision | 'none'

const SORT_MODE_LABELS: Record<SortMode, string> = {
  triage: 'Best next triage',
  'pending-first': 'Pending first',
  'duplicate-pressure': 'Duplicate pressure',
  completeness: 'Most complete',
  newest: 'Newest first',
  grade: 'Grade order',
}

const SORT_MODE_SEQUENCE: SortMode[] = ['triage', 'pending-first', 'duplicate-pressure', 'completeness', 'newest', 'grade']

type TriageLevel = 'act-now' | 'worth-a-look' | 'low-signal' | 'already-reviewed'
type CompletenessBand = 'thin' | 'usable' | 'rich'
type SuggestedActionFilter = 'all' | FamilyDecision
type DuplicateShapeFilter = 'all' | 'solo' | 'pair' | 'small-family' | 'large-family'
type ReviewRouteKey = 'approve-ready' | 'merge-sweep' | 'thin-cleanup'

const DUPLICATE_SHAPE_LABELS: Record<DuplicateShapeFilter, string> = {
  all: 'All family shapes',
  solo: 'Solo rows',
  pair: 'Pairs',
  'small-family': 'Small families',
  'large-family': 'Large families',
}

const COMPLETENESS_BAND_LABELS: Record<CompletenessBand, string> = {
  thin: 'Thin extract',
  usable: 'Usable extract',
  rich: 'Rich extract',
}

type CandidateInsight = {
  familySize: number
  stepsCount: number
  focusPointsCount: number
  mistakesCount: number
  completenessScore: number
  completenessLabel: string
  triageLevel: TriageLevel
  triageScore: number
  triageSummary: string
}

type FamilyDecision = 'keep' | 'merge' | 'reject'
type ReviewMutationAction = 'approve' | 'reject' | 'merge'

const REVIEW_ACTION_STATUS: Record<ReviewMutationAction, ReviewStatus> = {
  approve: 'approved',
  reject: 'rejected',
  merge: 'merged',
}

type DrillMatch = Pick<
  Drill,
  'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
> & {
  matchScore: number
  matchReasons: string[]
}

type ActiveViewChip = {
  key: string
  label: string
  clearLabel: string
  onClear: () => void
}

function getAiDecisionTone(decision: AiDecision | null) {
  switch (decision) {
    case 'approve':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merge':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'reject':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
    case 'review':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
  }
}

function getAiDecisionLabel(decision: AiDecision | null) {
  switch (decision) {
    case 'approve':
      return 'AI approve'
    case 'merge':
      return 'AI merge'
    case 'reject':
      return 'AI reject'
    case 'review':
      return 'AI review'
    default:
      return 'No AI triage yet'
  }
}

function getAiDecisionFilterValue(decision: AiDecision | null): Exclude<AiDecisionFilter, 'all'> {
  return decision ?? 'none'
}

function isAiDecisionFilter(value: string | null): value is AiDecisionFilter {
  return value === 'all' || value === 'approve' || value === 'merge' || value === 'review' || value === 'reject' || value === 'none'
}

function getAiDecisionFilterLabel(value: AiDecisionFilter) {
  return value === 'all' ? 'All AI recommendations' : getAiDecisionLabel(value === 'none' ? null : value)
}

function formatGradeLevel(value: string | null) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatDifficultyLabel(value: string | null) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function countJsonItems(value: Json | null) {
  return Array.isArray(value) ? value.length : 0
}

function jsonToStringList(value: Json | null) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  const year = date.getUTCFullYear()
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')

  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`
}

function getScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function getSourceLabel(candidate: RawDrillCandidate) {
  return candidate.source_file || candidate.source_type || 'Unknown source'
}

function getDisplayTitle(candidate: RawDrillCandidate) {
  return candidate.cleaned_title || candidate.raw_title || 'Untitled candidate'
}

function getShortSummary(candidate: RawDrillCandidate) {
  return candidate.summary || candidate.what_it_trains || candidate.description || 'No summary yet.'
}

function getCandidateSearchText(candidate: RawDrillCandidate) {
  return [
    candidate.cleaned_title,
    candidate.raw_title,
    candidate.summary,
    candidate.description,
    candidate.what_it_trains,
    candidate.when_to_assign,
    candidate.review_notes,
    candidate.coach_demo_quote,
    candidate.dedupe_key,
    candidate.source_file,
    candidate.source_type,
    candidate.category,
    candidate.difficulty,
    candidate.grade_level,
    ...(candidate.skill_tags ?? []),
    ...(candidate.tags ?? []),
    ...jsonToStringList(candidate.steps_json),
    ...jsonToStringList(candidate.focus_points_json),
    ...jsonToStringList(candidate.common_mistakes_json),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getCandidateDecisionHint(candidate: RawDrillCandidate, insight: CandidateInsight): FamilyDecision {
  if (candidate.review_status === 'rejected') return 'reject'
  if (candidate.review_status === 'merged') return 'merge'
  if (candidate.review_status === 'approved') return 'keep'
  if (candidate.canonical_drill_id) return 'merge'
  if (insight.familySize >= 2 && insight.completenessScore >= 4 && insight.triageScore >= 4) return 'keep'
  if (insight.familySize >= 2 && insight.completenessScore <= 2) return 'reject'
  if (insight.familySize >= 2) return 'merge'
  return insight.completenessScore >= 4 ? 'keep' : 'reject'
}

function getDecisionTone(decision: FamilyDecision) {
  switch (decision) {
    case 'keep':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merge':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'reject':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
  }
}

function getDecisionLabel(decision: FamilyDecision) {
  switch (decision) {
    case 'keep':
      return 'Keep as canonical seed'
    case 'merge':
      return 'Merge into family winner'
    case 'reject':
      return 'Reject as duplicate/noisy'
  }
}

function getSuggestedActionShortcutLabel(decision: FamilyDecision) {
  switch (decision) {
    case 'keep':
      return 'Approve candidate'
    case 'merge':
      return 'Merge candidate'
    case 'reject':
      return 'Reject candidate'
  }
}

function getSuggestedActionShortcutHint(decision: FamilyDecision, hasMergeTarget: boolean) {
  switch (decision) {
    case 'keep':
      return 'Shortcut Enter or S, uses the queue recommendation and advances selection.'
    case 'merge':
      return hasMergeTarget
        ? 'Shortcut Enter or S, uses the queue recommendation and the selected merge target.'
        : 'Shortcut Enter or S, select a merge target first.'
    case 'reject':
      return 'Shortcut Enter or S, uses the queue recommendation and advances selection.'
  }
}

function getMergeTargetShortcutKey(index: number) {
  return MERGE_TARGET_SHORTCUT_KEYS[index] ?? null
}

function isSuggestedActionFilter(value: string | null): value is SuggestedActionFilter {
  return value === 'all' || value === 'keep' || value === 'merge' || value === 'reject'
}

function getSuggestedActionFilterLabel(value: SuggestedActionFilter) {
  return value === 'all' ? 'All suggested actions' : getDecisionLabel(value)
}

function getDuplicateShape(familySize: number): Exclude<DuplicateShapeFilter, 'all'> {
  if (familySize <= 1) return 'solo'
  if (familySize === 2) return 'pair'
  if (familySize <= 4) return 'small-family'
  return 'large-family'
}

function isDuplicateShapeFilter(value: string | null): value is DuplicateShapeFilter {
  return value === 'all' || value === 'solo' || value === 'pair' || value === 'small-family' || value === 'large-family'
}

function getCandidateReadinessGaps(candidate: RawDrillCandidate, insight: CandidateInsight) {
  const gaps: string[] = []

  if (!candidate.summary && !candidate.what_it_trains && !candidate.description) {
    gaps.push('Needs a usable summary or training note')
  }

  if (insight.stepsCount === 0) {
    gaps.push('No steps extracted yet')
  }

  if (insight.focusPointsCount === 0) {
    gaps.push('No focus points extracted yet')
  }

  if (!candidate.grade_level) {
    gaps.push('Missing grade tag')
  }

  if (!candidate.category) {
    gaps.push('Missing category')
  }

  return gaps
}

function getSuggestedActionLabelForHandoff(candidate: RawDrillCandidate, insight: CandidateInsight) {
  if (candidate.review_status !== 'pending') {
    return `Already ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()} (reference only, no pending action)`
  }

  return getDecisionLabel(getCandidateDecisionHint(candidate, insight))
}

function getReviewerNextMove(candidate: RawDrillCandidate, insight: CandidateInsight) {
  if (candidate.review_status !== 'pending') {
    return `Leave this row as-is unless a reviewer is double-checking the earlier ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()} decision.`
  }

  const decision = getCandidateDecisionHint(candidate, insight)
  const gaps = getCandidateReadinessGaps(candidate, insight)

  if (decision === 'keep') {
    return gaps.length === 0
      ? 'Strong candidate, use this as the canonical starting point.'
      : `Likely canonical seed, but patch ${gaps[0].toLowerCase()} first.`
  }

  if (decision === 'merge') {
    return candidate.canonical_drill_id
      ? 'Already points at a canonical drill, review as supporting merge material.'
      : 'Compare against the best family row or likely library match, then fold over only the useful bits.'
  }

  return gaps.length === 0
    ? 'Probably reject, unless a reviewer spots unique coaching value in the wording.'
    : `Probably reject. Main issue: ${gaps[0].toLowerCase()}.`
}

function formatReadinessGapsForHandoff(candidate: RawDrillCandidate, insight: CandidateInsight) {
  const gaps = getCandidateReadinessGaps(candidate, insight)
  return gaps.length > 0 ? gaps.join(' • ') : 'No obvious readiness gaps surfaced'
}

function getStatusTone(status: ReviewStatus) {
  switch (status) {
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merged':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
  }
}

function getTriageTone(level: TriageLevel) {
  switch (level) {
    case 'act-now':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
    case 'worth-a-look':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
    case 'low-signal':
      return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
    case 'already-reviewed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
  }
}

function getTriageLabel(level: TriageLevel) {
  switch (level) {
    case 'act-now':
      return 'Act now'
    case 'worth-a-look':
      return 'Worth a look'
    case 'low-signal':
      return 'Low signal'
    case 'already-reviewed':
      return 'Already reviewed'
  }
}

function getCompletenessBand(insight: CandidateInsight): CompletenessBand {
  if (insight.completenessScore >= 5) return 'rich'
  if (insight.completenessScore >= 3) return 'usable'
  return 'thin'
}

function getGradeSortValue(value: string | null) {
  switch (value) {
    case 'grade_1':
      return 1
    case 'grade_2':
      return 2
    case 'grade_3':
      return 3
    default:
      return 99
  }
}

function getReviewRouteTone(route: ReviewRouteKey) {
  switch (route) {
    case 'approve-ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merge-sweep':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'thin-cleanup':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
  }
}

function getNextReviewSelection(candidateIds: string[], orderedCandidateIds: string[], currentSelectedId: string | null) {
  if (orderedCandidateIds.length === 0) return null

  const removedIds = new Set(candidateIds)
  const anchorId = currentSelectedId && removedIds.has(currentSelectedId) ? currentSelectedId : candidateIds[0]
  const anchorIndex = orderedCandidateIds.findIndex((id) => id === anchorId)

  if (anchorIndex === -1) {
    return orderedCandidateIds.find((id) => !removedIds.has(id)) ?? null
  }

  for (let index = anchorIndex + 1; index < orderedCandidateIds.length; index += 1) {
    if (!removedIds.has(orderedCandidateIds[index])) return orderedCandidateIds[index]
  }

  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    if (!removedIds.has(orderedCandidateIds[index])) return orderedCandidateIds[index]
  }

  return null
}

function getNextPendingReviewSelection(
  candidateIds: string[],
  pendingCandidateIds: string[],
  orderedCandidateIds: string[],
  currentSelectedId: string | null
) {
  return (
    getNextReviewSelection(candidateIds, pendingCandidateIds, currentSelectedId) ??
    getNextReviewSelection(candidateIds, orderedCandidateIds, currentSelectedId)
  )
}

function isMergeTargetActionError(message: string | null) {
  return message === 'Pick a merge target first.' || message === 'Pick a merge target first. This row has multiple plausible library matches.'
}

function getAdjacentPendingDuplicateFamily<T extends { dedupeKey: string; statuses: ReviewStatus[] }>(
  duplicateFamilies: T[],
  currentFamilyKey: string | null,
  direction: 'next' | 'previous'
) {
  if (duplicateFamilies.length === 0) return null

  const pendingFamilies = duplicateFamilies.filter((family) => family.statuses.includes('pending'))
  if (pendingFamilies.length === 0) return null

  if (!currentFamilyKey) {
    return direction === 'next' ? pendingFamilies[0] ?? null : pendingFamilies[pendingFamilies.length - 1] ?? null
  }

  const currentIndex = duplicateFamilies.findIndex((family) => family.dedupeKey === currentFamilyKey)
  if (currentIndex === -1) {
    return direction === 'next' ? pendingFamilies[0] ?? null : pendingFamilies[pendingFamilies.length - 1] ?? null
  }

  const orderedFamilies =
    direction === 'next'
      ? [...duplicateFamilies.slice(currentIndex + 1), ...duplicateFamilies.slice(0, currentIndex)]
      : [...duplicateFamilies.slice(0, currentIndex).reverse(), ...duplicateFamilies.slice(currentIndex + 1).reverse()]

  return orderedFamilies.find((family) => family.statuses.includes('pending')) ?? null
}

function getAdjacentCandidate<T extends { id: string }>(candidates: T[], currentCandidateId: string | null, direction: 'next' | 'previous') {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0] ?? null

  const currentIndex = currentCandidateId ? candidates.findIndex((candidate) => candidate.id === currentCandidateId) : -1

  if (currentIndex === -1) {
    return direction === 'next' ? candidates[0] ?? null : candidates[candidates.length - 1] ?? null
  }

  if (direction === 'next') {
    return candidates[(currentIndex + 1) % candidates.length] ?? null
  }

  return candidates[(currentIndex - 1 + candidates.length) % candidates.length] ?? null
}

function getOffsetCandidate<T extends { id: string }>(candidates: T[], currentCandidateId: string | null, offset: number) {
  if (candidates.length === 0) return null
  if (candidates.length === 1 || offset === 0) return candidates[0] ?? null

  const currentIndex = currentCandidateId ? candidates.findIndex((candidate) => candidate.id === currentCandidateId) : -1

  if (currentIndex === -1) {
    return offset > 0 ? candidates[0] ?? null : candidates[candidates.length - 1] ?? null
  }

  const nextIndex = Math.min(candidates.length - 1, Math.max(0, currentIndex + offset))
  return candidates[nextIndex] ?? null
}

function getCandidateIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null

  const candidateRow = target.closest<HTMLElement>('article[id^="candidate-"]')
  const candidateId = candidateRow?.id.replace(/^candidate-/, '') ?? null
  return candidateId || null
}

function getShortcutTargetContext(target: EventTarget | null): 'none' | 'text-entry' | 'row-control' | 'interactive' {
  if (!(target instanceof HTMLElement)) return 'none'

  if (target.isContentEditable || target.closest('textarea, select, [contenteditable="true"]')) {
    return 'text-entry'
  }

  const input = target.closest('input')
  if (input instanceof HTMLInputElement) {
    return input.type === 'checkbox' || input.type === 'radio' ? 'row-control' : 'text-entry'
  }

  const rowControl = target.closest('article[id^="candidate-"] button, article[id^="candidate-"] a, article[id^="candidate-"] [role="button"], article[id^="candidate-"] [role="link"]')
  if (rowControl) {
    return 'row-control'
  }

  const interactiveParent = target.closest('button, a, [role="button"], [role="link"]')
  return interactiveParent ? 'interactive' : 'none'
}

function normaliseTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
}

function getOverlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right)
  return left.filter((token) => rightSet.has(token)).length
}

function scoreDrillMatch(
  candidate: RawDrillCandidate,
  drill: Pick<
    Drill,
    'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
  >
): DrillMatch | null {
  let matchScore = 0
  const matchReasons: string[] = []

  if (candidate.canonical_drill_id && candidate.canonical_drill_id === drill.id) {
    matchScore += 10
    matchReasons.push('already linked as canonical')
  }

  if (drill.raw_candidate_ids.includes(candidate.id)) {
    matchScore += 8
    matchReasons.push('already references this raw candidate')
  }

  if (candidate.grade_level && candidate.grade_level === drill.grade_level) {
    matchScore += 2
    matchReasons.push(`same ${formatGradeLevel(candidate.grade_level)} tag`)
  }

  if (candidate.category && candidate.category === drill.category) {
    matchScore += 2
    matchReasons.push('same category')
  }

  if (candidate.difficulty === drill.difficulty) {
    matchScore += 1
    matchReasons.push('same difficulty')
  }

  const candidateTitleTokens = normaliseTokens(`${candidate.cleaned_title || ''} ${candidate.raw_title || ''}`)
  const drillTitleTokens = normaliseTokens(drill.title)
  const titleOverlap = getOverlapCount(candidateTitleTokens, drillTitleTokens)

  if (titleOverlap >= 2) {
    matchScore += 4
    matchReasons.push(`title overlap (${titleOverlap})`)
  } else if (titleOverlap === 1) {
    matchScore += 1
    matchReasons.push('light title overlap')
  }

  const candidateTagTokens = Array.from(new Set([...(candidate.skill_tags ?? []), ...(candidate.tags ?? [])].map((item) => item.toLowerCase())))
  const drillTagTokens = Array.from(new Set([...(drill.skill_tags ?? []), ...(drill.tags ?? [])].map((item) => item.toLowerCase())))
  const tagOverlap = getOverlapCount(candidateTagTokens, drillTagTokens)

  if (tagOverlap >= 2) {
    matchScore += 3
    matchReasons.push(`tag overlap (${tagOverlap})`)
  } else if (tagOverlap === 1) {
    matchScore += 1
    matchReasons.push('shared tag')
  }

  if (matchScore <= 0) return null

  return {
    ...drill,
    matchScore,
    matchReasons,
  }
}

function getCreatedAtTimestamp(value: string | null) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function compareCandidatesForSortMode(
  left: RawDrillCandidate,
  right: RawDrillCandidate,
  candidateInsights: Map<string, CandidateInsight>,
  sortMode: SortMode
) {
  const leftInsight = candidateInsights.get(left.id)
  const rightInsight = candidateInsights.get(right.id)
  const leftCreatedAt = getCreatedAtTimestamp(left.created_at)
  const rightCreatedAt = getCreatedAtTimestamp(right.created_at)
  const leftTitle = getDisplayTitle(left)
  const rightTitle = getDisplayTitle(right)

  if (!leftInsight || !rightInsight) {
    return leftTitle.localeCompare(rightTitle)
  }

  switch (sortMode) {
    case 'triage':
      return (
        rightInsight.triageScore - leftInsight.triageScore ||
        STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
        rightInsight.familySize - leftInsight.familySize ||
        rightCreatedAt - leftCreatedAt ||
        leftTitle.localeCompare(rightTitle)
      )
    case 'pending-first':
      return (
        STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
        rightCreatedAt - leftCreatedAt ||
        rightInsight.familySize - leftInsight.familySize ||
        leftTitle.localeCompare(rightTitle)
      )
    case 'duplicate-pressure':
      return (
        rightInsight.familySize - leftInsight.familySize ||
        STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
        rightInsight.triageScore - leftInsight.triageScore ||
        leftTitle.localeCompare(rightTitle)
      )
    case 'completeness':
      return (
        rightInsight.completenessScore - leftInsight.completenessScore ||
        rightInsight.familySize - leftInsight.familySize ||
        STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
        leftTitle.localeCompare(rightTitle)
      )
    case 'newest':
      return rightCreatedAt - leftCreatedAt || rightInsight.triageScore - leftInsight.triageScore || leftTitle.localeCompare(rightTitle)
    case 'grade':
      return (
        getGradeSortValue(left.grade_level) - getGradeSortValue(right.grade_level) ||
        STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
        rightInsight.triageScore - leftInsight.triageScore ||
        leftTitle.localeCompare(rightTitle)
      )
  }
}

function buildCandidateInsight(candidate: RawDrillCandidate, familySize: number): CandidateInsight {
  const stepsCount = countJsonItems(candidate.steps_json)
  const focusPointsCount = countJsonItems(candidate.focus_points_json)
  const mistakesCount = countJsonItems(candidate.common_mistakes_json)
  const hasSummaryLike = Boolean(candidate.summary || candidate.what_it_trains || candidate.description)
  const completenessScore = [
    hasSummaryLike,
    stepsCount > 0,
    focusPointsCount > 0,
    mistakesCount > 0,
    Boolean(candidate.coach_demo_quote),
    Boolean(candidate.when_to_assign),
  ].filter(Boolean).length

  const completenessLabel =
    completenessScore >= 5 ? 'Rich extract' : completenessScore >= 3 ? 'Usable extract' : 'Thin extract'

  if (candidate.review_status !== 'pending') {
    return {
      familySize,
      stepsCount,
      focusPointsCount,
      mistakesCount,
      completenessScore,
      completenessLabel,
      triageLevel: 'already-reviewed',
      triageScore: -100 + completenessScore,
      triageSummary: `Already ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()}, so it is not the next triage target.`,
    }
  }

  let triageScore = 0
  const strengths: string[] = []
  const cautions: string[] = []

  if (familySize >= 5) {
    triageScore += 5
    strengths.push(`${familySize} rows in this duplicate family`)
  } else if (familySize >= 3) {
    triageScore += 3
    strengths.push(`${familySize} rows share this family`)
  } else if (familySize === 1) {
    triageScore -= 1
    cautions.push('isolated row')
  }

  if (candidate.canonical_drill_id) {
    triageScore += 3
    strengths.push('already linked to a canonical drill')
  }

  if (completenessScore >= 5) {
    triageScore += 3
    strengths.push(`${completenessScore}/6 extraction coverage`)
  } else if (completenessScore >= 3) {
    triageScore += 1
    strengths.push(`${completenessScore}/6 extraction coverage`)
  } else {
    triageScore -= 3
    cautions.push('thin extraction')
  }

  if (!hasSummaryLike) {
    triageScore -= 2
    cautions.push('missing summary')
  }

  if (!candidate.grade_level) {
    triageScore -= 1
    cautions.push('no grade yet')
  }

  if (familySize >= 3 && completenessScore >= 4) {
    triageScore += 2
  }

  if (triageScore >= 7) {
    return {
      familySize,
      stepsCount,
      focusPointsCount,
      mistakesCount,
      completenessScore,
      completenessLabel,
      triageLevel: 'act-now',
      triageScore,
      triageSummary: `Why now: ${(strengths.length > 0 ? strengths : ['clear duplicate pressure']).slice(0, 2).join(', ')}.`,
    }
  }

  if (triageScore >= 3) {
    const balancedReasons = [strengths[0], cautions[0]].filter(Boolean)

    return {
      familySize,
      stepsCount,
      focusPointsCount,
      mistakesCount,
      completenessScore,
      completenessLabel,
      triageLevel: 'worth-a-look',
      triageScore,
      triageSummary: `Useful next: ${(balancedReasons.length > 0 ? balancedReasons : ['some structure is present']).slice(0, 2).join(', ')}.`,
    }
  }

  return {
    familySize,
    stepsCount,
    focusPointsCount,
    mistakesCount,
    completenessScore,
    completenessLabel,
    triageLevel: 'low-signal',
    triageScore,
    triageSummary: `Low signal: ${(cautions.length > 0 ? cautions : ['not much extracted yet']).slice(0, 3).join(', ')}.`,
  }
}

function EmptyState({
  title,
  body,
  footer,
}: {
  title: string
  body: string
  footer?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      {footer ? <div className="mt-5">{footer}</div> : null}
    </div>
  )
}

export function ReviewQueueClient({
  candidates,
  drills,
}: {
  candidates: RawDrillCandidate[]
  drills: Pick<
    Drill,
    'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
  >[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedCandidateFromUrl = searchParams.get('selected')
  const returnToLibraryHref = useMemo(() => {
    const value = searchParams.get('from')
    if (!value || !value.startsWith('/drills')) return null
    return value
  }, [searchParams])
  const scopedCandidateIds = useMemo(() => {
    const rawIds = searchParams.get('ids')
    if (!rawIds) return null

    const ids = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    return ids.length > 0 ? Array.from(new Set(ids)) : null
  }, [searchParams])
  const scopeRequestedCount = scopedCandidateIds?.length ?? 0
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>(() => {
    const value = searchParams.get('status')
    return value === 'all' || REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as 'all' | ReviewStatus) || 'pending' : 'pending'
  })
  const [gradeFilter, setGradeFilter] = useState<'all' | string>(() => searchParams.get('grade') ?? 'all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | string>(() => searchParams.get('difficulty') ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>(() => searchParams.get('category') ?? 'all')
  const [sourceFilter, setSourceFilter] = useState<'all' | string>(() => searchParams.get('source') ?? 'all')
  const [aiDecisionFilter, setAiDecisionFilter] = useState<AiDecisionFilter>(() => {
    const value = searchParams.get('ai')
    return isAiDecisionFilter(value) ? value : 'all'
  })
  const [triageFilter, setTriageFilter] = useState<'all' | TriageLevel>(() => {
    const value = searchParams.get('triage')
    return value === 'all' || value === 'act-now' || value === 'worth-a-look' || value === 'low-signal' || value === 'already-reviewed'
      ? ((value as 'all' | TriageLevel) ?? 'all')
      : 'all'
  })
  const [completenessFilter, setCompletenessFilter] = useState<'all' | CompletenessBand>(() => {
    const value = searchParams.get('completeness')
    return value === 'all' || value === 'thin' || value === 'usable' || value === 'rich' ? ((value as 'all' | CompletenessBand) ?? 'all') : 'all'
  })
  const [suggestedActionFilter, setSuggestedActionFilter] = useState<SuggestedActionFilter>(() => {
    const value = searchParams.get('action')
    return isSuggestedActionFilter(value) ? value : 'all'
  })
  const [familyShapeFilter, setFamilyShapeFilter] = useState<DuplicateShapeFilter>(() => {
    const value = searchParams.get('familyShape')
    return isDuplicateShapeFilter(value) ? value : 'all'
  })
  const [familyFilter, setFamilyFilter] = useState<string | null>(() => {
    const value = searchParams.get('family')
    return value?.trim() ? value : null
  })
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const value = searchParams.get('sort')
    return value && value in SORT_MODE_LABELS ? (value as SortMode) : 'triage'
  })
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => searchParams.get('selected') ?? candidates[0]?.id ?? null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [selectedCanonicalDrillId, setSelectedCanonicalDrillId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const bulkMergeTargetSelectRef = useRef<HTMLSelectElement | null>(null)
  const detailMergeTargetSelectRef = useRef<HTMLSelectElement | null>(null)
  const copyFeedbackTimeoutRef = useRef<number | null>(null)
  const actionErrorRef = useRef<HTMLDivElement | null>(null)
  const shortcutHelpDialogRef = useRef<HTMLDivElement | null>(null)
  const shortcutHelpCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const shortcutHelpTriggerRef = useRef<HTMLElement | null>(null)

  const cycleSortMode = useCallback((direction: 'next' | 'previous') => {
    setSortMode((current) => {
      const currentIndex = SORT_MODE_SEQUENCE.indexOf(current)
      const resolvedIndex = currentIndex === -1 ? 0 : currentIndex
      const offset = direction === 'next' ? 1 : -1
      return SORT_MODE_SEQUENCE[(resolvedIndex + offset + SORT_MODE_SEQUENCE.length) % SORT_MODE_SEQUENCE.length]
    })
  }, [])
  const detailPanelRef = useRef<HTMLElement | null>(null)
  const shouldScrollSelectedCandidateIntoViewRef = useRef(false)
  const shouldFocusSelectedCandidateRowRef = useRef(false)

  useEffect(() => {
    const nextQuery = searchParams.get('q') ?? ''
    const nextStatus = searchParams.get('status')
    const nextGrade = searchParams.get('grade') ?? 'all'
    const nextDifficulty = searchParams.get('difficulty') ?? 'all'
    const nextCategory = searchParams.get('category') ?? 'all'
    const nextSource = searchParams.get('source') ?? 'all'
    const nextAiDecision = searchParams.get('ai')
    const nextTriage = searchParams.get('triage')
    const nextCompleteness = searchParams.get('completeness')
    const nextSuggestedAction = searchParams.get('action')
    const nextFamilyShape = searchParams.get('familyShape')
    const nextFamily = searchParams.get('family')
    const nextSort = searchParams.get('sort')
    const nextSelected = searchParams.get('selected')

    setQuery((current) => (current === nextQuery ? current : nextQuery))
    setStatusFilter((current) => {
      const resolved = nextStatus === 'all' || REVIEW_STATUSES.includes(nextStatus as ReviewStatus) ? (nextStatus as 'all' | ReviewStatus) || 'pending' : 'pending'
      return current === resolved ? current : resolved
    })
    setGradeFilter((current) => (current === nextGrade ? current : nextGrade))
    setDifficultyFilter((current) => (current === nextDifficulty ? current : nextDifficulty))
    setCategoryFilter((current) => (current === nextCategory ? current : nextCategory))
    setSourceFilter((current) => (current === nextSource ? current : nextSource))
    setAiDecisionFilter((current) => {
      const resolved = isAiDecisionFilter(nextAiDecision) ? nextAiDecision : 'all'
      return current === resolved ? current : resolved
    })
    setTriageFilter((current) => {
      const resolved =
        nextTriage === 'all' || nextTriage === 'act-now' || nextTriage === 'worth-a-look' || nextTriage === 'low-signal' || nextTriage === 'already-reviewed'
          ? ((nextTriage as 'all' | TriageLevel) ?? 'all')
          : 'all'
      return current === resolved ? current : resolved
    })
    setCompletenessFilter((current) => {
      const resolved =
        nextCompleteness === 'all' || nextCompleteness === 'thin' || nextCompleteness === 'usable' || nextCompleteness === 'rich'
          ? ((nextCompleteness as 'all' | CompletenessBand) ?? 'all')
          : 'all'
      return current === resolved ? current : resolved
    })
    setSuggestedActionFilter((current) => {
      const resolved = isSuggestedActionFilter(nextSuggestedAction) ? nextSuggestedAction : 'all'
      return current === resolved ? current : resolved
    })
    setFamilyShapeFilter((current) => {
      const resolved = isDuplicateShapeFilter(nextFamilyShape) ? nextFamilyShape : 'all'
      return current === resolved ? current : resolved
    })
    setFamilyFilter((current) => {
      const resolved = nextFamily?.trim() ? nextFamily : null
      return current === resolved ? current : resolved
    })
    setSortMode((current) => {
      const resolved = nextSort && nextSort in SORT_MODE_LABELS ? (nextSort as SortMode) : 'triage'
      return current === resolved ? current : resolved
    })
    setSelectedCandidateId((current) => {
      const resolved = nextSelected ?? candidates[0]?.id ?? null
      return current === resolved ? current : resolved
    })
  }, [candidates, searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (query.trim()) nextParams.set('q', query)
    else nextParams.delete('q')

    if (statusFilter !== 'pending') nextParams.set('status', statusFilter)
    else nextParams.delete('status')

    if (gradeFilter !== 'all') nextParams.set('grade', gradeFilter)
    else nextParams.delete('grade')

    if (difficultyFilter !== 'all') nextParams.set('difficulty', difficultyFilter)
    else nextParams.delete('difficulty')

    if (categoryFilter !== 'all') nextParams.set('category', categoryFilter)
    else nextParams.delete('category')

    if (sourceFilter !== 'all') nextParams.set('source', sourceFilter)
    else nextParams.delete('source')

    if (aiDecisionFilter !== 'all') nextParams.set('ai', aiDecisionFilter)
    else nextParams.delete('ai')

    if (triageFilter !== 'all') nextParams.set('triage', triageFilter)
    else nextParams.delete('triage')

    if (completenessFilter !== 'all') nextParams.set('completeness', completenessFilter)
    else nextParams.delete('completeness')

    if (suggestedActionFilter !== 'all') nextParams.set('action', suggestedActionFilter)
    else nextParams.delete('action')

    if (familyShapeFilter !== 'all') nextParams.set('familyShape', familyShapeFilter)
    else nextParams.delete('familyShape')

    if (familyFilter) nextParams.set('family', familyFilter)
    else nextParams.delete('family')

    if (sortMode !== 'triage') nextParams.set('sort', sortMode)
    else nextParams.delete('sort')

    if (selectedCandidateId) nextParams.set('selected', selectedCandidateId)
    else nextParams.delete('selected')

    const current = searchParams.toString()
    const next = nextParams.toString()

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [aiDecisionFilter, categoryFilter, completenessFilter, suggestedActionFilter, difficultyFilter, familyShapeFilter, sourceFilter, triageFilter, familyFilter, gradeFilter, pathname, query, router, searchParams, selectedCandidateId, sortMode, statusFilter])

  const fallbackCopyText = useCallback((value: string) => {
    if (typeof document === 'undefined') return false

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'

    document.body.appendChild(textarea)

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selection = document.getSelection()
    const originalRanges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : []

    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    let didCopy = false

    try {
      didCopy = document.execCommand('copy')
    } catch {
      didCopy = false
    }

    document.body.removeChild(textarea)

    if (selection) {
      selection.removeAllRanges()
      originalRanges.forEach((range) => selection.addRange(range))
    }

    if (activeElement?.isConnected) {
      activeElement.focus({ preventScroll: true })
    }

    return didCopy
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!actionError || typeof window === 'undefined') return

    const frame = window.requestAnimationFrame(() => {
      actionErrorRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [actionError])

  const scheduleCopyFeedbackClear = useCallback(() => {
    if (typeof window === 'undefined') return

    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current)
    }

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopyFeedback(null)
      copyFeedbackTimeoutRef.current = null
    }, 3000)
  }, [])

  const copyText = useCallback(async (value: string, label: string) => {
    if (typeof window === 'undefined') return

    let didCopy = false

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value)
        didCopy = true
      } catch {
        didCopy = false
      }
    }

    if (!didCopy) {
      didCopy = fallbackCopyText(value)
    }

    setCopyFeedback(didCopy ? label : 'Copy failed, try again.')
    scheduleCopyFeedbackClear()
  }, [fallbackCopyText, scheduleCopyFeedbackClear])

  const focusCandidateRow = useCallback((candidateId: string, options?: { reveal?: boolean }) => {
    if (typeof document === 'undefined') return

    const row = document.getElementById(`candidate-${candidateId}`)
    if (!(row instanceof HTMLElement)) return

    if (options?.reveal) {
      row.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
    }

    row.focus({ preventScroll: !options?.reveal })
  }, [])

  const handleSelectEscape = useCallback((event: ReactKeyboardEvent<HTMLSelectElement>) => {
    if (event.key !== 'Escape' || typeof document === 'undefined') return

    const queueCandidateId =
      (selectedCandidateFromUrl ? document.getElementById(`candidate-${selectedCandidateFromUrl}`)?.id.replace(/^candidate-/, '') : null) ??
      (selectedCandidateId ? document.getElementById(`candidate-${selectedCandidateId}`)?.id.replace(/^candidate-/, '') : null) ??
      document.querySelector<HTMLElement>('article[id^="candidate-"]')?.id.replace(/^candidate-/, '') ??
      null
    if (!queueCandidateId) return

    event.preventDefault()
    event.stopPropagation()
    focusCandidateRow(queueCandidateId, { reveal: true })
  }, [focusCandidateRow, selectedCandidateFromUrl, selectedCandidateId])

  const focusPreferredMergeTargetSelect = useCallback(() => {
    if (typeof window === 'undefined') return

    const target = detailMergeTargetSelectRef.current ?? bulkMergeTargetSelectRef.current
    if (!target) return

    const shouldReveal = window.matchMedia('(max-width: 1279px)').matches
    if (shouldReveal) {
      target.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
    }

    window.requestAnimationFrame(() => {
      target.focus({ preventScroll: shouldReveal ? false : target === detailMergeTargetSelectRef.current })
    })
  }, [])

  useEffect(() => {
    if (!showShortcutHelp || typeof document === 'undefined') {
      return
    }

    const { body } = document
    const previousBodyOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousBodyOverflow
    }
  }, [showShortcutHelp])

  useEffect(() => {
    if (!showShortcutHelp || typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    shortcutHelpTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const frame = window.requestAnimationFrame(() => {
      shortcutHelpCloseButtonRef.current?.focus()
    })

    const handleShortcutHelpTabTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const dialog = shortcutHelpDialogRef.current
      if (!dialog) return

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')

      if (focusableElements.length === 0) {
        event.preventDefault()
        shortcutHelpCloseButtonRef.current?.focus()
        return
      }

      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (event.shiftKey) {
        if (!activeElement || activeElement === firstFocusable || !dialog.contains(activeElement)) {
          event.preventDefault()
          lastFocusable.focus()
        }
        return
      }

      if (!activeElement || activeElement === lastFocusable || !dialog.contains(activeElement)) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleShortcutHelpTabTrap)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleShortcutHelpTabTrap)
    }
  }, [showShortcutHelp])

  useEffect(() => {
    if (showShortcutHelp || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const previousFocusTarget = shortcutHelpTriggerRef.current
    if (!previousFocusTarget) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (previousFocusTarget.isConnected) {
        previousFocusTarget.focus()
        return
      }

      const fallbackCandidateId = selectedCandidateId ?? candidates[0]?.id ?? null
      if (fallbackCandidateId) {
        focusCandidateRow(fallbackCandidateId)
      }
    })

    shortcutHelpTriggerRef.current = null

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [candidates, focusCandidateRow, selectedCandidateId, showShortcutHelp])

  const selectCandidate = useCallback((candidateId: string, options?: { scrollIntoView?: boolean; revealInQueue?: boolean }) => {
    setSelectedCandidateId(candidateId)

    if (typeof document === 'undefined') {
      return
    }

    if (options?.revealInQueue) {
      document.getElementById(`candidate-${candidateId}`)?.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
      return
    }

    if (options?.scrollIntoView === false) {
      return
    }

    document.getElementById(`candidate-${candidateId}`)?.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
  }, [])

  const focusCandidateDetailPanel = useCallback((candidateId: string) => {
    setSelectedCandidateId(candidateId)

    if (typeof window === 'undefined') {
      return
    }

    const shouldScrollIntoDetailPanel = window.matchMedia('(max-width: 1279px)').matches

    window.requestAnimationFrame(() => {
      if (shouldScrollIntoDetailPanel) {
        detailPanelRef.current?.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' })
      }

      window.requestAnimationFrame(() => {
        detailPanelRef.current?.focus({ preventScroll: !shouldScrollIntoDetailPanel })
      })
    })
  }, [])

  const openCandidateInQueue = useCallback((candidateId: string) => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
      focusCandidateDetailPanel(candidateId)
      return
    }

    selectCandidate(candidateId)

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => focusCandidateRow(candidateId, { reveal: true }))
    }
  }, [focusCandidateDetailPanel, focusCandidateRow, selectCandidate])

  const openCandidateFromSummary = useCallback((candidateId: string, applySummaryFilter: () => void) => {
    applySummaryFilter()

    if (typeof window === 'undefined') {
      openCandidateInQueue(candidateId)
      return
    }

    window.requestAnimationFrame(() => {
      openCandidateInQueue(candidateId)
    })
  }, [openCandidateInQueue])

  const focusCandidateInQueue = useCallback((candidateId: string) => {
    selectCandidate(candidateId, { scrollIntoView: false })

    if (typeof window === 'undefined') {
      return
    }

    window.requestAnimationFrame(() => {
      focusCandidateRow(candidateId, { reveal: true })
    })
  }, [focusCandidateRow, selectCandidate])

  const copyCurrentView = useCallback((label: string) => {
    if (typeof window === 'undefined') return
    void copyText(window.location.href, label)
  }, [copyText])

  const moveKeyboardSelection = useCallback(
    (candidateId: string | null, options?: { focusQueueRow?: boolean }) => {
      if (!candidateId || candidateId === selectedCandidateId) return

      selectCandidate(candidateId, { scrollIntoView: false })

      if (!options?.focusQueueRow || typeof window === 'undefined') {
        return
      }

      window.requestAnimationFrame(() => {
        focusCandidateRow(candidateId, { reveal: true })
      })
    },
    [focusCandidateRow, selectCandidate, selectedCandidateId]
  )

  const clearScopedReview = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('ids')
    nextParams.delete('selected')

    const next = nextParams.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const focusFamily = useCallback(
    (dedupeKey: string, nextSelectedId?: string) => {
      setFamilyFilter(dedupeKey)
      if (statusFilter !== 'all') {
        setStatusFilter('all')
      }
      if (nextSelectedId) {
        setSelectedCandidateId(nextSelectedId)
      }
    },
    [statusFilter]
  )

  const clearFamilyFocus = useCallback(() => {
    setFamilyFilter(null)
  }, [])

  const applyReviewRoute = useCallback((route: ReviewRouteKey) => {
    setStatusFilter('pending')
    setTriageFilter('all')
    setCompletenessFilter(route === 'thin-cleanup' ? 'thin' : 'all')
    setSuggestedActionFilter(route === 'approve-ready' ? 'keep' : route === 'merge-sweep' ? 'merge' : 'reject')
    setFamilyShapeFilter('all')
    setFamilyFilter(null)
    setSortMode(route === 'approve-ready' ? 'completeness' : route === 'merge-sweep' ? 'duplicate-pressure' : 'triage')
  }, [])

  const focusFamilyShape = useCallback((shape: Exclude<DuplicateShapeFilter, 'all'>) => {
    setFamilyShapeFilter((current) => (current === shape ? 'all' : shape))
    setFamilyFilter(null)
    setSortMode(shape === 'solo' ? 'triage' : 'duplicate-pressure')
  }, [])

  const toggleGradeFocus = useCallback((grade: string) => {
    setGradeFilter((current) => (current === grade ? 'all' : grade))
  }, [])

  const toggleCategoryFocus = useCallback((category: string, candidateId?: string) => {
    setCategoryFilter((current) => (current === category ? 'all' : category))
    if (candidateId) {
      selectCandidate(candidateId, { scrollIntoView: false })
    }
  }, [selectCandidate])

  const toggleDifficultyFocus = useCallback((difficulty: string, candidateId?: string) => {
    setDifficultyFilter((current) => (current === difficulty ? 'all' : difficulty))
    if (candidateId) {
      selectCandidate(candidateId, { scrollIntoView: false })
    }
  }, [selectCandidate])

  const toggleSourceFocus = useCallback((source: string, candidateId?: string) => {
    setSourceFilter((current) => (current === source ? 'all' : source))
    if (candidateId) {
      selectCandidate(candidateId, { scrollIntoView: false })
    }
  }, [selectCandidate])

  const toggleAiDecisionFocus = useCallback((decision: Exclude<AiDecisionFilter, 'all'>) => {
    setAiDecisionFilter((current) => (current === decision ? 'all' : decision))
  }, [])

  const toggleCompletenessFocus = useCallback((band: CompletenessBand) => {
    setCompletenessFilter((current) => (current === band ? 'all' : band))
  }, [])

  const toggleSuggestedActionFocus = useCallback((decision: FamilyDecision) => {
    setSuggestedActionFilter((current) => (current === decision ? 'all' : decision))
  }, [])

  const toggleStatusFocus = useCallback((status: ReviewStatus) => {
    setStatusFilter((current) => (current === status ? 'all' : status))
  }, [])

  const familySizeByKey = useMemo(() => {
    const counts = new Map<string, number>()

    for (const candidate of candidates) {
      if (!candidate.dedupe_key) continue
      counts.set(candidate.dedupe_key, (counts.get(candidate.dedupe_key) ?? 0) + 1)
    }

    return counts
  }, [candidates])

  const candidateInsights = useMemo(() => {
    const insights = new Map<string, CandidateInsight>()

    for (const candidate of candidates) {
      const familySize = candidate.dedupe_key ? familySizeByKey.get(candidate.dedupe_key) ?? 1 : 1
      insights.set(candidate.id, buildCandidateInsight(candidate, familySize))
    }

    return insights
  }, [candidates, familySizeByKey])

  const availableGrades = useMemo(
    () => Array.from(new Set(candidates.map((candidate) => candidate.grade_level ?? 'unassigned'))).sort(),
    [candidates]
  )

  const availableCategories = useMemo(
    () => Array.from(new Set(candidates.map((candidate) => candidate.category).filter(Boolean))).sort(),
    [candidates]
  )

  const availableDifficulties = useMemo<string[]>(
    () => Array.from(new Set(candidates.map((candidate) => candidate.difficulty ?? 'unassigned'))).sort(),
    [candidates]
  )

  const availableSources = useMemo(() => Array.from(new Set(candidates.map((candidate) => getSourceLabel(candidate)))).sort(), [candidates])

  const baseFilteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const scopedIdSet = scopedCandidateIds ? new Set(scopedCandidateIds) : null

    return candidates.filter((candidate) => {
      if (scopedIdSet && !scopedIdSet.has(candidate.id)) return false
      if (statusFilter !== 'all' && candidate.review_status !== statusFilter) return false

      const insight = candidateInsights.get(candidate.id)
      if (!insight) return false

      if (gradeFilter !== 'all') {
        const candidateGrade = candidate.grade_level ?? 'unassigned'
        if (candidateGrade !== gradeFilter) return false
      }

      if (difficultyFilter !== 'all') {
        const candidateDifficulty = candidate.difficulty ?? 'unassigned'
        if (candidateDifficulty !== difficultyFilter) return false
      }

      if (categoryFilter !== 'all' && candidate.category !== categoryFilter) return false
      if (sourceFilter !== 'all' && getSourceLabel(candidate) !== sourceFilter) return false
      if (aiDecisionFilter !== 'all' && getAiDecisionFilterValue(candidate.ai_decision ?? null) !== aiDecisionFilter) return false
      if (familyShapeFilter !== 'all' && getDuplicateShape(insight.familySize) !== familyShapeFilter) return false
      if (familyFilter && candidate.dedupe_key !== familyFilter) return false

      if (!normalizedQuery) return true

      return getCandidateSearchText(candidate).includes(normalizedQuery)
    })
  }, [aiDecisionFilter, candidateInsights, candidates, query, statusFilter, gradeFilter, difficultyFilter, categoryFilter, familyShapeFilter, sourceFilter, familyFilter, scopedCandidateIds])

  const filteredCandidates = useMemo(() => {
    return baseFilteredCandidates.filter((candidate) => {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) return false
      if (triageFilter !== 'all' && insight.triageLevel !== triageFilter) return false
      if (completenessFilter !== 'all' && getCompletenessBand(insight) !== completenessFilter) return false
      if (suggestedActionFilter !== 'all' && getCandidateDecisionHint(candidate, insight) !== suggestedActionFilter) return false
      return true
    })
  }, [baseFilteredCandidates, candidateInsights, completenessFilter, suggestedActionFilter, triageFilter])

  const sortedCandidates = useMemo(
    () => [...filteredCandidates].sort((left, right) => compareCandidatesForSortMode(left, right, candidateInsights, sortMode)),
    [filteredCandidates, candidateInsights, sortMode]
  )

  const defaultResetCandidateId = useMemo(() => {
    const defaultPendingCandidate = [...candidates]
      .filter((candidate) => candidate.review_status === 'pending')
      .sort((left, right) => compareCandidatesForSortMode(left, right, candidateInsights, 'triage'))[0]

    if (defaultPendingCandidate) {
      return defaultPendingCandidate.id
    }

    return [...candidates].sort((left, right) => compareCandidatesForSortMode(left, right, candidateInsights, 'triage'))[0]?.id ?? null
  }, [candidateInsights, candidates])

  const clearAllViewFilters = useCallback(() => {
    setSelectedIds([])
    setQuery('')
    setStatusFilter('pending')
    setGradeFilter('all')
    setDifficultyFilter('all')
    setCategoryFilter('all')
    setSourceFilter('all')
    setAiDecisionFilter('all')
    setTriageFilter('all')
    setCompletenessFilter('all')
    setSuggestedActionFilter('all')
    setFamilyShapeFilter('all')
    setFamilyFilter(null)
    setSortMode('triage')
    setSelectedCandidateId(defaultResetCandidateId)
    shouldScrollSelectedCandidateIntoViewRef.current = Boolean(defaultResetCandidateId)
    shouldFocusSelectedCandidateRowRef.current = Boolean(defaultResetCandidateId)
  }, [defaultResetCandidateId])

  const pendingCandidates = sortedCandidates.filter((candidate) => candidate.review_status === 'pending')
  const basePendingCandidates = baseFilteredCandidates.filter((candidate) => candidate.review_status === 'pending')

  const pendingFamilyShapeSummary = useMemo(() => {
    const summary: Record<
      Exclude<DuplicateShapeFilter, 'all'>,
      {
        rows: number
        families: Set<string>
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    > = {
      solo: { rows: 0, families: new Set<string>(), leadCandidate: null, leadInsight: null, leadDecision: null },
      pair: { rows: 0, families: new Set<string>(), leadCandidate: null, leadInsight: null, leadDecision: null },
      'small-family': { rows: 0, families: new Set<string>(), leadCandidate: null, leadInsight: null, leadDecision: null },
      'large-family': { rows: 0, families: new Set<string>(), leadCandidate: null, leadInsight: null, leadDecision: null },
    }

    for (const candidate of pendingCandidates) {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) continue

      const shape = getDuplicateShape(insight.familySize)
      summary[shape].rows += 1
      summary[shape].families.add(candidate.dedupe_key || candidate.id)
      if (!summary[shape].leadCandidate) {
        summary[shape].leadCandidate = candidate
        summary[shape].leadInsight = insight
        summary[shape].leadDecision = getCandidateDecisionHint(candidate, insight)
      }
    }

    return summary
  }, [candidateInsights, pendingCandidates])

  const runReviewAction = useCallback(
    async ({
      action,
      candidateIds,
      canonicalDrillId,
      successLabel,
    }: {
      action: ReviewMutationAction
      candidateIds: string[]
      canonicalDrillId?: string
      successLabel: string
    }) => {
      if (candidateIds.length === 0 || isSubmitting) return

      setActionError(null)
      setIsSubmitting(true)

      try {
        const response = await fetch('/api/review/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            candidateIds,
            canonicalDrillId,
          }),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'Review action failed.')
        }

        const nextStatus = REVIEW_ACTION_STATUS[action]
        const actedRowsWillDisappear = statusFilter !== 'all' && statusFilter !== nextStatus
        const selectedRowWasActedOn = selectedCandidateId ? candidateIds.includes(selectedCandidateId) : false
        const shouldAdvanceSelection = actedRowsWillDisappear || selectedRowWasActedOn || candidateIds.length === 1

        if (shouldAdvanceSelection) {
          const nextSelectedId = getNextPendingReviewSelection(
            candidateIds,
            pendingCandidates.map((candidate) => candidate.id),
            sortedCandidates.map((candidate) => candidate.id),
            selectedCandidateId
          )

          shouldScrollSelectedCandidateIntoViewRef.current = Boolean(nextSelectedId)
          shouldFocusSelectedCandidateRowRef.current = Boolean(nextSelectedId)
          setSelectedCandidateId(nextSelectedId)

          if (!nextSelectedId && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        }

        setCopyFeedback(payload?.message || successLabel)
        setSelectedIds((current) => current.filter((id) => !candidateIds.includes(id)))
        scheduleCopyFeedbackClear()
        router.refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Review action failed.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, pendingCandidates, router, scheduleCopyFeedbackClear, selectedCandidateId, sortedCandidates, statusFilter]
  )

  const statusCounts = REVIEW_STATUSES.map((status) => ({
    status,
    count: sortedCandidates.filter((candidate) => candidate.review_status === status).length,
  }))

  const gradeCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.grade_level ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const gradeSummaries = useMemo(() => {
    const summary = new Map<
      string,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of pendingCandidates) {
      const key = candidate.grade_level ?? 'unassigned'
      const existing = summary.get(key)

      if (!existing) {
        const leadInsight = candidateInsights.get(candidate.id) ?? null
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: leadInsight ? getCandidateDecisionHint(candidate, leadInsight) : null
        })
        continue
      }

      existing.count += 1
    }

    return summary
  }, [candidateInsights, pendingCandidates])

  const categoryCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.category ?? 'uncategorised'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const difficultyCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.difficulty ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const sourceCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = getSourceLabel(candidate)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const difficultySummaries = useMemo(() => {
    const summary = new Map<
      string,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of pendingCandidates) {
      const key = candidate.difficulty ?? 'unassigned'
      const existing = summary.get(key)

      if (!existing) {
        const leadInsight = candidateInsights.get(candidate.id) ?? null
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: leadInsight ? getCandidateDecisionHint(candidate, leadInsight) : null
        })
        continue
      }

      existing.count += 1
    }


    return summary
  }, [candidateInsights, pendingCandidates])

  const sourceSummaries = useMemo(() => {
    const summary = new Map<
      string,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of pendingCandidates) {
      const key = getSourceLabel(candidate)
      const existing = summary.get(key)

      if (!existing) {
        const leadInsight = candidateInsights.get(candidate.id) ?? null
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: leadInsight ? getCandidateDecisionHint(candidate, leadInsight) : null
        })
        continue
      }

      existing.count += 1
    }


    return summary
  }, [candidateInsights, pendingCandidates])

  const categorySummaries = useMemo(() => {
    const summary = new Map<
      string,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of pendingCandidates) {
      const key = candidate.category ?? 'uncategorised'
      const existing = summary.get(key)

      if (!existing) {
        const leadInsight = candidateInsights.get(candidate.id) ?? null
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: leadInsight ? getCandidateDecisionHint(candidate, leadInsight) : null
        })
        continue
      }

      existing.count += 1
    }


    return summary
  }, [candidateInsights, pendingCandidates])

  const aiDecisionCounts = pendingCandidates.reduce<Record<Exclude<AiDecisionFilter, 'all'>, number>>(
    (acc, candidate) => {
      const key = getAiDecisionFilterValue(candidate.ai_decision ?? null)
      acc[key] += 1
      return acc
    },
    {
      approve: 0,
      merge: 0,
      review: 0,
      reject: 0,
      none: 0,
    }
  )

  const aiDecisionSummaries = useMemo(() => {
    const summary = new Map<
      Exclude<AiDecisionFilter, 'all'>,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of pendingCandidates) {
      const key = getAiDecisionFilterValue(candidate.ai_decision ?? null)
      const existing = summary.get(key)

      if (!existing) {
        const leadInsight = candidateInsights.get(candidate.id) ?? null
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: leadInsight ? getCandidateDecisionHint(candidate, leadInsight) : null,
        })
        continue
      }

      existing.count += 1
    }

    return summary
  }, [candidateInsights, pendingCandidates])

  const triageCounts = basePendingCandidates.reduce<Record<TriageLevel, number>>(
    (acc, candidate) => {
      const triageLevel = candidateInsights.get(candidate.id)?.triageLevel ?? 'low-signal'
      acc[triageLevel] += 1
      return acc
    },
    {
      'act-now': 0,
      'worth-a-look': 0,
      'low-signal': 0,
      'already-reviewed': 0,
    }
  )

  const triageSummaries = useMemo(() => {
    const summary = new Map<
      Exclude<TriageLevel, 'already-reviewed'>,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of basePendingCandidates) {
      const leadInsight = candidateInsights.get(candidate.id)
      const triageLevel = leadInsight?.triageLevel

      if (!leadInsight || !triageLevel || triageLevel === 'already-reviewed') continue

      const key: Exclude<TriageLevel, 'already-reviewed'> = triageLevel
      const existing = summary.get(key)

      if (!existing) {
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: getCandidateDecisionHint(candidate, leadInsight),
        })
        continue
      }

      existing.count += 1
    }

    return summary
  }, [basePendingCandidates, candidateInsights])

  const completenessCounts = basePendingCandidates.reduce<Record<CompletenessBand, number>>(
    (acc, candidate) => {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) return acc
      acc[getCompletenessBand(insight)] += 1
      return acc
    },
    {
      thin: 0,
      usable: 0,
      rich: 0,
    }
  )

  const visiblePendingCompletenessCounts = pendingCandidates.reduce<Record<CompletenessBand, number>>(
    (acc, candidate) => {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) return acc
      acc[getCompletenessBand(insight)] += 1
      return acc
    },
    {
      thin: 0,
      usable: 0,
      rich: 0,
    }
  )

  const completenessSummaries = useMemo(() => {
    const summary = new Map<
      CompletenessBand,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
        leadDecision: FamilyDecision | null
      }
    >()

    for (const candidate of basePendingCandidates) {
      const leadInsight = candidateInsights.get(candidate.id)
      if (!leadInsight) continue

      const band = getCompletenessBand(leadInsight)
      const existing = summary.get(band)

      if (!existing) {
        summary.set(band, {
          count: 1,
          leadCandidate: candidate,
          leadInsight,
          leadDecision: getCandidateDecisionHint(candidate, leadInsight),
        })
        continue
      }

      existing.count += 1
    }

    return summary
  }, [basePendingCandidates, candidateInsights])

  const suggestedActionCounts = basePendingCandidates.reduce<Record<FamilyDecision, number>>(
    (acc, candidate) => {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) return acc
      acc[getCandidateDecisionHint(candidate, insight)] += 1
      return acc
    },
    {
      keep: 0,
      merge: 0,
      reject: 0,
    }
  )

  const suggestedActionSummaries = useMemo(() => {
    const summary = new Map<
      FamilyDecision,
      {
        count: number
        leadCandidate: RawDrillCandidate | null
        leadInsight: CandidateInsight | null
      }
    >()

    for (const candidate of basePendingCandidates) {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) continue

      const key = getCandidateDecisionHint(candidate, insight)
      const existing = summary.get(key)

      if (!existing) {
        summary.set(key, {
          count: 1,
          leadCandidate: candidate,
          leadInsight: insight,
        })
        continue
      }

      existing.count += 1
    }

    return summary
  }, [basePendingCandidates, candidateInsights])

  const visiblePendingTriageCounts = pendingCandidates.reduce<Record<TriageLevel, number>>(
    (acc, candidate) => {
      const triageLevel = candidateInsights.get(candidate.id)?.triageLevel ?? 'low-signal'
      acc[triageLevel] += 1
      return acc
    },
    {
      'act-now': 0,
      'worth-a-look': 0,
      'low-signal': 0,
      'already-reviewed': 0,
    }
  )

  const missingSummaryCount = basePendingCandidates.filter(
    (candidate) => !candidate.summary && !candidate.what_it_trains && !candidate.description
  ).length

  const visibleMissingSummaryCount = pendingCandidates.filter(
    (candidate) => !candidate.summary && !candidate.what_it_trains && !candidate.description
  ).length

  const duplicateFamilies = useMemo(() => {
    const families = new Map<string, RawDrillCandidate[]>()

    for (const candidate of sortedCandidates) {
      if (!candidate.dedupe_key) continue
      const existing = families.get(candidate.dedupe_key) ?? []
      existing.push(candidate)
      families.set(candidate.dedupe_key, existing)
    }

    return Array.from(families.entries())
      .map(([dedupeKey, familyCandidates]) => {
        const leadCandidate = familyCandidates[0] ?? null
        const leadInsight = leadCandidate ? candidateInsights.get(leadCandidate.id) ?? null : null
        const leadDecision = leadCandidate && leadInsight ? getCandidateDecisionHint(leadCandidate, leadInsight) : null

        return {
          dedupeKey,
          count: familyCandidates.length,
          statuses: Array.from(new Set(familyCandidates.map((candidate) => candidate.review_status))),
          sampleTitles: familyCandidates.slice(0, 3).map((candidate) => getDisplayTitle(candidate)),
          leadCandidate,
          leadInsight,
          leadDecision,
        }
      })
      .sort((left, right) => right.count - left.count || left.dedupeKey.localeCompare(right.dedupeKey))
  }, [candidateInsights, sortedCandidates])

  const visiblePendingDuplicateFamilyCount = useMemo(() => {
    const families = new Set<string>()

    for (const candidate of pendingCandidates) {
      if (!candidate.dedupe_key) continue
      families.add(candidate.dedupe_key)
    }

    return families.size
  }, [pendingCandidates])

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => sortedCandidates.some((candidate) => candidate.id === id)),
    [selectedIds, sortedCandidates]
  )
  const hiddenSelectedCount = selectedIds.length - visibleSelectedIds.length
  const actionableSelectedIds = useMemo(
    () =>
      visibleSelectedIds.filter((id) => {
        const candidate = sortedCandidates.find((item) => item.id === id)
        return candidate?.review_status === 'pending'
      }),
    [sortedCandidates, visibleSelectedIds]
  )
  const skippedSelectedCount = visibleSelectedIds.length - actionableSelectedIds.length
  const actionableSelectedLabel = `${actionableSelectedIds.length} visible pending row${actionableSelectedIds.length === 1 ? '' : 's'}`
  const bulkActionTitle =
    actionableSelectedIds.length > 0
      ? `Run this action on ${actionableSelectedLabel}. Hidden or already-reviewed selections stay untouched.`
      : hiddenSelectedCount > 0
        ? 'No visible pending rows selected. Hidden selections stay selected, but bulk actions only run on rows visible in the current slice.'
        : skippedSelectedCount > 0
          ? 'No pending rows selected. Bulk actions only run on pending rows in the current slice.'
          : 'Select at least one visible pending row to run a bulk action.'

  const selectedCandidateLookupId = selectedCandidateFromUrl ?? selectedCandidateId
  const selectedCandidate =
    (selectedCandidateFromUrl
      ? sortedCandidates.find((candidate) => candidate.id === selectedCandidateFromUrl)
      : null) ??
    sortedCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    sortedCandidates[0] ??
    null
  const hiddenSelectedCandidate =
    !selectedCandidate && selectedCandidateLookupId
      ? candidates.find((candidate) => candidate.id === selectedCandidateLookupId) ?? null
      : null
  const selectedCandidateIsPending = selectedCandidate?.review_status === 'pending'

  const revealHiddenSelectedCandidate = useCallback(() => {
    if (!hiddenSelectedCandidate) return

    setSelectedIds([])
    setQuery('')
    setStatusFilter(hiddenSelectedCandidate.review_status === 'pending' ? 'pending' : 'all')
    setGradeFilter('all')
    setDifficultyFilter('all')
    setCategoryFilter('all')
    setSourceFilter('all')
    setAiDecisionFilter('all')
    setTriageFilter('all')
    setCompletenessFilter('all')
    setSuggestedActionFilter('all')
    setFamilyShapeFilter('all')
    setFamilyFilter(null)
    setSortMode('triage')
    setSelectedCandidateId(hiddenSelectedCandidate.id)
    shouldScrollSelectedCandidateIntoViewRef.current = true
    shouldFocusSelectedCandidateRowRef.current = true

    if (scopedCandidateIds) {
      clearScopedReview()
    }
  }, [clearScopedReview, hiddenSelectedCandidate, scopedCandidateIds])

  useEffect(() => {
    const nextVisibleSelectedId = selectedCandidate?.id ?? null

    if (!nextVisibleSelectedId && hiddenSelectedCandidate) {
      return
    }

    if (selectedCandidateId === nextVisibleSelectedId) {
      return
    }

    setSelectedCandidateId(nextVisibleSelectedId)
  }, [hiddenSelectedCandidate, selectedCandidate, selectedCandidateId])

  useEffect(() => {
    if (!selectedCandidateId || typeof document === 'undefined') {
      return
    }

    const row = document.getElementById(`candidate-${selectedCandidateId}`)
    if (!row) {
      return
    }

    if (shouldScrollSelectedCandidateIntoViewRef.current) {
      shouldScrollSelectedCandidateIntoViewRef.current = false
      row.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
    }

    if (shouldFocusSelectedCandidateRowRef.current) {
      shouldFocusSelectedCandidateRowRef.current = false
      focusCandidateRow(selectedCandidateId)
    }
  }, [focusCandidateRow, selectedCandidateId, sortedCandidates])

  const matchedDrills = useMemo(() => {
    if (!selectedCandidate) return []

    return drills
      .map((drill) => scoreDrillMatch(selectedCandidate, drill))
      .filter((match): match is DrillMatch => Boolean(match))
      .sort((left, right) => right.matchScore - left.matchScore || Number(right.is_curated) - Number(left.is_curated) || left.title.localeCompare(right.title))
      .slice(0, 5)
  }, [drills, selectedCandidate])

  useEffect(() => {
    setSelectedCanonicalDrillId(null)
  }, [selectedCandidate?.id])

  useEffect(() => {
    if (!selectedCanonicalDrillId) return

    const stillMatchesSelectedCandidate = matchedDrills.some((drill) => drill.id === selectedCanonicalDrillId)

    if (!stillMatchesSelectedCandidate) {
      setSelectedCanonicalDrillId(null)
    }
  }, [matchedDrills, selectedCanonicalDrillId])

  const preferredMergeTargetId = selectedCanonicalDrillId ?? matchedDrills[0]?.id ?? null
  const preferredMergeTarget = matchedDrills.find((drill) => drill.id === preferredMergeTargetId) ?? null
  const isUsingAutoMergeTarget = !selectedCanonicalDrillId && Boolean(preferredMergeTarget)
  const mergeTargetNeedsExplicitSelection =
    Boolean(preferredMergeTargetId) &&
    matchedDrills.length > 1 &&
    !selectedCanonicalDrillId &&
    selectedCandidate?.canonical_drill_id !== preferredMergeTargetId
  const canRunMergeAction = Boolean(preferredMergeTargetId) && !mergeTargetNeedsExplicitSelection
  const mergeTargetPrompt = !preferredMergeTargetId
    ? 'Pick a merge target first.'
    : mergeTargetNeedsExplicitSelection
      ? 'Pick a merge target first. This row has multiple plausible library matches.'
      : 'Use the selected canonical target.'

  const cycleMergeTarget = useCallback(
    (direction: 'next' | 'previous') => {
      const nextTarget = getAdjacentCandidate(matchedDrills, preferredMergeTargetId, direction)
      if (!nextTarget) return
      setSelectedCanonicalDrillId(nextTarget.id)
    },
    [matchedDrills, preferredMergeTargetId]
  )

  const selectedFamilyCandidates = selectedCandidate?.dedupe_key
    ? sortedCandidates.filter((candidate) => candidate.dedupe_key === selectedCandidate.dedupe_key)
    : []

  const currentSliceSummary = useMemo(() => {
    const leadCandidate = pendingCandidates[0] ?? sortedCandidates[0] ?? null
    const leadInsight = leadCandidate ? candidateInsights.get(leadCandidate.id) ?? null : null
    const dominantVisibleTriage = (Object.entries(visiblePendingTriageCounts) as Array<[TriageLevel, number]>)
      .filter(([, count]) => count > 0 && count)
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null

    const dominantVisibleCompleteness = (Object.entries(visiblePendingCompletenessCounts) as Array<[CompletenessBand, number]>)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null

    const dominantVisibleFamilyShape = (Object.entries(pendingFamilyShapeSummary) as Array<[
      Exclude<DuplicateShapeFilter, 'all'>,
      { rows: number; families: Set<string>; leadCandidate: RawDrillCandidate | null }
    ]>)
      .filter(([, summary]) => summary.rows > 0)
      .sort((left, right) => right[1].rows - left[1].rows)[0]?.[0] ?? null

    const dominantVisibleAction = (() => {
      const counts = new Map<FamilyDecision, number>()

      for (const candidate of pendingCandidates) {
        const insight = candidateInsights.get(candidate.id)
        if (!insight) continue

        const decision = getCandidateDecisionHint(candidate, insight)
        counts.set(decision, (counts.get(decision) ?? 0) + 1)
      }

      return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
    })()

    const dominantVisibleAiDecision = (() => {
      const counts = new Map<Exclude<AiDecisionFilter, 'all'>, number>()

      for (const candidate of pendingCandidates) {
        const decision = getAiDecisionFilterValue(candidate.ai_decision ?? null)
        counts.set(decision, (counts.get(decision) ?? 0) + 1)
      }

      return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
    })()

    const dominantVisibleGrade = (() => {
      const counts = new Map<string, number>()

      for (const candidate of pendingCandidates) {
        const grade = candidate.grade_level ?? 'unassigned'
        counts.set(grade, (counts.get(grade) ?? 0) + 1)
      }

      return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null
    })()

    const topVisibleSource = (() => {
      const counts = new Map<string, number>()

      for (const candidate of pendingCandidates) {
        const source = getSourceLabel(candidate)
        counts.set(source, (counts.get(source) ?? 0) + 1)
      }

      return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? null
    })()

    const topVisibleFamily = (() => {
      const families = new Map<
        string,
        {
          count: number
          leadCandidate: RawDrillCandidate | null
        }
      >()

      for (const candidate of pendingCandidates) {
        if (!candidate.dedupe_key) continue

        const existing = families.get(candidate.dedupe_key)
        if (existing) {
          existing.count += 1
          continue
        }

        families.set(candidate.dedupe_key, {
          count: 1,
          leadCandidate: candidate,
        })
      }

      return Array.from(families.entries())
        .map(([dedupeKey, family]) => ({
          dedupeKey,
          count: family.count,
          leadCandidate: family.leadCandidate,
        }))
        .sort((left, right) => right.count - left.count || left.dedupeKey.localeCompare(right.dedupeKey))[0] ?? null
    })()

    const activeReviewRouteLabel =
      suggestedActionFilter === 'keep' && sortMode === 'completeness' && completenessFilter === 'all' && triageFilter === 'all' && familyShapeFilter === 'all' && !familyFilter
        ? 'Approve-ready'
        : suggestedActionFilter === 'merge' && sortMode === 'duplicate-pressure' && completenessFilter === 'all' && triageFilter === 'all' && familyShapeFilter === 'all' && !familyFilter
          ? 'Merge sweep'
          : suggestedActionFilter === 'reject' && completenessFilter === 'thin' && sortMode === 'triage' && triageFilter === 'all' && familyShapeFilter === 'all' && !familyFilter
            ? 'Thin cleanup'
            : null

    const lines = [
      'Review queue handoff',
      `Visible rows: ${sortedCandidates.length}`,
      `Pending rows: ${pendingCandidates.length}`,
      `Current sort: ${SORT_MODE_LABELS[sortMode]}`,
      `Active review route: ${activeReviewRouteLabel ?? 'None'}`,
      `Active search: ${query.trim() ? `“${query.trim()}”` : 'None'}`,
      `Active scope: ${scopedCandidateIds ? `${scopeRequestedCount} linked row${scopeRequestedCount === 1 ? '' : 's'}` : 'Full queue'}`,
      `Active status slice: ${statusFilter === 'all' ? 'All statuses' : REVIEW_STATUS_LABELS[statusFilter]}`,
      `Active grade slice: ${gradeFilter === 'all' ? 'All grades' : formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}`,
      `Active category slice: ${categoryFilter === 'all' ? 'All categories' : categoryFilter}`,
      `Active difficulty slice: ${difficultyFilter === 'all' ? 'All difficulties' : formatDifficultyLabel(difficultyFilter)}`,
      `Active source slice: ${sourceFilter === 'all' ? 'All sources' : sourceFilter}`,
      `Active triage slice: ${triageFilter === 'all' ? 'All visible pending' : getTriageLabel(triageFilter)}`,
      `Active completeness slice: ${completenessFilter === 'all' ? 'All extract levels' : COMPLETENESS_BAND_LABELS[completenessFilter]}`,
      `Active suggested-action lane: ${getSuggestedActionFilterLabel(suggestedActionFilter)}`,
      `Active duplicate lane: ${familyShapeFilter === 'all' ? 'All family shapes' : DUPLICATE_SHAPE_LABELS[familyShapeFilter]}`,
      `Active AI lane: ${getAiDecisionFilterLabel(aiDecisionFilter)}`,
      `Family focus: ${familyFilter ?? 'None'}`,
      `Missing summary rows: ${visibleMissingSummaryCount}`,
      `Visible pending duplicate families: ${visiblePendingDuplicateFamilyCount}`,
    ]

    if (dominantVisibleTriage) {
      lines.push(`Dominant visible triage: ${getTriageLabel(dominantVisibleTriage)}`)
    }

    if (dominantVisibleCompleteness) {
      lines.push(`Dominant visible completeness: ${COMPLETENESS_BAND_LABELS[dominantVisibleCompleteness]}`)
    }

    if (dominantVisibleFamilyShape) {
      lines.push(`Dominant duplicate lane: ${DUPLICATE_SHAPE_LABELS[dominantVisibleFamilyShape]}`)
    }

    if (dominantVisibleAction) {
      lines.push(`Dominant suggested action: ${getDecisionLabel(dominantVisibleAction)}`)
    }

    if (dominantVisibleAiDecision) {
      lines.push(`Dominant AI recommendation: ${getAiDecisionFilterLabel(dominantVisibleAiDecision)}`)
    }

    if (dominantVisibleGrade) {
      lines.push(`Dominant visible grade: ${formatGradeLevel(dominantVisibleGrade === 'unassigned' ? null : dominantVisibleGrade)}`)
    }

    if (topVisibleSource) {
      lines.push(`Main visible source: ${topVisibleSource[0]} (${topVisibleSource[1]})`)
    }

    if (topVisibleFamily) {
      lines.push(`Largest pending family: ${topVisibleFamily.dedupeKey} (${topVisibleFamily.count} rows)`)
    }

    if (leadCandidate && leadInsight) {
      lines.push('')
      lines.push(`Lead visible candidate: ${getDisplayTitle(leadCandidate)}`)
      lines.push(`Lead status: ${REVIEW_STATUS_LABELS[leadCandidate.review_status]} • ${getTriageLabel(leadInsight.triageLevel)}`)
      lines.push(`Lead next move: ${getReviewerNextMove(leadCandidate, leadInsight)}`)
      lines.push(`Lead readiness gaps: ${formatReadinessGapsForHandoff(leadCandidate, leadInsight)}`)
      lines.push(`Lead source: ${getSourceLabel(leadCandidate)}`)
      if (leadCandidate.dedupe_key) {
        lines.push(`Lead family: ${leadCandidate.dedupe_key} (${leadInsight.familySize} rows)`)
      }
    }

    return {
      leadCandidate,
      leadInsight,
      dominantVisibleTriage,
      dominantVisibleCompleteness,
      dominantVisibleFamilyShape,
      dominantVisibleAction,
      dominantVisibleAiDecision,
      dominantVisibleGrade,
      topVisibleSource,
      topVisibleFamily,
      handoffText: lines.join('\n'),
    }
  }, [aiDecisionFilter, candidateInsights, categoryFilter, completenessFilter, difficultyFilter, familyFilter, familyShapeFilter, gradeFilter, pendingCandidates, pendingFamilyShapeSummary, query, scopeRequestedCount, scopedCandidateIds, sortMode, sortedCandidates, sourceFilter, statusFilter, suggestedActionFilter, triageFilter, visibleMissingSummaryCount, visiblePendingCompletenessCounts, visiblePendingDuplicateFamilyCount, visiblePendingTriageCounts])

  const reviewRoutes = useMemo(() => {
    const routeDefinitions: Array<{
      key: ReviewRouteKey
      label: string
      description: string
      countLabel: string
      isActive: boolean
      matches: (candidate: RawDrillCandidate, insight: CandidateInsight) => boolean
      rank: (candidate: RawDrillCandidate, insight: CandidateInsight) => number
    }> = [
      {
        key: 'approve-ready',
        label: 'Approve-ready',
        description: 'Likely canonical seeds with enough structure to turn into drills without extra queue wrangling.',
        countLabel: 'ready keeps',
        isActive: suggestedActionFilter === 'keep' && sortMode === 'completeness' && completenessFilter === 'all' && triageFilter === 'all' && familyShapeFilter === 'all' && !familyFilter,
        matches: (candidate, insight) => getCandidateDecisionHint(candidate, insight) === 'keep' && insight.completenessScore >= 3,
        rank: (candidate, insight) => insight.completenessScore * 100 + insight.triageScore * 10 - getCreatedAtTimestamp(candidate.created_at),
      },
      {
        key: 'merge-sweep',
        label: 'Merge sweep',
        description: 'Supporting duplicates grouped into one pass, so reviewers can collapse overlap instead of treating rows as isolated.',
        countLabel: 'merge rows',
        isActive: suggestedActionFilter === 'merge' && sortMode === 'duplicate-pressure' && completenessFilter === 'all' && triageFilter === 'all' && familyShapeFilter === 'all' && !familyFilter,
        matches: (candidate, insight) => getCandidateDecisionHint(candidate, insight) === 'merge' && insight.familySize >= 2,
        rank: (candidate, insight) => insight.familySize * 100 + insight.triageScore * 10 + insight.completenessScore,
      },
      {
        key: 'thin-cleanup',
        label: 'Thin cleanup',
        description: 'Low-information rows that are probably rejects, bundled into a fast cleanup lane.',
        countLabel: 'thin rejects',
        isActive: suggestedActionFilter === 'reject' && completenessFilter === 'thin' && sortMode === 'triage' && triageFilter === 'all' && familyShapeFilter === 'all' && !familyFilter,
        matches: (candidate, insight) => getCandidateDecisionHint(candidate, insight) === 'reject' && getCompletenessBand(insight) === 'thin',
        rank: (candidate, insight) => insight.triageScore * 10 - insight.completenessScore,
      },
    ]

    return routeDefinitions.map((route) => {
      const candidatesInRoute = basePendingCandidates
        .map((candidate) => ({ candidate, insight: candidateInsights.get(candidate.id) ?? null }))
        .filter((item): item is { candidate: RawDrillCandidate; insight: CandidateInsight } => Boolean(item.insight))
        .filter((item) => route.matches(item.candidate, item.insight))
        .sort((left, right) => route.rank(right.candidate, right.insight) - route.rank(left.candidate, left.insight))

      const lead = candidatesInRoute[0] ?? null

      return {
        key: route.key,
        label: route.label,
        description: route.description,
        countLabel: route.countLabel,
        count: candidatesInRoute.length,
        isActive: route.isActive,
        leadCandidate: lead?.candidate ?? null,
        leadInsight: lead?.insight ?? null,
      }
    })
  }, [basePendingCandidates, candidateInsights, completenessFilter, familyFilter, familyShapeFilter, sortMode, suggestedActionFilter, triageFilter])

  const duplicateFamilySummary = useMemo(() => {
    const leadFamily = duplicateFamilies[0] ?? null
    if (!leadFamily || !leadFamily.leadCandidate || !leadFamily.leadInsight || !leadFamily.leadDecision) {
      return null
    }

    const lines = [
      'Duplicate family handoff',
      `Visible families: ${duplicateFamilies.length}`,
      `Current family focus: ${familyFilter ?? 'None'}`,
      '',
      `Lead family: ${leadFamily.dedupeKey}`,
      `Rows in family: ${leadFamily.count}`,
      `Lead row: ${getDisplayTitle(leadFamily.leadCandidate)}`,
      `Lead status: ${REVIEW_STATUS_LABELS[leadFamily.leadCandidate.review_status]} • ${getTriageLabel(leadFamily.leadInsight.triageLevel)}`,
      `Recommended move: ${getDecisionLabel(leadFamily.leadDecision)}`,
      `Reviewer next move: ${getReviewerNextMove(leadFamily.leadCandidate, leadFamily.leadInsight)}`,
      `Lead readiness gaps: ${formatReadinessGapsForHandoff(leadFamily.leadCandidate, leadFamily.leadInsight)}`,
      `Sample titles: ${leadFamily.sampleTitles.join(' • ')}`,
    ]

    return {
      leadFamily,
      handoffText: lines.join('\n'),
    }
  }, [duplicateFamilies, familyFilter])

  const selectedCandidateHandoff = useMemo(() => {
    if (!selectedCandidate) return null

    const insight = candidateInsights.get(selectedCandidate.id)
    if (!insight) return null

    const suggestedAction = getCandidateDecisionHint(selectedCandidate, insight)
    const lines = [
      'Selected candidate handoff',
      `Candidate: ${getDisplayTitle(selectedCandidate)}`,
      `Status: ${REVIEW_STATUS_LABELS[selectedCandidate.review_status]} • ${getTriageLabel(insight.triageLevel)}`,
      `Suggested action: ${getSuggestedActionLabelForHandoff(selectedCandidate, insight)}`,
      `Reviewer next move: ${getReviewerNextMove(selectedCandidate, insight)}`,
      `Readiness gaps: ${formatReadinessGapsForHandoff(selectedCandidate, insight)}`,
      `Source: ${getSourceLabel(selectedCandidate)}`,
      `Completeness: ${insight.completenessLabel}`,
      `Difficulty: ${formatDifficultyLabel(selectedCandidate.difficulty)}`,
      `Grade: ${formatGradeLevel(selectedCandidate.grade_level)}`,
      `Duplicate lane: ${DUPLICATE_SHAPE_LABELS[getDuplicateShape(insight.familySize)]}`,
    ]

    if (selectedCandidate.dedupe_key) {
      lines.push(`Family: ${selectedCandidate.dedupe_key} (${insight.familySize} rows)`)
    }

    if (selectedCandidate.ai_decision) {
      lines.push(`AI recommendation: ${getAiDecisionLabel(selectedCandidate.ai_decision)}`)
    }

    return lines.join('\n')
  }, [candidateInsights, selectedCandidate])

  const selectedMergeHandoff = useMemo(() => {
    if (!selectedCandidate || !preferredMergeTarget) return null

    const insight = candidateInsights.get(selectedCandidate.id)
    if (!insight) return null

    const readinessGaps = getCandidateReadinessGaps(selectedCandidate, insight)
    const lines = [
      'Selected merge handoff',
      `Candidate: ${getDisplayTitle(selectedCandidate)} (${selectedCandidate.id})`,
      `Candidate status: ${REVIEW_STATUS_LABELS[selectedCandidate.review_status]} • ${getTriageLabel(insight.triageLevel)}`,
      `Suggested action: ${getSuggestedActionLabelForHandoff(selectedCandidate, insight)}`,
      `Merge target: ${preferredMergeTarget.title} (${preferredMergeTarget.id})`,
      `Target selection: ${isUsingAutoMergeTarget ? 'Auto-selected top match' : 'Reviewer-selected target'}`,
      `Merge readiness: ${mergeTargetNeedsExplicitSelection ? mergeTargetPrompt : 'Merge-ready with the selected target'}`,
      `Match score: ${preferredMergeTarget.matchScore}`,
      `Match reasons: ${preferredMergeTarget.matchReasons.slice(0, 3).join(' • ') || 'No reasons surfaced'}`,
      `Target summary: ${preferredMergeTarget.summary || 'No library summary yet.'}`,
      `Readiness gaps: ${readinessGaps.length > 0 ? readinessGaps.join(' • ') : 'No obvious metadata gaps surfaced'}`,
      `Reviewer next move: ${mergeTargetNeedsExplicitSelection ? 'Pick the exact canonical drill first, then merge only if the overlap still holds up on inspection.' : 'Merge this row into the selected canonical drill if the overlap holds up on inspection.'}`,
    ]

    return lines.join('\n')
  }, [candidateInsights, isUsingAutoMergeTarget, mergeTargetNeedsExplicitSelection, mergeTargetPrompt, preferredMergeTarget, selectedCandidate])

  const selectedCandidateIndex = selectedCandidate ? sortedCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id) : -1
  const selectedPendingIndex = selectedCandidate ? pendingCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id) : -1
  const previousVisibleCandidate = getAdjacentCandidate(sortedCandidates, selectedCandidate?.id ?? null, 'previous')
  const nextVisibleCandidate = getAdjacentCandidate(sortedCandidates, selectedCandidate?.id ?? null, 'next')
  const leadVisibleCandidate = currentSliceSummary.leadCandidate
  const previousPendingCandidate = getAdjacentCandidate(pendingCandidates, selectedCandidate?.id ?? null, 'previous')
  const nextPendingCandidate = getAdjacentCandidate(pendingCandidates, selectedCandidate?.id ?? null, 'next')
  const previousVisibleWraps = selectedCandidateIndex === 0 && sortedCandidates.length > 1
  const nextVisibleWraps = selectedCandidateIndex === sortedCandidates.length - 1 && sortedCandidates.length > 1
  const previousPendingWraps = selectedPendingIndex === 0 && pendingCandidates.length > 1
  const nextPendingWraps = selectedPendingIndex === pendingCandidates.length - 1 && pendingCandidates.length > 1

  const previousFamilyCandidate = useMemo(() => {
    if (!selectedCandidate?.dedupe_key) return null
    return getAdjacentCandidate(selectedFamilyCandidates, selectedCandidate.id, 'previous')
  }, [selectedCandidate, selectedFamilyCandidates])

  const nextFamilyCandidate = useMemo(() => {
    if (!selectedCandidate?.dedupe_key) return null
    return getAdjacentCandidate(selectedFamilyCandidates, selectedCandidate.id, 'next')
  }, [selectedCandidate, selectedFamilyCandidates])

  const selectedFamilyIndex = selectedCandidate ? selectedFamilyCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id) : -1
  const previousFamilyWraps = selectedFamilyIndex === 0 && selectedFamilyCandidates.length > 1
  const nextFamilyWraps = selectedFamilyIndex === selectedFamilyCandidates.length - 1 && selectedFamilyCandidates.length > 1

  const selectedCandidateAnnouncement = useMemo(() => {
    if (sortedCandidates.length === 0) {
      return hiddenSelectedCandidate
        ? `${getDisplayTitle(hiddenSelectedCandidate)} is still selected, but there are no visible candidates in the current review slice. Reveal that row or peel back the active modifiers to get back to it.`
        : 'No visible candidates in the current review slice.'
    }

    if (!selectedCandidate) {
      return hiddenSelectedCandidate
        ? `${sortedCandidates.length} visible candidate${sortedCandidates.length === 1 ? '' : 's'}. ${getDisplayTitle(hiddenSelectedCandidate)} is still selected, but hidden by the current slice. Reveal that row or peel back the active modifiers to get back to it.`
        : `${sortedCandidates.length} visible candidate${sortedCandidates.length === 1 ? '' : 's'}. No candidate selected.`
    }

    const insight = candidateInsights.get(selectedCandidate.id)
    const parts = [
      `Selected ${getDisplayTitle(selectedCandidate)}.`,
      `Visible row ${selectedCandidateIndex + 1} of ${sortedCandidates.length}.`,
      `Status ${REVIEW_STATUS_LABELS[selectedCandidate.review_status]}.`,
    ]

    if (selectedPendingIndex >= 0) {
      parts.push(`Pending row ${selectedPendingIndex + 1} of ${pendingCandidates.length}.`)
    }

    if (insight) {
      parts.push(`${getTriageLabel(insight.triageLevel)}.`)
      parts.push(`Suggested action ${getDecisionLabel(getCandidateDecisionHint(selectedCandidate, insight))}.`)
    }

    if (selectedCandidate.dedupe_key && selectedFamilyIndex >= 0) {
      parts.push(`Family row ${selectedFamilyIndex + 1} of ${selectedFamilyCandidates.length}.`)
    }

    if (familyFilter && selectedCandidate.dedupe_key === familyFilter) {
      parts.push('Family focus active.')
    }

    if (selectedIds.length > 0) {
      parts.push(`${selectedIds.length} row${selectedIds.length === 1 ? '' : 's'} selected for bulk actions.`)
    }

    return parts.join(' ')
  }, [candidateInsights, familyFilter, hiddenSelectedCandidate, pendingCandidates.length, selectedCandidate, selectedCandidateIndex, selectedFamilyCandidates.length, selectedFamilyIndex, selectedIds.length, selectedPendingIndex, sortedCandidates.length])

  const selectedCandidateDetailDescription = useMemo(() => {
    if (hiddenSelectedCandidate) {
      return `${getDisplayTitle(hiddenSelectedCandidate)} is selected, but hidden by the current slice. Status ${REVIEW_STATUS_LABELS[hiddenSelectedCandidate.review_status]}. Source ${getSourceLabel(hiddenSelectedCandidate)}.`
    }

    if (!selectedCandidate) {
      return 'No visible candidate is selected in the review detail panel yet.'
    }

    const insight = candidateInsights.get(selectedCandidate.id)
    const parts = [
      `${getDisplayTitle(selectedCandidate)} is selected.`,
      `Visible row ${selectedCandidateIndex + 1} of ${sortedCandidates.length}.`,
      `Status ${REVIEW_STATUS_LABELS[selectedCandidate.review_status]}.`,
    ]

    if (selectedPendingIndex >= 0) {
      parts.push(`Pending row ${selectedPendingIndex + 1} of ${pendingCandidates.length}.`)
    }

    if (insight) {
      parts.push(`${getTriageLabel(insight.triageLevel)}.`)
      parts.push(`Suggested action ${getDecisionLabel(getCandidateDecisionHint(selectedCandidate, insight))}.`)
    }

    if (selectedCandidate.dedupe_key && selectedFamilyIndex >= 0) {
      parts.push(`Family row ${selectedFamilyIndex + 1} of ${selectedFamilyCandidates.length}.`)
    }

    return parts.join(' ')
  }, [candidateInsights, hiddenSelectedCandidate, pendingCandidates.length, selectedCandidate, selectedCandidateIndex, selectedFamilyCandidates.length, selectedFamilyIndex, selectedPendingIndex, sortedCandidates.length])

  const nextDuplicateFamily = useMemo(() => {
    const currentFamilyKey = familyFilter ?? selectedCandidate?.dedupe_key ?? null
    return getAdjacentPendingDuplicateFamily(duplicateFamilies, currentFamilyKey, 'next')
  }, [duplicateFamilies, familyFilter, selectedCandidate])

  const previousDuplicateFamily = useMemo(() => {
    const currentFamilyKey = familyFilter ?? selectedCandidate?.dedupe_key ?? null
    return getAdjacentPendingDuplicateFamily(duplicateFamilies, currentFamilyKey, 'previous')
  }, [duplicateFamilies, familyFilter, selectedCandidate])

  useEffect(() => {
    if (!selectedCandidate) {
      setSelectedCanonicalDrillId(null)
      return
    }

    setSelectedCanonicalDrillId((current) => {
      if (current && matchedDrills.some((drill) => drill.id === current)) {
        return current
      }

      return matchedDrills[0]?.id ?? null
    })
  }, [matchedDrills, selectedCandidate])

  useEffect(() => {
    setActionError(null)
  }, [selectedCandidate?.id])

  useEffect(() => {
    if (!isMergeTargetActionError(actionError) || !canRunMergeAction) {
      return
    }

    setActionError(null)
  }, [actionError, canRunMergeAction])

  useEffect(() => {
    if (!isMergeTargetActionError(actionError)) {
      return
    }

    focusPreferredMergeTargetSelect()
  }, [actionError, focusPreferredMergeTargetSelect])

  const selectedFamilyWorkspace = useMemo(() => {
    if (!selectedCandidate || !selectedCandidate.dedupe_key || selectedFamilyCandidates.length === 0) {
      return null
    }

    const ranked = [...selectedFamilyCandidates]
      .map((candidate) => ({
        candidate,
        insight: candidateInsights.get(candidate.id),
      }))
      .filter((item): item is { candidate: RawDrillCandidate; insight: CandidateInsight } => Boolean(item.insight))
      .sort((left, right) => {
        return (
          right.insight.triageScore - left.insight.triageScore ||
          right.insight.completenessScore - left.insight.completenessScore ||
          STATUS_SORT_ORDER[left.candidate.review_status] - STATUS_SORT_ORDER[right.candidate.review_status] ||
          getDisplayTitle(left.candidate).localeCompare(getDisplayTitle(right.candidate))
        )
      })

    if (ranked.length === 0) return null

    const keepCandidate =
      ranked.find(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'keep')?.candidate ?? ranked[0].candidate

    const decisionCounts = ranked.reduce<Record<FamilyDecision, number>>(
      (acc, { candidate, insight }) => {
        acc[getCandidateDecisionHint(candidate, insight)] += 1
        return acc
      },
      { keep: 0, merge: 0, reject: 0 }
    )

    const pendingRanked = ranked.filter(({ candidate }) => candidate.review_status === 'pending')
    const pendingCount = pendingRanked.length
    const pendingFamilyIds = pendingRanked.map(({ candidate }) => candidate.id)
    const pendingKeepIds = pendingRanked
      .filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'keep')
      .map(({ candidate }) => candidate.id)
    const pendingMergeIds = pendingRanked
      .filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'merge')
      .map(({ candidate }) => candidate.id)
    const pendingRejectIds = pendingRanked
      .filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'reject')
      .map(({ candidate }) => candidate.id)
    const nextMergeCandidate =
      ranked.find(
        ({ candidate, insight }) =>
          candidate.id !== keepCandidate.id && candidate.review_status === 'pending' && getCandidateDecisionHint(candidate, insight) === 'merge'
      )?.candidate ?? null
    const nextRejectCandidate = ranked.find(({ candidate, insight }) => candidate.review_status === 'pending' && getCandidateDecisionHint(candidate, insight) === 'reject')?.candidate ?? null

    const handoffLines = [
      `Family: ${selectedCandidate.dedupe_key}`,
      `Suggested canonical seed: ${getDisplayTitle(keepCandidate)} (${keepCandidate.id})`,
      `Visible family rows: ${ranked.length} (${pendingCount} pending)`,
      `Suggested split: keep ${decisionCounts.keep}, merge ${decisionCounts.merge}, reject ${decisionCounts.reject}`,
      '',
      'Review steps:',
      `1. Start with ${getDisplayTitle(keepCandidate)} as the cleanest base shape.`,
      '2. Fold overlapping rows into that canonical drill if they add useful detail.',
      '3. Reject noisy duplicates that do not add anything reusable.',
      '',
      'Suggested bot payload:',
      JSON.stringify(
        {
          target_family: selectedCandidate.dedupe_key,
          keep_ids: ranked.filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'keep').map(({ candidate }) => candidate.id),
          merge_ids: ranked.filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'merge').map(({ candidate }) => candidate.id),
          reject_ids: ranked.filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'reject').map(({ candidate }) => candidate.id),
        },
        null,
        2
      ),
    ]

    return {
      ranked,
      keepCandidate,
      nextMergeCandidate,
      nextRejectCandidate,
      decisionCounts,
      pendingCount,
      pendingFamilyIds,
      pendingKeepIds,
      pendingMergeIds,
      pendingRejectIds,
      handoffText: handoffLines.join('\n'),
    }
  }, [candidateInsights, selectedCandidate, selectedFamilyCandidates])

  const selectedFamilyPendingCandidates = useMemo(
    () => selectedFamilyCandidates.filter((candidate) => candidate.review_status === 'pending'),
    [selectedFamilyCandidates]
  )
  const selectedFamilyPendingIndex =
    selectedCandidate && selectedCandidate.review_status === 'pending'
      ? selectedFamilyPendingCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id)
      : -1
  const pendingRowsAfterCurrent = selectedPendingIndex >= 0 ? Math.max(pendingCandidates.length - selectedPendingIndex - 1, 0) : pendingCandidates.length
  const familyPendingRowsAfterCurrent =
    selectedFamilyPendingIndex >= 0 ? Math.max(selectedFamilyPendingCandidates.length - selectedFamilyPendingIndex - 1, 0) : selectedFamilyPendingCandidates.length

  const selectedCandidateRelatedSlices = useMemo(() => {
    if (!selectedCandidate) return []

    const insight = candidateInsights.get(selectedCandidate.id)
    if (!insight) return []

    const suggestedAction = getCandidateDecisionHint(selectedCandidate, insight)
    const completenessBand = getCompletenessBand(insight)
    const selectedAiDecision = getAiDecisionFilterValue(selectedCandidate.ai_decision ?? null)
    const gradeValue = selectedCandidate.grade_level ?? 'unassigned'

    type RelatedQueueSlice = {
      key: string
      label: string
      count: number
      detail: string
      leadCandidate: RawDrillCandidate | null
      nextOtherCandidate: RawDrillCandidate | null
      isActive: boolean
      onClick: () => void
      openLeadRow: () => void
      openNextOtherRow: () => void
      handoffText: string
    }

    const buildRelatedSlice = (
      key: string,
      label: string,
      detail: string,
      isActive: boolean,
      onClick: () => void,
      matchingCandidates: RawDrillCandidate[]
    ): RelatedQueueSlice => {
      const leadCandidate = matchingCandidates[0] ?? null
      const nextOtherCandidate = matchingCandidates.find((candidate) => candidate.id !== selectedCandidate.id) ?? null
      const handoffLines = [
        `Related queue slice: ${label}`,
        `Matched detail: ${detail}`,
        `Selected candidate: ${getDisplayTitle(selectedCandidate)}`,
        `Pending rows in slice: ${matchingCandidates.length}`,
        `Slice state: ${isActive ? 'Already active in review queue' : 'Not active in review queue'}`,
      ]

      if (leadCandidate) {
        const leadInsight = candidateInsights.get(leadCandidate.id)

        handoffLines.push(`Lead row: ${getDisplayTitle(leadCandidate)}`)
        handoffLines.push(`Lead source: ${getSourceLabel(leadCandidate)}`)

        if (leadInsight) {
          handoffLines.push(`Lead status: ${REVIEW_STATUS_LABELS[leadCandidate.review_status]} • ${getTriageLabel(leadInsight.triageLevel)}`)
        } else {
          handoffLines.push(`Lead status: ${REVIEW_STATUS_LABELS[leadCandidate.review_status]}`)
        }
      } else {
        handoffLines.push('Lead row: No pending row in this slice yet')
      }

      handoffLines.push(
        nextOtherCandidate
          ? `Next other row: ${getDisplayTitle(nextOtherCandidate)}`
          : 'Next other row: No other pending row in this slice yet'
      )
      handoffLines.push(isActive ? 'Reviewer move: clear this slice to return to the wider queue.' : 'Reviewer move: focus this slice and open the lead row.')

      return {
        key,
        label,
        count: matchingCandidates.length,
        detail,
        leadCandidate,
        nextOtherCandidate,
        isActive,
        onClick,
        openLeadRow: () => {
          onClick()
          if (leadCandidate) {
            openCandidateInQueue(leadCandidate.id)
          }
        },
        openNextOtherRow: () => {
          onClick()
          if (nextOtherCandidate) {
            openCandidateInQueue(nextOtherCandidate.id)
          }
        },
        handoffText: handoffLines.join('\n'),
      }
    }

    const relatedSlices = [
      buildRelatedSlice(
        'action',
        'Suggested action lane',
        getDecisionLabel(suggestedAction),
        suggestedActionFilter === suggestedAction,
        () => toggleSuggestedActionFocus(suggestedAction),
        basePendingCandidates.filter((candidate) => {
          const relatedInsight = candidateInsights.get(candidate.id)
          return relatedInsight ? getCandidateDecisionHint(candidate, relatedInsight) === suggestedAction : false
        })
      ),
      buildRelatedSlice(
        'completeness',
        'Completeness slice',
        COMPLETENESS_BAND_LABELS[completenessBand],
        completenessFilter === completenessBand,
        () => toggleCompletenessFocus(completenessBand),
        basePendingCandidates.filter((candidate) => {
          const relatedInsight = candidateInsights.get(candidate.id)
          return relatedInsight ? getCompletenessBand(relatedInsight) === completenessBand : false
        })
      ),
      buildRelatedSlice(
        'grade',
        'Grade slice',
        formatGradeLevel(selectedCandidate.grade_level),
        gradeFilter === gradeValue,
        () => toggleGradeFocus(gradeValue),
        basePendingCandidates.filter((candidate) => (candidate.grade_level ?? 'unassigned') === gradeValue)
      ),
      buildRelatedSlice(
        'difficulty',
        'Difficulty slice',
        formatDifficultyLabel(selectedCandidate.difficulty),
        difficultyFilter === (selectedCandidate.difficulty || 'unassigned'),
        () => toggleDifficultyFocus(selectedCandidate.difficulty || 'unassigned'),
        basePendingCandidates.filter((candidate) => (candidate.difficulty || 'unassigned') === (selectedCandidate.difficulty || 'unassigned'))
      ),
      buildRelatedSlice(
        'status',
        'Review status slice',
        REVIEW_STATUS_LABELS[selectedCandidate.review_status],
        statusFilter === selectedCandidate.review_status,
        () => toggleStatusFocus(selectedCandidate.review_status),
        basePendingCandidates.filter((candidate) => candidate.review_status === selectedCandidate.review_status)
      ),
      buildRelatedSlice(
        'ai',
        'AI recommendation lane',
        getAiDecisionFilterLabel(selectedAiDecision),
        aiDecisionFilter === selectedAiDecision,
        () => toggleAiDecisionFocus(selectedAiDecision),
        basePendingCandidates.filter((candidate) => getAiDecisionFilterValue(candidate.ai_decision ?? null) === selectedAiDecision)
      ),
      selectedCandidate.category
        ? buildRelatedSlice(
            'category',
            'Category slice',
            selectedCandidate.category,
            categoryFilter === selectedCandidate.category,
            () => toggleCategoryFocus(selectedCandidate.category!, selectedCandidate.id),
            basePendingCandidates.filter((candidate) => candidate.category === selectedCandidate.category)
          )
        : null,
      buildRelatedSlice(
        'source',
        'Source slice',
        getSourceLabel(selectedCandidate),
        sourceFilter === getSourceLabel(selectedCandidate),
        () => toggleSourceFocus(getSourceLabel(selectedCandidate), selectedCandidate.id),
        basePendingCandidates.filter((candidate) => getSourceLabel(candidate) === getSourceLabel(selectedCandidate))
      ),
    ].filter((item): item is RelatedQueueSlice => Boolean(item))

    return relatedSlices.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  }, [
    aiDecisionFilter,
    basePendingCandidates,
    candidateInsights,
    categoryFilter,
    completenessFilter,
    difficultyFilter,
    gradeFilter,
    openCandidateInQueue,
    selectCandidate,
    selectedCandidate,
    sourceFilter,
    statusFilter,
    suggestedActionFilter,
    toggleAiDecisionFocus,
    toggleCategoryFocus,
    toggleCompletenessFocus,
    toggleDifficultyFocus,
    toggleGradeFocus,
    toggleSourceFocus,
    toggleStatusFocus,
    toggleSuggestedActionFocus,
  ])

  const copyFamilyHandoff = useCallback(() => {
    if (!selectedFamilyWorkspace) return
    void copyText(selectedFamilyWorkspace.handoffText, 'Copied family review notes')
  }, [copyText, selectedFamilyWorkspace])

  const bulkSelectionCounts = visibleSelectedIds.reduce<Record<ReviewStatus, number>>(
    (acc, id) => {
      const candidate = sortedCandidates.find((item) => item.id === id)
      if (!candidate) return acc
      acc[candidate.review_status] += 1
      return acc
    },
    { pending: 0, approved: 0, merged: 0, rejected: 0 }
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }, [])

  const toggleSelectedBatch = useCallback((ids: string[]) => {
    if (ids.length === 0) return

    const uniqueIds = Array.from(new Set(ids))
    setSelectedIds((current) => {
      const allSelected = uniqueIds.every((id) => current.includes(id))

      if (allSelected) {
        return current.filter((id) => !uniqueIds.includes(id))
      }

      return Array.from(new Set([...current, ...uniqueIds]))
    })
  }, [])

  const clearSelectedRows = useCallback(() => {
    setSelectedIds([])
  }, [])

  const toggleSelectPendingFamilyRows = useCallback(() => {
    const pendingFamilyIds = selectedFamilyPendingCandidates.map((candidate) => candidate.id)
    if (pendingFamilyIds.length === 0) return
    toggleSelectedBatch(pendingFamilyIds)
  }, [selectedFamilyPendingCandidates, toggleSelectedBatch])

  const toggleSelectAllVisiblePending = useCallback(() => {
    const pendingIds = pendingCandidates.map((candidate) => candidate.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => visibleSelectedIds.includes(id))

    setSelectedIds((current) => {
      const withoutVisiblePending = current.filter((id) => !pendingIds.includes(id))
      return allSelected ? withoutVisiblePending : [...withoutVisiblePending, ...pendingIds]
    })
  }, [pendingCandidates, visibleSelectedIds])

  const hasActiveViewModifiers = Boolean(
    selectedIds.length > 0 ||
    query.trim() ||
      statusFilter !== 'pending' ||
      gradeFilter !== 'all' ||
      difficultyFilter !== 'all' ||
      categoryFilter !== 'all' ||
      sourceFilter !== 'all' ||
      aiDecisionFilter !== 'all' ||
      triageFilter !== 'all' ||
      completenessFilter !== 'all' ||
      suggestedActionFilter !== 'all' ||
      familyShapeFilter !== 'all' ||
      familyFilter ||
      sortMode !== 'triage' ||
      scopedCandidateIds
  )

  const lastActiveViewModifierLabel = useMemo(() => {
    if (selectedIds.length > 0) {
      return `Selection: ${selectedIds.length} row${selectedIds.length === 1 ? '' : 's'}`
    }
    if (scopedCandidateIds) {
      return `Scope: ${scopeRequestedCount} linked row${scopeRequestedCount === 1 ? '' : 's'}`
    }
    if (sortMode !== 'triage') {
      return `Sort: ${SORT_MODE_LABELS[sortMode]}`
    }
    if (familyFilter) {
      return `Family: ${familyFilter}`
    }
    if (familyShapeFilter !== 'all') {
      return `Family shape: ${DUPLICATE_SHAPE_LABELS[familyShapeFilter]}`
    }
    if (suggestedActionFilter !== 'all') {
      return `Suggested action: ${getSuggestedActionFilterLabel(suggestedActionFilter)}`
    }
    if (completenessFilter !== 'all') {
      return `Completeness: ${COMPLETENESS_BAND_LABELS[completenessFilter]}`
    }
    if (triageFilter !== 'all') {
      return `Triage: ${getTriageLabel(triageFilter)}`
    }
    if (aiDecisionFilter !== 'all') {
      return `AI recommendation: ${getAiDecisionFilterLabel(aiDecisionFilter)}`
    }
    if (sourceFilter !== 'all') {
      return `Source: ${sourceFilter}`
    }
    if (categoryFilter !== 'all') {
      return `Category: ${categoryFilter}`
    }
    if (difficultyFilter !== 'all') {
      return `Difficulty: ${formatDifficultyLabel(difficultyFilter)}`
    }
    if (gradeFilter !== 'all') {
      return `Grade: ${formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}`
    }
    if (statusFilter !== 'pending') {
      return `Status: ${statusFilter === 'all' ? 'All statuses' : REVIEW_STATUS_LABELS[statusFilter]}`
    }
    if (query.trim()) {
      return `Search: ${query.trim()}`
    }

    return null
  }, [
    aiDecisionFilter,
    categoryFilter,
    completenessFilter,
    difficultyFilter,
    familyFilter,
    familyShapeFilter,
    gradeFilter,
    query,
    scopeRequestedCount,
    scopedCandidateIds,
    selectedIds.length,
    sortMode,
    sourceFilter,
    statusFilter,
    suggestedActionFilter,
    triageFilter,
  ])

  const clearLastViewModifier = useCallback(() => {
    if (selectedIds.length > 0) {
      clearSelectedRows()
      return
    }
    if (scopedCandidateIds) {
      clearScopedReview()
      return
    }
    if (sortMode !== 'triage') {
      setSortMode('triage')
      return
    }
    if (familyFilter) {
      setFamilyFilter(null)
      return
    }
    if (familyShapeFilter !== 'all') {
      setFamilyShapeFilter('all')
      return
    }
    if (suggestedActionFilter !== 'all') {
      setSuggestedActionFilter('all')
      return
    }
    if (completenessFilter !== 'all') {
      setCompletenessFilter('all')
      return
    }
    if (triageFilter !== 'all') {
      setTriageFilter('all')
      return
    }
    if (aiDecisionFilter !== 'all') {
      setAiDecisionFilter('all')
      return
    }
    if (sourceFilter !== 'all') {
      setSourceFilter('all')
      return
    }
    if (categoryFilter !== 'all') {
      setCategoryFilter('all')
      return
    }
    if (difficultyFilter !== 'all') {
      setDifficultyFilter('all')
      return
    }
    if (gradeFilter !== 'all') {
      setGradeFilter('all')
      return
    }
    if (statusFilter !== 'pending') {
      setStatusFilter('pending')
      return
    }
    if (query.trim()) {
      setQuery('')
    }
  }, [
    aiDecisionFilter,
    categoryFilter,
    clearScopedReview,
    completenessFilter,
    difficultyFilter,
    familyFilter,
    familyShapeFilter,
    gradeFilter,
    query,
    scopedCandidateIds,
    selectedIds.length,
    sortMode,
    sourceFilter,
    statusFilter,
    suggestedActionFilter,
    triageFilter,
  ])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()

      if (!event.altKey && !event.shiftKey && key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key === 'Escape') {
        if (showShortcutHelp) {
          event.preventDefault()
          setShowShortcutHelp(false)

          const queueCandidate = selectedCandidate ?? sortedCandidates[0]
          if (queueCandidate) {
            window.setTimeout(() => {
              focusCandidateRow(queueCandidate.id, { reveal: true })
            }, 0)
          }
          return
        }

        if (actionError || copyFeedback) {
          event.preventDefault()
          setActionError(null)
          setCopyFeedback(null)

          const queueCandidate = selectedCandidate ?? sortedCandidates[0]
          if (queueCandidate) {
            window.requestAnimationFrame(() => {
              focusCandidateRow(queueCandidate.id, { reveal: true })
            })
          }
          return
        }

        const isSearchFocused = event.target === searchInputRef.current

        if (isSearchFocused) {
          event.preventDefault()
          if (query) {
            setQuery('')
          } else {
            searchInputRef.current?.blur()
            const queueCandidate = selectedCandidate ?? sortedCandidates[0]
            if (queueCandidate) {
              focusCandidateRow(queueCandidate.id, { reveal: true })
            }
          }
          return
        }

        const isDetailPanelFocused =
          event.target instanceof Node &&
          detailPanelRef.current instanceof HTMLElement &&
          detailPanelRef.current.contains(event.target)

        if (isDetailPanelFocused) {
          const queueCandidate = selectedCandidate ?? sortedCandidates[0]
          if (queueCandidate) {
            event.preventDefault()
            focusCandidateRow(queueCandidate.id, { reveal: true })
            return
          }
        }

        if (selectedIds.length > 0) {
          event.preventDefault()
          clearSelectedRows()
          return
        }

        if (familyFilter) {
          event.preventDefault()
          clearFamilyFocus()
          return
        }

        if (hasActiveViewModifiers) {
          event.preventDefault()
          clearAllViewFilters()
          return
        }

        const candidateIdFromTarget = getCandidateIdFromTarget(event.target)
        if (candidateIdFromTarget) {
          event.preventDefault()
          selectCandidate(candidateIdFromTarget, { scrollIntoView: false })
          focusCandidateRow(candidateIdFromTarget)
          return
        }

        const escapeTargetContext = getShortcutTargetContext(event.target)
        const queueCandidate = selectedCandidate ?? sortedCandidates[0]
        if (escapeTargetContext !== 'none' && queueCandidate) {
          event.preventDefault()
          focusCandidateRow(queueCandidate.id, { reveal: true })
        }

        return
      }

      const shortcutTargetContext = getShortcutTargetContext(event.target)
      const candidateIdFromTarget = getCandidateIdFromTarget(event.target)
      const shouldKeepQueueFocus = shortcutTargetContext === 'row-control' || Boolean(candidateIdFromTarget)

      if (shortcutTargetContext === 'text-entry' || shortcutTargetContext === 'interactive') {
        return
      }

      if (shortcutTargetContext === 'row-control' && (event.key === 'Enter' || event.key === ' ')) {
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        setShowShortcutHelp((current) => !current)
        return
      }

      if (showShortcutHelp) {
        return
      }

      if (key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (key === '0') {
        if (!hasActiveViewModifiers) return
        event.preventDefault()
        clearAllViewFilters()
        return
      }

      if (event.key === 'Backspace') {
        if (selectedIds.length === 0 && !lastActiveViewModifierLabel) return
        event.preventDefault()

        if (selectedIds.length > 0) {
          clearSelectedRows()
          return
        }

        clearLastViewModifier()
        return
      }

      if (event.shiftKey && key === 'x') {
        event.preventDefault()
        toggleSelectAllVisiblePending()
        return
      }

      if (event.shiftKey && key === 'f') {
        event.preventDefault()
        toggleSelectPendingFamilyRows()
        return
      }

      if (event.shiftKey && key === 'a') {
        event.preventDefault()
        if (actionableSelectedIds.length === 0) return

        runReviewAction({
          action: 'approve',
          candidateIds: actionableSelectedIds,
          successLabel:
            actionableSelectedIds.length === 1
              ? 'Approved candidate into the drill library.'
              : `Approved ${actionableSelectedIds.length} candidates into the drill library.`,
        })
        return
      }

      if (event.shiftKey && key === 'r') {
        event.preventDefault()
        if (actionableSelectedIds.length === 0) return

        runReviewAction({
          action: 'reject',
          candidateIds: actionableSelectedIds,
          successLabel: actionableSelectedIds.length === 1 ? 'Rejected candidate.' : `Rejected ${actionableSelectedIds.length} candidates.`,
        })
        return
      }

      if (event.shiftKey && key === 'm') {
        event.preventDefault()
        if (actionableSelectedIds.length === 0) return
        if (!canRunMergeAction || !preferredMergeTargetId) {
          setActionError(mergeTargetPrompt)
          return
        }

        runReviewAction({
          action: 'merge',
          candidateIds: actionableSelectedIds,
          canonicalDrillId: preferredMergeTargetId,
          successLabel:
            actionableSelectedIds.length === 1
              ? 'Merged candidate into the selected drill.'
              : `Merged ${actionableSelectedIds.length} candidates into the selected drill.`,
        })
        return
      }

      if (key === 'g' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        if (sortedCandidates.length === 0) return

        const targetCandidate = event.key === 'End' || (key === 'g' && event.shiftKey) ? sortedCandidates[sortedCandidates.length - 1] : sortedCandidates[0]
        moveKeyboardSelection(targetCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault()
        if (sortedCandidates.length === 0) return

        const targetCandidate = getOffsetCandidate(sortedCandidates, selectedCandidateId, event.key === 'PageDown' ? 10 : -10)
        moveKeyboardSelection(targetCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (key === 'j' || key === 'k' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (sortedCandidates.length === 0) return

        const shouldMoveForward = key === 'j' || event.key === 'ArrowDown'
        const adjacentCandidate = getAdjacentCandidate(sortedCandidates, selectedCandidateId, shouldMoveForward ? 'next' : 'previous')

        moveKeyboardSelection(adjacentCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (key === 'n') {
        event.preventDefault()
        moveKeyboardSelection(nextPendingCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (key === 'p') {
        event.preventDefault()
        moveKeyboardSelection(previousPendingCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (key === 'l') {
        event.preventDefault()
        moveKeyboardSelection(leadVisibleCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (key === 'x' || event.key === ' ') {
        event.preventDefault()
        if (selectedCandidateId) {
          toggleSelected(selectedCandidateId)
        }
        return
      }

      if (key === 'c') {
        event.preventDefault()
        if (selectedIds.length > 0) {
          clearSelectedRows()
        }
        return
      }

      if (key === 'f') {
        event.preventDefault()

        if (!selectedCandidate?.dedupe_key) {
          return
        }

        if (familyFilter === selectedCandidate.dedupe_key) {
          clearFamilyFocus()
        } else {
          focusFamily(selectedCandidate.dedupe_key, selectedCandidate.id)
        }
        return
      }

      if (event.key === ']') {
        event.preventDefault()
        if (nextDuplicateFamily) {
          focusFamily(nextDuplicateFamily.dedupeKey, nextDuplicateFamily.leadCandidate?.id ?? null)

          if (shouldKeepQueueFocus && nextDuplicateFamily.leadCandidate?.id) {
            window.requestAnimationFrame(() => {
              focusCandidateRow(nextDuplicateFamily.leadCandidate?.id ?? '')
            })
          }
        }
        return
      }

      if (event.key === '[') {
        event.preventDefault()
        if (previousDuplicateFamily) {
          focusFamily(previousDuplicateFamily.dedupeKey, previousDuplicateFamily.leadCandidate?.id ?? null)

          if (shouldKeepQueueFocus && previousDuplicateFamily.leadCandidate?.id) {
            window.requestAnimationFrame(() => {
              focusCandidateRow(previousDuplicateFamily.leadCandidate?.id ?? '')
            })
          }
        }
        return
      }

      if (event.key === '.') {
        event.preventDefault()
        moveKeyboardSelection(nextFamilyCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (event.key === ',') {
        event.preventDefault()
        moveKeyboardSelection(previousFamilyCandidate?.id ?? null, { focusQueueRow: shouldKeepQueueFocus })
        return
      }

      if (event.key === 'ArrowLeft' || event.key === ';') {
        event.preventDefault()
        cycleMergeTarget('previous')
        return
      }

      if (event.key === 'ArrowRight' || event.key === "'") {
        event.preventDefault()
        cycleMergeTarget('next')
        return
      }

      if (event.shiftKey && key === 'h') {
        event.preventDefault()
        copyFamilyHandoff()
        return
      }

      if (key === 'h') {
        event.preventDefault()
        void copyText(currentSliceSummary.handoffText, 'Copied review queue handoff')
        return
      }

      if (key === 'v') {
        event.preventDefault()
        copyCurrentView(scopedCandidateIds ? 'Copied scoped review view link' : 'Copied review queue view link')
        return
      }

      if (key === 'y') {
        event.preventDefault()

        if (event.shiftKey) {
          if (!selectedMergeHandoff) return
          void copyText(selectedMergeHandoff, 'Copied selected merge handoff')
          return
        }

        if (!selectedCandidateHandoff) return
        void copyText(selectedCandidateHandoff, 'Copied selected candidate handoff')
        return
      }

      const requestedRoute =
        key === REVIEW_ROUTE_SHORTCUTS['approve-ready']
          ? 'approve-ready'
          : key === REVIEW_ROUTE_SHORTCUTS['merge-sweep']
            ? 'merge-sweep'
            : key === REVIEW_ROUTE_SHORTCUTS['thin-cleanup']
              ? 'thin-cleanup'
              : null

      if (requestedRoute) {
        event.preventDefault()
        const route = reviewRoutes.find((item) => item.key === requestedRoute)
        if (!route || route.count === 0) return

        applyReviewRoute(route.key)
        if (route.leadCandidate) {
          shouldScrollSelectedCandidateIntoViewRef.current = true
          shouldFocusSelectedCandidateRowRef.current = shouldKeepQueueFocus
          selectCandidate(route.leadCandidate.id, { scrollIntoView: false })
        }
        return
      }

      if (key === 'o') {
        event.preventDefault()
        cycleSortMode(event.shiftKey ? 'previous' : 'next')
        return
      }

      if (key === 'b') {
        event.preventDefault()
        if (!selectedCandidate) return
        toggleSourceFocus(getSourceLabel(selectedCandidate), selectedCandidate.id)
        return
      }

      if (key === 't') {
        event.preventDefault()
        if (!selectedCandidate?.category) return
        toggleCategoryFocus(selectedCandidate.category, selectedCandidate.id)
        return
      }

      if (key === 'd') {
        event.preventDefault()
        if (!selectedCandidate?.difficulty) return
        toggleDifficultyFocus(selectedCandidate.difficulty, selectedCandidate.id)
        return
      }

      if (key === 'i') {
        event.preventDefault()
        if (!selectedCandidate) return
        toggleAiDecisionFocus(getAiDecisionFilterValue(selectedCandidate.ai_decision ?? null))
        return
      }

      if (key === 'e') {
        event.preventDefault()
        if (!selectedCandidate) return
        toggleGradeFocus(selectedCandidate.grade_level ?? 'unassigned')
        return
      }

      if (key === 'u') {
        event.preventDefault()
        if (!selectedCandidate) return
        toggleStatusFocus(selectedCandidate.review_status)
        return
      }

      const mergeTargetShortcutIndex = MERGE_TARGET_SHORTCUT_KEYS.indexOf(key as (typeof MERGE_TARGET_SHORTCUT_KEYS)[number])
      if (mergeTargetShortcutIndex !== -1) {
        const shortcutTarget = matchedDrills[mergeTargetShortcutIndex]
        if (!shortcutTarget) return

        event.preventDefault()
        setSelectedCanonicalDrillId(shortcutTarget.id)
        return
      }

      if (key === 'a') {
        event.preventDefault()
        if (!selectedCandidateId || !selectedCandidate) return
        if (selectedCandidate.review_status !== 'pending') {
          setActionError(`This candidate is already ${REVIEW_STATUS_LABELS[selectedCandidate.review_status].toLowerCase()}. Select a pending row to review it again.`)
          return
        }

        runReviewAction({
          action: 'approve',
          candidateIds: [selectedCandidateId],
          successLabel: 'Approved candidate into the drill library.',
        })
        return
      }

      if (key === 'r') {
        event.preventDefault()
        if (!selectedCandidateId || !selectedCandidate) return
        if (selectedCandidate.review_status !== 'pending') {
          setActionError(`This candidate is already ${REVIEW_STATUS_LABELS[selectedCandidate.review_status].toLowerCase()}. Select a pending row to review it again.`)
          return
        }

        runReviewAction({
          action: 'reject',
          candidateIds: [selectedCandidateId],
          successLabel: 'Rejected candidate.',
        })
        return
      }

      if (key === 'm') {
        event.preventDefault()
        if (!selectedCandidateId || !selectedCandidate) return
        if (selectedCandidate.review_status !== 'pending') {
          setActionError(`This candidate is already ${REVIEW_STATUS_LABELS[selectedCandidate.review_status].toLowerCase()}. Select a pending row to review it again.`)
          return
        }
        if (!canRunMergeAction || !preferredMergeTargetId) {
          setActionError(mergeTargetPrompt)
          return
        }

        runReviewAction({
          action: 'merge',
          candidateIds: [selectedCandidateId],
          canonicalDrillId: preferredMergeTargetId,
          successLabel: 'Merged candidate into the selected drill.',
        })
        return
      }

      if (event.key === 'Enter' || key === 's') {
        event.preventDefault()
        if (!selectedCandidate) return
        if (selectedCandidate.review_status !== 'pending') {
          setActionError(`This candidate is already ${REVIEW_STATUS_LABELS[selectedCandidate.review_status].toLowerCase()}. Select a pending row to review it again.`)
          return
        }

        const insight = candidateInsights.get(selectedCandidate.id)
        if (!insight) return

        const suggestedAction = getCandidateDecisionHint(selectedCandidate, insight)

        if (suggestedAction === 'keep') {
          runReviewAction({
            action: 'approve',
            candidateIds: [selectedCandidate.id],
            successLabel: 'Applied suggested action and approved candidate into the drill library.',
          })
          return
        }

        if (suggestedAction === 'reject') {
          runReviewAction({
            action: 'reject',
            candidateIds: [selectedCandidate.id],
            successLabel: 'Applied suggested action and rejected candidate.',
          })
          return
        }

        if (!canRunMergeAction || !preferredMergeTargetId) {
          setActionError(mergeTargetPrompt)
          return
        }

        runReviewAction({
          action: 'merge',
          candidateIds: [selectedCandidate.id],
          canonicalDrillId: preferredMergeTargetId,
          successLabel: 'Applied suggested action and merged candidate into the selected drill.',
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    actionableSelectedIds,
    aiDecisionFilter,
    applyReviewRoute,
    canRunMergeAction,
    candidateInsights,
    categoryFilter,
    clearAllViewFilters,
    clearFamilyFocus,
    clearLastViewModifier,
    clearSelectedRows,
    completenessFilter,
    copyFeedback,
    copyFamilyHandoff,
    copyText,
    currentSliceSummary.handoffText,
    copyCurrentView,
    cycleMergeTarget,
    difficultyFilter,
    familyFilter,
    familyShapeFilter,
    focusFamily,
    gradeFilter,
    hasActiveViewModifiers,
    leadVisibleCandidate,
    lastActiveViewModifierLabel,
    mergeTargetPrompt,
    matchedDrills,
    moveKeyboardSelection,
    actionError,
    nextDuplicateFamily,
    nextFamilyCandidate,
    nextPendingCandidate,
    preferredMergeTargetId,
    previousDuplicateFamily,
    previousFamilyCandidate,
    previousPendingCandidate,
    query,
    reviewRoutes,
    runReviewAction,
    scopedCandidateIds,
    searchInputRef,
    selectCandidate,
    selectedCandidate,
    selectedCandidateHandoff,
    selectedCandidateId,
    selectedMergeHandoff,
    showShortcutHelp,
    selectedIds.length,
    sortMode,
    sortedCandidates,
    sourceFilter,
    statusFilter,
    suggestedActionFilter,
    toggleAiDecisionFocus,
    toggleCategoryFocus,
    toggleDifficultyFocus,
    toggleGradeFocus,
    toggleSelectAllVisiblePending,
    toggleSelectPendingFamilyRows,
    toggleSelected,
    toggleSourceFocus,
    toggleStatusFocus,
    triageFilter,
    visibleSelectedIds.length,
  ])

  const allVisiblePendingSelected =
    pendingCandidates.length > 0 && pendingCandidates.every((candidate) => visibleSelectedIds.includes(candidate.id))

  const activeViewChips = useMemo<ActiveViewChip[]>(
    () => [
      query.trim()
        ? {
            key: 'query',
            label: `Search: ${query.trim()}`,
            clearLabel: `Clear search filter for ${query.trim()}`,
            onClear: () => setQuery(''),
          }
        : null,
      selectedIds.length > 0
        ? {
            key: 'selection',
            label:
              hiddenSelectedCount > 0
                ? `Selection: ${visibleSelectedIds.length} visible, ${hiddenSelectedCount} hidden`
                : `Selection: ${visibleSelectedIds.length} row${visibleSelectedIds.length === 1 ? '' : 's'}`,
            clearLabel: 'Clear selected review rows',
            onClear: clearSelectedRows,
          }
        : null,
      statusFilter !== 'pending'
        ? {
            key: 'status',
            label: `Status: ${statusFilter === 'all' ? 'All statuses' : REVIEW_STATUS_LABELS[statusFilter]}`,
            clearLabel: 'Clear status filter and return to pending rows',
            onClear: () => setStatusFilter('pending'),
          }
        : null,
      gradeFilter !== 'all'
        ? {
            key: 'grade',
            label: `Grade: ${formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}`,
            clearLabel: `Clear grade filter ${formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}`,
            onClear: () => setGradeFilter('all'),
          }
        : null,
      difficultyFilter !== 'all'
        ? {
            key: 'difficulty',
            label: `Difficulty: ${formatDifficultyLabel(difficultyFilter)}`,
            clearLabel: `Clear difficulty filter ${formatDifficultyLabel(difficultyFilter)}`,
            onClear: () => setDifficultyFilter('all'),
          }
        : null,
      categoryFilter !== 'all'
        ? {
            key: 'category',
            label: `Category: ${categoryFilter}`,
            clearLabel: `Clear category filter ${categoryFilter}`,
            onClear: () => setCategoryFilter('all'),
          }
        : null,
      sourceFilter !== 'all'
        ? {
            key: 'source',
            label: `Source: ${sourceFilter}`,
            clearLabel: `Clear source filter ${sourceFilter}`,
            onClear: () => setSourceFilter('all'),
          }
        : null,
      aiDecisionFilter !== 'all'
        ? {
            key: 'ai',
            label: `AI recommendation: ${getAiDecisionFilterLabel(aiDecisionFilter)}`,
            clearLabel: `Clear AI recommendation filter ${getAiDecisionFilterLabel(aiDecisionFilter)}`,
            onClear: () => setAiDecisionFilter('all'),
          }
        : null,
      triageFilter !== 'all'
        ? {
            key: 'triage',
            label: `Triage: ${getTriageLabel(triageFilter)}`,
            clearLabel: `Clear triage filter ${getTriageLabel(triageFilter)}`,
            onClear: () => setTriageFilter('all'),
          }
        : null,
      completenessFilter !== 'all'
        ? {
            key: 'completeness',
            label: `Completeness: ${COMPLETENESS_BAND_LABELS[completenessFilter]}`,
            clearLabel: `Clear completeness filter ${COMPLETENESS_BAND_LABELS[completenessFilter]}`,
            onClear: () => setCompletenessFilter('all'),
          }
        : null,
      suggestedActionFilter !== 'all'
        ? {
            key: 'action',
            label: `Suggested action: ${getSuggestedActionFilterLabel(suggestedActionFilter)}`,
            clearLabel: `Clear suggested action filter ${getSuggestedActionFilterLabel(suggestedActionFilter)}`,
            onClear: () => setSuggestedActionFilter('all'),
          }
        : null,
      familyShapeFilter !== 'all'
        ? {
            key: 'family-shape',
            label: `Family shape: ${DUPLICATE_SHAPE_LABELS[familyShapeFilter]}`,
            clearLabel: `Clear family shape filter ${DUPLICATE_SHAPE_LABELS[familyShapeFilter]}`,
            onClear: () => setFamilyShapeFilter('all'),
          }
        : null,
      familyFilter
        ? {
            key: 'family',
            label: `Family: ${familyFilter}`,
            clearLabel: `Clear family focus for ${familyFilter}`,
            onClear: () => setFamilyFilter(null),
          }
        : null,
      sortMode !== 'triage'
        ? {
            key: 'sort',
            label: `Sort: ${SORT_MODE_LABELS[sortMode]}`,
            clearLabel: `Clear sort override ${SORT_MODE_LABELS[sortMode]}`,
            onClear: () => setSortMode('triage'),
          }
        : null,
      scopedCandidateIds
        ? {
            key: 'scope',
            label: `Scope: ${scopeRequestedCount} linked row${scopeRequestedCount === 1 ? '' : 's'}`,
            clearLabel: `Clear scoped review of ${scopeRequestedCount} linked row${scopeRequestedCount === 1 ? '' : 's'}`,
            onClear: clearScopedReview,
          }
        : null,
    ].filter((chip): chip is ActiveViewChip => Boolean(chip)),
    [
      aiDecisionFilter,
      categoryFilter,
      clearScopedReview,
      clearSelectedRows,
      completenessFilter,
      difficultyFilter,
      familyFilter,
      familyShapeFilter,
      gradeFilter,
      hiddenSelectedCount,
      query,
      scopeRequestedCount,
      scopedCandidateIds,
      selectedIds.length,
      sortMode,
      sourceFilter,
      statusFilter,
      suggestedActionFilter,
      triageFilter,
      visibleSelectedIds.length,
    ]
  )

  const copyCurrentSliceHandoff = useCallback(() => {
    void copyText(currentSliceSummary.handoffText, 'Copied review queue handoff')
  }, [copyText, currentSliceSummary.handoffText])

  const copySelectedCandidateHandoff = useCallback(() => {
    if (!selectedCandidateHandoff) return
    void copyText(selectedCandidateHandoff, 'Copied selected candidate handoff')
  }, [copyText, selectedCandidateHandoff])

  const copySelectedMergeHandoff = useCallback(() => {
    if (!selectedMergeHandoff) return
    void copyText(selectedMergeHandoff, 'Copied selected merge handoff')
  }, [copyText, selectedMergeHandoff])

  const openLeadSearchResult = useCallback(() => {
    const leadCandidate = sortedCandidates[0]
    if (!leadCandidate) return

    focusCandidateInQueue(leadCandidate.id)
  }, [focusCandidateInQueue, sortedCandidates])

  const searchStatusMessage = useMemo(() => {
    const visibleCountLabel = `${sortedCandidates.length} visible candidate${sortedCandidates.length === 1 ? '' : 's'} in the current review slice.`
    const trimmedQuery = query.trim()

    if (!sortedCandidates.length) {
      return trimmedQuery
        ? `No visible candidates match “${trimmedQuery}”. ${hiddenSelectedCandidate ? `${getDisplayTitle(hiddenSelectedCandidate)} is currently outside this slice.` : 'Try clearing a filter or search term.'}`
        : `${visibleCountLabel} No lead candidate is currently visible.`
    }

    const leadCandidate = sortedCandidates[0]
    const leadLabel = `Lead result: ${getDisplayTitle(leadCandidate)}.`

    if (trimmedQuery) {
      return `${visibleCountLabel} Search query “${trimmedQuery}”. ${leadLabel}`
    }

    return `${visibleCountLabel} ${leadLabel}`
  }, [hiddenSelectedCandidate, query, sortedCandidates])

  const mergeTargetAnnouncement = useMemo(() => {
    if (!selectedCandidate) return 'No review row selected.'

    if (matchedDrills.length === 0) {
      return `No merge targets surfaced for ${getDisplayTitle(selectedCandidate)}.`
    }

    if (!preferredMergeTargetId || !preferredMergeTarget) {
      return `Merge targets are available for ${getDisplayTitle(selectedCandidate)}, but no target is selected yet.`
    }

    const mergeTargetIndex = matchedDrills.findIndex((drill) => drill.id === preferredMergeTargetId)
    const mergeTargetCountLabel = `${mergeTargetIndex + 1} of ${matchedDrills.length}`
    const selectionTone = isUsingAutoMergeTarget ? 'Auto-selected merge target' : 'Selected merge target'
    const matchReasonLabel = preferredMergeTarget.matchReasons.slice(0, 2).join(' • ') || 'No match reasons surfaced'
    const readinessLabel = mergeTargetNeedsExplicitSelection ? 'Explicit target selection required before merging.' : 'Merge-ready with this target.'

    return `${selectionTone}: ${preferredMergeTarget.title}. Match ${mergeTargetCountLabel}. ${matchReasonLabel}. ${readinessLabel}`
  }, [isUsingAutoMergeTarget, matchedDrills, mergeTargetNeedsExplicitSelection, preferredMergeTarget, preferredMergeTargetId, selectedCandidate])

  const bulkSelectionAnnouncement = useMemo(() => {
    if (selectedIds.length === 0) {
      return 'No rows selected for bulk actions.'
    }

    const parts = [
      `${selectedIds.length} row${selectedIds.length === 1 ? '' : 's'} selected for bulk actions.`,
      `${visibleSelectedIds.length} visible in the current slice.`,
      `${actionableSelectedIds.length} visible pending row${actionableSelectedIds.length === 1 ? '' : 's'} ready right now.`,
    ]

    if (hiddenSelectedCount > 0) {
      parts.push(`${hiddenSelectedCount} hidden selected row${hiddenSelectedCount === 1 ? '' : 's'} will stay untouched until visible again.`)
    }

    if (skippedSelectedCount > 0) {
      parts.push(`${skippedSelectedCount} visible reviewed row${skippedSelectedCount === 1 ? '' : 's'} will be skipped by bulk actions.`)
    }

    if (actionableSelectedIds.length > 0) {
      parts.push(canRunMergeAction ? 'Bulk merge is ready with the current target.' : mergeTargetPrompt)
    }

    return parts.join(' ')
  }, [actionableSelectedIds.length, canRunMergeAction, hiddenSelectedCount, mergeTargetPrompt, selectedIds.length, skippedSelectedCount, visibleSelectedIds.length])

  const queueListDescription = useMemo(() => {
    const parts = [
      `${sortedCandidates.length} visible candidate${sortedCandidates.length === 1 ? '' : 's'} sorted by ${SORT_MODE_LABELS[sortMode]}.`,
      'Tab lands on the active queue row first, so you can start keyboard navigation before moving into row controls.',
      'Use J and K or the arrow keys to move between visible rows, N and P to jump through pending rows, and L to return to the lead row.',
      'Press Enter or S to apply the suggested action for the active row, X or Space to toggle bulk selection, and Escape to return focus from row controls to the active queue row.',
      'Use 1, 2, and 3 to jump into the main review routes, B, T, D, I, E, and U to pivot into the selected row context, and O or Shift plus O to cycle sort without leaving the keyboard.',
      'Use Backspace to clear bulk selection first, then peel back the most recent active view modifier, and 0 to reset the queue to the default pending triage view.',
    ]

    if (familyFilter) {
      parts.push(`Family focus is active for ${familyFilter}.`)
    }

    if (selectedIds.length > 0) {
      parts.push(`${selectedIds.length} row${selectedIds.length === 1 ? '' : 's'} currently selected for bulk actions.`)
    }

    return parts.join(' ')
  }, [familyFilter, selectedIds.length, sortMode, sortedCandidates.length])

  const currentViewCopyDescription = useMemo(() => {
    const scopeLabel = scopedCandidateIds ? `Scoped review set active with ${sortedCandidates.length} visible candidate${sortedCandidates.length === 1 ? '' : 's'} from ${scopeRequestedCount} linked raw candidate${scopeRequestedCount === 1 ? '' : 's'}.` : 'Full review queue view.'
    return `${scopeLabel} ${queueListDescription}`
  }, [queueListDescription, scopeRequestedCount, scopedCandidateIds, sortedCandidates.length])

  const queueSliceAnnouncement = useMemo(() => {
    const parts = [`${sortedCandidates.length} visible candidate${sortedCandidates.length === 1 ? '' : 's'} sorted by ${SORT_MODE_LABELS[sortMode]}.`]

    if (leadVisibleCandidate) {
      parts.push(`Lead row ${getDisplayTitle(leadVisibleCandidate)}.`)
    } else {
      parts.push('No lead row visible.')
    }

    if (familyFilter) {
      parts.push(`Family focus ${familyFilter} is active.`)
    }

    if (hiddenSelectedCandidate) {
      parts.push(`${getDisplayTitle(hiddenSelectedCandidate)} is still selected, but hidden by the current slice.`)
    }

    return parts.join(' ')
  }, [familyFilter, hiddenSelectedCandidate, leadVisibleCandidate, sortMode, sortedCandidates.length])

  const detailPanelLabelledBy = selectedCandidate ? 'review-detail-title review-detail-selected-candidate-title' : 'review-detail-title'

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {selectedCandidateAnnouncement}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {mergeTargetAnnouncement}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {bulkSelectionAnnouncement}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {queueSliceAnnouncement}
      </div>
      <p id="review-current-view-copy-description" className="sr-only">
        {currentViewCopyDescription}
      </p>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isSubmitting ? 'Saving review action.' : null}
      </div>

      {copyFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-lg"
        >
          <p className="text-sm font-medium text-[var(--text-primary)]">{copyFeedback}</p>
        </div>
      )}

      {showShortcutHelp && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm xl:items-center"
          onClick={() => setShowShortcutHelp(false)}
        >
          <div
            id="review-shortcut-help-dialog"
            ref={shortcutHelpDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-shortcut-help-title"
            aria-describedby="review-shortcut-help-description"
            aria-keyshortcuts={`${REVIEW_HELP_SHORTCUTS} ${REVIEW_RETURN_TO_QUEUE_SHORTCUTS}`}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl"
          >
            <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--accent-primary)]">Keyboard shortcut help</p>
                <h3 id="review-shortcut-help-title" className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Stay in flow while triaging</h3>
                <p id="review-shortcut-help-description" className="mt-1 text-sm text-[var(--text-secondary)]">
                  This mirrors the queue shortcuts in a scannable layout. Press <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5 text-xs">?</kbd> to open or close it, click the backdrop or press <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5 text-xs">Esc</kbd> to return focus to the queue, dismiss feedback, reset the view, or jump back out of row controls into the queue.
                </p>
              </div>
              <button
                ref={shortcutHelpCloseButtonRef}
                type="button"
                aria-keyshortcuts={`${REVIEW_RETURN_TO_QUEUE_SHORTCUTS} ${REVIEW_HELP_SHORTCUTS}`}
                onClick={() => setShowShortcutHelp(false)}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                Close help
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {REVIEW_SHORTCUT_GROUPS.map((group, groupIndex) => {
                const groupHeadingId = `review-shortcut-group-${groupIndex}`

                return (
                  <section
                    key={group.title}
                    aria-labelledby={groupHeadingId}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4"
                  >
                    <h4 id={groupHeadingId} className="text-sm font-semibold text-[var(--text-primary)]">{group.title}</h4>
                    <div className="mt-3 space-y-3">
                      {group.shortcuts.map((shortcut) => (
                        <div key={`${group.title}-${shortcut.keys[0]}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)]">
                              {shortcut.keys[0]}
                            </kbd>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{shortcut.keys[1]}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{shortcut.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div aria-hidden={showShortcutHelp ? true : undefined}>
        <section aria-busy={isSubmitting} className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review controls</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Default sort surfaces the best next candidates first, instead of making reviewers scroll through transcript soup blindly.
                </p>
              </div>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={showShortcutHelp}
                aria-controls="review-shortcut-help-dialog"
                aria-keyshortcuts={REVIEW_HELP_SHORTCUTS}
                onClick={() => setShowShortcutHelp(true)}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                <span>Shortcut help</span>
                <kbd className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-xs">?</kbd>
              </button>
            </div>
            <p aria-hidden="true" className="mt-2 text-xs font-medium text-[var(--text-tertiary)]">
              <span className="mr-2">Keyboard:</span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">/</kbd> or <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">⌘</kbd>/<kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">Ctrl</kbd> + <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">K</kbd> focus search •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">j</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">k</kbd> or <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">↑</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">↓</kbd> navigate visible •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">Home</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">End</kbd> jump to queue edges •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">PgDn</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">PgUp</kbd> jump 10 visible rows •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">n</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">p</kbd> navigate pending •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">l</kbd> jump to lead row •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">x</kbd> or <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">Space</kbd> toggle select •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">Enter</kbd> apply suggestion •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">?</kbd> open full shortcut help •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">0</kbd> reset the queue •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">Esc</kbd> returns focus from help, dismisses feedback, resets view, or returns from row controls
            </p>
          </div>

          <p id={REVIEW_FILTER_SELECT_HELP_ID} className="sr-only">
            Press Escape from any review filter to leave the dropdown and return focus to the active queue row.
          </p>
          <p id={REVIEW_MERGE_TARGET_HELP_ID} className="sr-only">
            Press Escape from the merge target picker to return focus to the active queue row. While the queue is focused, use 4 to 9 to choose the top visible merge targets by rank, or Arrow Left, Arrow Right, semicolon, and apostrophe to keep cycling targets.
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <label className="text-sm text-[var(--text-secondary)]">
              <span id="review-search-help" className="sr-only">
                Search the review queue by title, source, tags, notes, steps, or coaching cues. Press Enter to open the lead result and return focus to the queue. Use the up and down arrow keys to move from search into the queue. Press Escape to clear search first, then return focus to the selected row.
              </span>
              <span id="review-search-status" className="sr-only" aria-live="polite" aria-atomic="true">
                {searchStatusMessage}
              </span>
              <span aria-hidden="true" className="mb-1 flex items-center gap-2">
                <span>Search</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  Shortcut / or ⌘/Ctrl + K
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  Enter opens lead + enters queue
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  ↑ / ↓ enters the queue
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  Esc returns to the queue when search is clear
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  Tabbing into a row syncs selection
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  Enter applies suggestion when the queue is focused
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  Search also matches tags, notes, steps, and coaching cues
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  E filters this row&apos;s grade, U filters this row&apos;s status
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  ← / → cycles merge targets
                </span>
              </span>
              <input
                ref={searchInputRef}
                aria-describedby="review-search-help review-search-status"
                aria-controls="review-queue-list"
                aria-keyshortcuts={REVIEW_SEARCH_SHORTCUTS}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    openLeadSearchResult()
                    return
                  }

                  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

                  const edgeCandidate = event.key === 'ArrowDown' ? sortedCandidates[0] : sortedCandidates[sortedCandidates.length - 1]
                  const targetCandidate = selectedCandidate ?? edgeCandidate

                  if (!targetCandidate) return

                  event.preventDefault()
                  focusCandidateInQueue(targetCandidate.id)
                }}
                placeholder="Search title, source, tags, notes, steps, or coaching cues"
                aria-label="Search review queue"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              />
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ReviewStatus)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All statuses</option>
                {REVIEW_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {REVIEW_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Grade</span>
              <select
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All grades</option>
                {availableGrades.map((grade) => (
                  <option key={grade} value={grade}>
                    {formatGradeLevel(grade === 'unassigned' ? null : grade)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All categories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Difficulty</span>
              <select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All difficulties</option>
                {availableDifficulties.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {formatDifficultyLabel(difficulty)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Source file</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All sources</option>
                {availableSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">AI recommendation</span>
              <select
                value={aiDecisionFilter}
                onChange={(event) => setAiDecisionFilter(event.target.value as AiDecisionFilter)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {(['all', 'approve', 'merge', 'review', 'reject', 'none'] as AiDecisionFilter[]).map((value) => (
                  <option key={value} value={value}>
                    {getAiDecisionFilterLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Suggested action</span>
              <select
                value={suggestedActionFilter}
                onChange={(event) => setSuggestedActionFilter(event.target.value as SuggestedActionFilter)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {(['all', 'keep', 'merge', 'reject'] as SuggestedActionFilter[]).map((value) => (
                  <option key={value} value={value}>
                    {getSuggestedActionFilterLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Triage lane</span>
              <select
                value={triageFilter}
                onChange={(event) => setTriageFilter(event.target.value as 'all' | TriageLevel)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {(['all', 'act-now', 'worth-a-look', 'low-signal', 'already-reviewed'] as Array<'all' | TriageLevel>).map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All triage lanes' : getTriageLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Completeness</span>
              <select
                value={completenessFilter}
                onChange={(event) => setCompletenessFilter(event.target.value as 'all' | CompletenessBand)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {(['all', 'thin', 'usable', 'rich'] as Array<'all' | CompletenessBand>).map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All completeness bands' : COMPLETENESS_BAND_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Family shape</span>
              <select
                value={familyShapeFilter}
                onChange={(event) => setFamilyShapeFilter(event.target.value as DuplicateShapeFilter)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {Object.entries(DUPLICATE_SHAPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                onKeyDown={handleSelectEscape}
                aria-describedby={REVIEW_FILTER_SELECT_HELP_ID}
                aria-keyshortcuts={REVIEW_FILTER_SELECT_SHORTCUTS}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {Object.entries(SORT_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              aria-keyshortcuts={REVIEW_COPY_VIEW_SHORTCUTS}
              aria-describedby="review-current-view-copy-description"
              onClick={() => copyCurrentView(scopedCandidateIds ? 'Copied scoped review view link' : 'Copied review queue view link')}
              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Copy current view (V)
            </button>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {sortedCandidates.length} visible
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {pendingCandidates.length} pending
            </span>
            {triageFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setTriageFilter('all')}
                className="rounded-full border border-[var(--accent-primary)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Triage slice: {getTriageLabel(triageFilter)} • Clear
              </button>
            ) : null}
            {completenessFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setCompletenessFilter('all')}
                className="rounded-full border border-[var(--accent-primary)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Completeness: {COMPLETENESS_BAND_LABELS[completenessFilter]} • Clear
              </button>
            ) : null}
            {familyShapeFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setFamilyShapeFilter('all')}
                className="rounded-full border border-[var(--accent-primary)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Family shape: {DUPLICATE_SHAPE_LABELS[familyShapeFilter]} • Clear
              </button>
            ) : null}
            {isSubmitting ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300">
                Saving review action...
              </span>
            ) : null}
          </div>

          {actionError ? (
            <div
              ref={actionErrorRef}
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
              className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300"
            >
              {actionError}
            </div>
          ) : null}

          {activeViewChips.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Active view modifiers</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Clear one filter at a time, peel back bulk selection or the most specific modifier with Backspace, or hit 0 to reset the queue back to the default pending triage view and clear selection.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lastActiveViewModifierLabel ? (
                    <button
                      type="button"
                      onClick={clearLastViewModifier}
                      aria-keyshortcuts={REVIEW_PEEL_BACK_SHORTCUTS}
                      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      Peel back last
                      <span className="ml-2 text-[var(--text-tertiary)]">Backspace • {lastActiveViewModifierLabel}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearAllViewFilters}
                    aria-keyshortcuts={REVIEW_RESET_VIEW_SHORTCUTS}
                    className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                  >
                    Reset view
                    <span className="ml-2 text-[var(--text-tertiary)]">0</span>
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeViewChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onClear}
                    aria-label={chip.clearLabel}
                    title={chip.clearLabel}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                  >
                    <span>{chip.label}</span>
                    <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {familyFilter ? (
        <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Family focus active</p>
              <p className="mt-2 text-sm leading-6">
                Narrowing the queue to dedupe family <span className="font-semibold">{familyFilter}</span> so you can review one duplicate cluster at a time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100">
                {sortedCandidates.length} visible in focus
              </span>
              <button
                type="button"
                onClick={clearFamilyFocus}
                className="inline-flex rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
              >
                Clear family focus
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 md:col-span-2 xl:col-span-1 2xl:col-span-2 shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Visible pending review</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text-primary)]">{pendingCandidates.length}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Working subset after filters, currently sorted by <span className="font-medium text-[var(--text-primary)]">{SORT_MODE_LABELS[sortMode]}</span>.
            Use the triage and completeness cards to jump straight into the right slice.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTriageFilter((current) => (current === 'act-now' ? 'all' : 'act-now'))}
          aria-pressed={triageFilter === 'act-now'}
          className={`min-h-[168px] rounded-3xl border bg-[var(--surface-elevated)] p-5 text-left transition-colors ${
            triageFilter === 'act-now' ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">Act now</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['act-now']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Pending rows with real duplicate pressure and enough structure to review cleanly.</p>
        </button>

        <button
          type="button"
          onClick={() => setTriageFilter((current) => (current === 'worth-a-look' ? 'all' : 'worth-a-look'))}
          aria-pressed={triageFilter === 'worth-a-look'}
          className={`min-h-[168px] rounded-3xl border bg-[var(--surface-elevated)] p-5 text-left transition-colors ${
            triageFilter === 'worth-a-look' ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">Worth a look</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['worth-a-look']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Reasonable next passes, but not the most urgent cleanup in the queue.</p>
        </button>

        <button
          type="button"
          onClick={() => setTriageFilter((current) => (current === 'low-signal' ? 'all' : 'low-signal'))}
          aria-pressed={triageFilter === 'low-signal'}
          className={`min-h-[168px] rounded-3xl border bg-[var(--surface-elevated)] p-5 text-left transition-colors ${
            triageFilter === 'low-signal' ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">Low signal</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['low-signal']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Thin or isolated rows that should wait until better candidates are handled.</p>
        </button>

        <div className="min-h-[168px] rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Duplicate families</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{duplicateFamilies.length}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Distinct dedupe groups currently visible after filtering.</p>
        </div>

        <div className="min-h-[168px] rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Needs summary</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{visibleMissingSummaryCount}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Visible pending rows with no summary, description, or training note.</p>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Current review slice</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Shows what the visible queue is mostly about, plus the first row worth touching.</p>
            </div>
            <button
              type="button"
              onClick={copyCurrentSliceHandoff}
              aria-keyshortcuts={REVIEW_COPY_QUEUE_HANDOFF_SHORTCUTS}
              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Copy queue handoff
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">H</span>
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-10">
            <InfoBlock label="Visible pending" value={String(pendingCandidates.length)} subdued={`${sortedCandidates.length} total visible`} />
            <InfoBlock
              label="Dominant grade"
              value={currentSliceSummary.dominantVisibleGrade ? formatGradeLevel(currentSliceSummary.dominantVisibleGrade === 'unassigned' ? null : currentSliceSummary.dominantVisibleGrade) : 'No pending rows'}
              subdued={gradeFilter === 'all' ? 'Across the current view' : 'Inside the active slice'}
            />
            <InfoBlock
              label="Dominant triage"
              value={currentSliceSummary.dominantVisibleTriage ? getTriageLabel(currentSliceSummary.dominantVisibleTriage) : 'No pending rows'}
              subdued={triageFilter === 'all' ? 'Across the current view' : 'Inside the active slice'}
            />
            <InfoBlock
              label="Dominant completeness"
              value={currentSliceSummary.dominantVisibleCompleteness ? COMPLETENESS_BAND_LABELS[currentSliceSummary.dominantVisibleCompleteness] : 'No pending rows'}
              subdued={completenessFilter === 'all' ? 'Across the current view' : 'Inside the active slice'}
            />
            <InfoBlock
              label="Dominant duplicate lane"
              value={currentSliceSummary.dominantVisibleFamilyShape ? DUPLICATE_SHAPE_LABELS[currentSliceSummary.dominantVisibleFamilyShape] : 'No pending rows'}
              subdued={familyShapeFilter === 'all' ? 'Across the current view' : 'Inside the active lane'}
            />
            <InfoBlock
              label="Dominant action"
              value={currentSliceSummary.dominantVisibleAction ? getDecisionLabel(currentSliceSummary.dominantVisibleAction) : 'No pending rows'}
              subdued={suggestedActionFilter === 'all' ? 'Across the current view' : 'Inside the active lane'}
            />
            <InfoBlock
              label="Dominant AI lane"
              value={currentSliceSummary.dominantVisibleAiDecision ? getAiDecisionFilterLabel(currentSliceSummary.dominantVisibleAiDecision) : 'No pending rows'}
              subdued={aiDecisionFilter === 'all' ? 'Across the current view' : 'Inside the active lane'}
            />
            <InfoBlock
              label="Main source"
              value={currentSliceSummary.topVisibleSource?.[0] ?? 'Mixed'}
              subdued={currentSliceSummary.topVisibleSource ? `${currentSliceSummary.topVisibleSource[1]} pending rows` : 'No dominant source'}
            />
            <InfoBlock
              label="Largest family"
              value={currentSliceSummary.topVisibleFamily?.dedupeKey ?? 'No family'}
              subdued={currentSliceSummary.topVisibleFamily ? `${currentSliceSummary.topVisibleFamily.count} pending rows` : 'No duplicate family in slice'}
            />
            <InfoBlock label="Visible families" value={String(duplicateFamilies.length)} subdued={`${visibleMissingSummaryCount} rows still need a summary`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {currentSliceSummary.dominantVisibleGrade ? (
              <button
                type="button"
                onClick={() => setGradeFilter(currentSliceSummary.dominantVisibleGrade!)}
                aria-pressed={gradeFilter === currentSliceSummary.dominantVisibleGrade}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus dominant grade
              </button>
            ) : null}
            {currentSliceSummary.dominantVisibleTriage ? (
              <button
                type="button"
                onClick={() => setTriageFilter(currentSliceSummary.dominantVisibleTriage!)}
                aria-pressed={triageFilter === currentSliceSummary.dominantVisibleTriage}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus dominant triage
              </button>
            ) : null}
            {currentSliceSummary.dominantVisibleCompleteness ? (
              <button
                type="button"
                onClick={() => setCompletenessFilter(currentSliceSummary.dominantVisibleCompleteness!)}
                aria-pressed={completenessFilter === currentSliceSummary.dominantVisibleCompleteness}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus dominant completeness
              </button>
            ) : null}
            {currentSliceSummary.dominantVisibleFamilyShape ? (
              <button
                type="button"
                onClick={() => setFamilyShapeFilter(currentSliceSummary.dominantVisibleFamilyShape!)}
                aria-pressed={familyShapeFilter === currentSliceSummary.dominantVisibleFamilyShape}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus duplicate lane
              </button>
            ) : null}
            {currentSliceSummary.dominantVisibleAction ? (
              <button
                type="button"
                onClick={() => setSuggestedActionFilter(currentSliceSummary.dominantVisibleAction!)}
                aria-pressed={suggestedActionFilter === currentSliceSummary.dominantVisibleAction}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus suggested action
              </button>
            ) : null}
            {currentSliceSummary.dominantVisibleAiDecision ? (
              <button
                type="button"
                onClick={() => setAiDecisionFilter(currentSliceSummary.dominantVisibleAiDecision!)}
                aria-pressed={aiDecisionFilter === currentSliceSummary.dominantVisibleAiDecision}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus AI lane
              </button>
            ) : null}
            {currentSliceSummary.topVisibleSource ? (
              <button
                type="button"
                onClick={() => setSourceFilter(currentSliceSummary.topVisibleSource![0])}
                aria-pressed={sourceFilter === currentSliceSummary.topVisibleSource[0]}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus main source
              </button>
            ) : null}
            {currentSliceSummary.topVisibleFamily ? (
              <button
                type="button"
                onClick={() => focusFamily(currentSliceSummary.topVisibleFamily!.dedupeKey, currentSliceSummary.topVisibleFamily!.leadCandidate?.id)}
                aria-pressed={familyFilter === currentSliceSummary.topVisibleFamily.dedupeKey}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Focus largest family
              </button>
            ) : null}
            {currentSliceSummary.leadCandidate ? (
              <button
                type="button"
                onClick={() => openCandidateInQueue(currentSliceSummary.leadCandidate!.id)}
                aria-controls="review-detail-panel"
                aria-expanded={selectedCandidateId === currentSliceSummary.leadCandidate.id}
                aria-label={`${selectedCandidateId === currentSliceSummary.leadCandidate.id ? 'Viewing' : 'Open'} lead candidate ${getDisplayTitle(currentSliceSummary.leadCandidate)} in the detail panel`}
                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Open lead candidate
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Lead visible candidate</h2>
          {!currentSliceSummary.leadCandidate || !currentSliceSummary.leadInsight ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">No visible candidate in the current filter set.</p>
          ) : (
            <div className="mt-4">
              {(() => {
                const leadDecision = getCandidateDecisionHint(currentSliceSummary.leadCandidate, currentSliceSummary.leadInsight)
                const leadVisibleCandidateSummaryId = 'lead-visible-candidate-summary'
                const leadVisibleCandidateActionsId = 'lead-visible-candidate-actions'
                const leadCandidateAlreadySelected = selectedCandidateId === currentSliceSummary.leadCandidate.id

                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{getDisplayTitle(currentSliceSummary.leadCandidate)}</p>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(currentSliceSummary.leadInsight.triageLevel)}`}>
                        {getTriageLabel(currentSliceSummary.leadInsight.triageLevel)}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDecisionTone(leadDecision)}`}>
                        {getDecisionLabel(leadDecision)}
                      </span>
                    </div>
                    <p id={leadVisibleCandidateSummaryId} className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{getReviewerNextMove(currentSliceSummary.leadCandidate, currentSliceSummary.leadInsight)}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <InfoBlock label="Source" value={getSourceLabel(currentSliceSummary.leadCandidate)} />
                      <InfoBlock
                        label="Grade"
                        value={formatGradeLevel(currentSliceSummary.leadCandidate.grade_level)}
                        subdued={currentSliceSummary.leadCandidate.category || 'No category yet'}
                      />
                      <InfoBlock
                        label="Suggested action"
                        value={getDecisionLabel(leadDecision)}
                        subdued={getSuggestedActionShortcutLabel(leadDecision)}
                      />
                      <InfoBlock
                        label="Difficulty"
                        value={formatDifficultyLabel(currentSliceSummary.leadCandidate.difficulty)}
                        subdued={currentSliceSummary.leadCandidate.dedupe_key || 'No family yet'}
                      />
                      <InfoBlock
                        label="Duplicate pressure"
                        value={`${currentSliceSummary.leadInsight.familySize} row${currentSliceSummary.leadInsight.familySize === 1 ? '' : 's'}`}
                        subdued={currentSliceSummary.leadCandidate.dedupe_key || 'No family yet'}
                      />
                      <InfoBlock
                        label="AI recommendation"
                        value={getAiDecisionLabel(currentSliceSummary.leadCandidate.ai_decision ?? null)}
                        subdued={
                          currentSliceSummary.leadCandidate.ai_reason ||
                          (typeof currentSliceSummary.leadCandidate.ai_confidence === 'number'
                            ? `${Math.round(currentSliceSummary.leadCandidate.ai_confidence * 100)}% confidence`
                            : 'No AI recommendation yet')
                        }
                      />
                      <InfoBlock
                        label="Completeness"
                        value={`${currentSliceSummary.leadInsight.completenessScore}/6`}
                        subdued={currentSliceSummary.leadInsight.completenessLabel}
                      />
                    </div>
                    <p id={leadVisibleCandidateActionsId} className="sr-only">
                      These actions reuse the current lead visible candidate and queue slice context. Buttons that focus a slice expose whether that slice is already active.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCandidateInQueue(currentSliceSummary.leadCandidate.id)}
                        aria-controls="review-detail-panel"
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-expanded={leadCandidateAlreadySelected}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Open in detail panel
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceFilter(getSourceLabel(currentSliceSummary.leadCandidate))}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={sourceFilter === getSourceLabel(currentSliceSummary.leadCandidate)}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this source
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGradeFocus(currentSliceSummary.leadCandidate.grade_level ?? 'unassigned')}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={gradeFilter === (currentSliceSummary.leadCandidate.grade_level ?? 'unassigned')}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this grade
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriageFilter(currentSliceSummary.leadInsight!.triageLevel)}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={triageFilter === currentSliceSummary.leadInsight.triageLevel}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this triage
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuggestedActionFilter(leadDecision)}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={suggestedActionFilter === leadDecision}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this action
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDifficultyFocus(currentSliceSummary.leadCandidate.difficulty || 'unassigned', currentSliceSummary.leadCandidate.id)}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={difficultyFilter === (currentSliceSummary.leadCandidate.difficulty || 'unassigned')}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this difficulty
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompletenessFilter(getCompletenessBand(currentSliceSummary.leadInsight!))}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={completenessFilter === getCompletenessBand(currentSliceSummary.leadInsight)}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this completeness
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiDecisionFilter(getAiDecisionFilterValue(currentSliceSummary.leadCandidate.ai_decision ?? null))}
                        aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                        aria-pressed={aiDecisionFilter === getAiDecisionFilterValue(currentSliceSummary.leadCandidate.ai_decision ?? null)}
                        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Focus this AI lane
                      </button>
                      {currentSliceSummary.leadCandidate.dedupe_key ? (
                        <button
                          type="button"
                          onClick={() => focusFamily(currentSliceSummary.leadCandidate!.dedupe_key!, currentSliceSummary.leadCandidate!.id)}
                          aria-describedby={`${leadVisibleCandidateSummaryId} ${leadVisibleCandidateActionsId}`}
                          aria-pressed={familyFilter === currentSliceSummary.leadCandidate.dedupe_key}
                          className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                        >
                          Focus this family
                        </button>
                      ) : null}
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review routes</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">One-click queue presets that combine the existing filters into practical review passes.</p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
            Uses current search, source, grade, and scope context
          </span>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {reviewRoutes.map((route) => {
            const routeSummaryId = `review-route-${route.key}-summary`
            const routeLeadId = `review-route-${route.key}-lead`

            return (
              <div
                key={route.key}
                className={`rounded-3xl border px-5 py-5 transition-colors ${
                  route.isActive ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm' : 'border-[var(--border)] bg-[var(--surface-primary)]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getReviewRouteTone(route.key)}`}>
                    {route.label}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                    Shortcut {REVIEW_ROUTE_SHORTCUTS[route.key]}
                  </span>
                  {route.isActive ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                      Active
                    </span>
                  ) : null}
                </div>
                <p id={routeSummaryId} className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{route.description}</p>
                <p className="mt-4 text-3xl font-bold text-[var(--text-primary)]">{route.count}</p>
                <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">{route.countLabel} in the current context</p>
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Lead row</p>
                  <p id={routeLeadId} className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                    {route.leadCandidate ? getDisplayTitle(route.leadCandidate) : 'No matching row in this slice'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {route.leadCandidate && route.leadInsight ? getReviewerNextMove(route.leadCandidate, route.leadInsight) : 'Try a broader search or clear a source/grade filter.'}
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={route.count === 0}
                    onClick={() => applyReviewRoute(route.key)}
                    aria-pressed={route.isActive}
                    aria-label={route.isActive ? `${route.label} route is currently active` : `Apply ${route.label} route`}
                    aria-keyshortcuts={REVIEW_ROUTE_SHORTCUTS[route.key]}
                    aria-describedby={`${routeSummaryId} ${routeLeadId}`}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {route.isActive ? 'Current route' : 'Apply route'}
                    <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">Shortcut {REVIEW_ROUTE_SHORTCUTS[route.key]}</span>
                    <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                      {route.key === 'approve-ready'
                        ? 'Suggested keep + completeness ordering'
                        : route.key === 'merge-sweep'
                          ? 'Suggested merge + duplicate-pressure ordering'
                          : 'Suggested reject + thin extracts'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!route.leadCandidate}
                    onClick={() => {
                      if (!route.leadCandidate) return
                      applyReviewRoute(route.key)
                      openCandidateInQueue(route.leadCandidate.id)
                    }}
                    aria-controls="review-detail-panel"
                    aria-expanded={route.leadCandidate?.id === selectedCandidate?.id}
                    aria-describedby={`${routeSummaryId} ${routeLeadId}`}
                    aria-label={route.leadCandidate ? `Open lead row ${getDisplayTitle(route.leadCandidate)} for the ${route.label} route` : undefined}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                  >
                    Open lead row
                    <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                      {route.leadCandidate ? `${getSourceLabel(route.leadCandidate)} • applies this route first` : 'No matching row in this route'}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Queue by review status</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Quick signal for where the visible backlog is actually sitting. Click a card to jump into that status.</p>
            </div>
            {statusFilter !== 'all' ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                Focused on {REVIEW_STATUS_LABELS[statusFilter]}
              </span>
            ) : null}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {statusCounts.map(({ status, count }) => {
              const isFocusedStatus = statusFilter === status
              const statusSummaryId = `review-status-summary-${status}`

              return (
                <div key={status}>
                  <p id={statusSummaryId} className="sr-only">
                    {`${REVIEW_STATUS_LABELS[status]}. ${count} visible candidate${count === 1 ? '' : 's'} in this status.${
                      isFocusedStatus ? ' This status filter is currently active.' : ''
                    } ${isFocusedStatus ? 'Activate to clear this status filter.' : 'Activate to filter the queue to this status.'}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleStatusFocus(status)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                      isFocusedStatus
                        ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                        : `${getStatusTone(status)} hover:opacity-90`
                    }`}
                    aria-describedby={statusSummaryId}
                    aria-pressed={isFocusedStatus}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-current">{REVIEW_STATUS_LABELS[status]}</p>
                      {isFocusedStatus ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-2xl font-bold text-current">{count}</p>
                    <p className="mt-2 text-xs font-medium text-[var(--text-tertiary)]">
                      {isFocusedStatus ? 'Click to clear this status filter' : 'Click to filter the queue to this status'}
                    </p>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by grade</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Helpful when scanning current graduation imports. Click a row to jump into that grade.</p>
              </div>
              {gradeFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(gradeCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending candidates in the current filter set.</p>
              ) : (
                Object.entries(gradeCounts)
                  .sort(([left], [right]) => {
                    const sortDifference = getGradeSortValue(left === 'unassigned' ? null : left) - getGradeSortValue(right === 'unassigned' ? null : right)
                    return sortDifference || left.localeCompare(right)
                  })
                  .map(([grade, count]) => {
                    const isFocusedGrade = gradeFilter === grade
                    const gradeSummary = gradeSummaries.get(grade)
                    const gradeLabel = formatGradeLevel(grade === 'unassigned' ? null : grade)
                    const gradeSummaryId = `review-grade-summary-${grade}`

                    return (
                      <div
                        key={grade}
                        className={`rounded-2xl border px-4 py-4 transition-colors ${
                          isFocusedGrade
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 pr-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text-primary)]">{formatGradeLevel(grade === 'unassigned' ? null : grade)}</span>
                              {isFocusedGrade ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                              {isFocusedGrade ? 'Click to clear this grade filter' : 'Click to focus this grade slice'}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                            {count} pending
                          </span>
                        </div>

                        {gradeSummary?.leadCandidate && gradeSummary.leadInsight && gradeSummary.leadDecision ? (
                          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(gradeSummary.leadDecision)}`}>
                                {getDecisionLabel(gradeSummary.leadDecision)}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(gradeSummary.leadInsight.triageLevel)}`}>
                                {getTriageLabel(gradeSummary.leadInsight.triageLevel)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(gradeSummary.leadCandidate)}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(gradeSummary.leadCandidate, gradeSummary.leadInsight)}</p>
                          </div>
                        ) : null}

                        <p id={gradeSummaryId} className="sr-only">
                          {`${gradeLabel}. ${count} pending candidate${count === 1 ? '' : 's'} in this slice.${
                            isFocusedGrade ? ' This grade slice is currently active.' : ''
                          }${
                            gradeSummary?.leadCandidate && gradeSummary.leadInsight && gradeSummary.leadDecision
                              ? ` Lead row ${getDisplayTitle(gradeSummary.leadCandidate)}. Suggested action ${getDecisionLabel(gradeSummary.leadDecision)}. ${getReviewerNextMove(gradeSummary.leadCandidate, gradeSummary.leadInsight)}`
                              : ' No lead row is available in this grade right now.'
                          }`}
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => toggleGradeFocus(grade)}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            aria-describedby={gradeSummaryId}
                            aria-pressed={isFocusedGrade}
                          >
                            {isFocusedGrade ? 'Current grade slice' : 'Focus this grade slice'}
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              Narrow the queue to {gradeLabel} rows.
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!gradeSummary?.leadCandidate}
                            onClick={() => {
                              if (!gradeSummary?.leadCandidate) return
                              openCandidateFromSummary(gradeSummary.leadCandidate.id, () => toggleGradeFocus(grade))
                            }}
                            aria-controls="review-detail-panel"
                            aria-describedby={gradeSummaryId}
                            aria-expanded={gradeSummary?.leadCandidate?.id === selectedCandidate?.id}
                            aria-label={gradeSummary?.leadCandidate ? `Open lead row ${getDisplayTitle(gradeSummary.leadCandidate)} for grade ${gradeLabel}` : undefined}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                          >
                            Open lead row
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              {gradeSummary?.leadCandidate ? getDisplayTitle(gradeSummary.leadCandidate) : 'No lead row available in this grade'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by AI recommendation</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into the AI-suggested action lane, while keeping the default pending triage flow intact.</p>
              </div>
              {aiDecisionFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {getAiDecisionFilterLabel(aiDecisionFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(Object.values(aiDecisionCounts) as number[]).every((count) => count === 0) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending AI recommendation groups in the current filter set.</p>
              ) : (
                (['approve', 'merge', 'review', 'reject', 'none'] as Array<Exclude<AiDecisionFilter, 'all'>>).map((decision) => {
                  const count = aiDecisionCounts[decision]
                  if (count === 0) return null

                  const isFocusedDecision = aiDecisionFilter === decision
                  const decisionSummary = aiDecisionSummaries.get(decision)
                  const decisionSummaryId = `review-ai-lane-summary-${decision}`

                  return (
                    <div
                      key={decision}
                      className={`rounded-2xl border px-4 py-4 transition-colors ${
                        isFocusedDecision
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getAiDecisionTone(decision === 'none' ? null : decision)}`}>
                              {getAiDecisionFilterLabel(decision)}
                            </span>
                            {isFocusedDecision ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedDecision ? 'Click to clear this AI recommendation filter' : 'Click to filter the queue to this AI recommendation'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </div>

                      {decisionSummary?.leadCandidate && decisionSummary.leadInsight && decisionSummary.leadDecision ? (
                        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(decisionSummary.leadDecision)}`}>
                              {getDecisionLabel(decisionSummary.leadDecision)}
                            </span>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(decisionSummary.leadInsight.triageLevel)}`}>
                              {getTriageLabel(decisionSummary.leadInsight.triageLevel)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(decisionSummary.leadCandidate)}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(decisionSummary.leadCandidate, decisionSummary.leadInsight)}</p>
                        </div>
                      ) : null}

                      <p id={decisionSummaryId} className="sr-only">
                        {`${getAiDecisionFilterLabel(decision)}. ${count} pending candidate${count === 1 ? '' : 's'} in this lane.${
                          isFocusedDecision ? ' This AI recommendation lane is currently active.' : ''
                        }${
                          decisionSummary?.leadCandidate && decisionSummary.leadInsight && decisionSummary.leadDecision
                            ? ` Lead row ${getDisplayTitle(decisionSummary.leadCandidate)}. Suggested action ${getDecisionLabel(decisionSummary.leadDecision)}. ${getReviewerNextMove(decisionSummary.leadCandidate, decisionSummary.leadInsight)}`
                            : ' No lead row is available in this AI lane right now.'
                        }`}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => toggleAiDecisionFocus(decision)}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                          aria-describedby={decisionSummaryId}
                          aria-pressed={isFocusedDecision}
                        >
                          {isFocusedDecision ? 'Current AI lane' : 'Focus this AI lane'}
                          <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                            Narrow the queue to this AI recommendation.
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={!decisionSummary?.leadCandidate}
                          onClick={() => {
                            if (!decisionSummary?.leadCandidate) return
                            openCandidateFromSummary(decisionSummary.leadCandidate.id, () => toggleAiDecisionFocus(decision))
                          }}
                          aria-controls="review-detail-panel"
                          aria-describedby={decisionSummaryId}
                          aria-expanded={decisionSummary?.leadCandidate?.id === selectedCandidate?.id}
                          aria-label={decisionSummary?.leadCandidate ? `Open lead row ${getDisplayTitle(decisionSummary.leadCandidate)} for AI lane ${getAiDecisionFilterLabel(decision)}` : undefined}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                        >
                          Open lead row
                          <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                            {decisionSummary?.leadCandidate ? getDisplayTitle(decisionSummary.leadCandidate) : 'No lead row available in this AI lane'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by triage</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into the rows that need attention now, are worth a look next, or can wait without losing the rest of the queue context.</p>
              </div>
              {triageFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {getTriageLabel(triageFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(['act-now', 'worth-a-look', 'low-signal'] as Array<Exclude<TriageLevel, 'already-reviewed'>>).every((level) => triageCounts[level] === 0) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending triage lanes in the current filter set.</p>
              ) : (
                (['act-now', 'worth-a-look', 'low-signal'] as Array<Exclude<TriageLevel, 'already-reviewed'>>).map((level) => {
                  const count = triageCounts[level]
                  if (count === 0) return null

                  const isFocusedLevel = triageFilter === level
                  const triageSummary = triageSummaries.get(level)
                  const triageSummaryId = `review-triage-summary-${level}`

                  return (
                    <div
                      key={level}
                      className={`rounded-2xl border px-4 py-4 transition-colors ${
                        isFocusedLevel
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(level)}`}>
                              {getTriageLabel(level)}
                            </span>
                            {isFocusedLevel ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedLevel ? 'Click to clear this triage lane' : 'Click to focus this triage lane'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </div>

                      {triageSummary?.leadCandidate && triageSummary.leadInsight && triageSummary.leadDecision ? (
                        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(triageSummary.leadDecision)}`}>
                              {getDecisionLabel(triageSummary.leadDecision)}
                            </span>
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                              {triageSummary.leadInsight.familySize} row{triageSummary.leadInsight.familySize === 1 ? '' : 's'} in family
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(triageSummary.leadCandidate)}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(triageSummary.leadCandidate, triageSummary.leadInsight)}</p>
                        </div>
                      ) : null}

                      <p id={triageSummaryId} className="sr-only">
                        {`${getTriageLabel(level)}. ${count} pending candidate${count === 1 ? '' : 's'} in this lane.${
                          isFocusedLevel ? ' This triage lane is currently active.' : ''
                        }${
                          triageSummary?.leadCandidate && triageSummary.leadInsight && triageSummary.leadDecision
                            ? ` Lead row ${getDisplayTitle(triageSummary.leadCandidate)}. Suggested action ${getDecisionLabel(triageSummary.leadDecision)}. ${getReviewerNextMove(triageSummary.leadCandidate, triageSummary.leadInsight)}`
                            : ' No lead row is available in this triage lane right now.'
                        }`}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setTriageFilter((current) => (current === level ? 'all' : level))}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                          aria-describedby={triageSummaryId}
                          aria-pressed={isFocusedLevel}
                        >
                          {isFocusedLevel ? 'Current triage lane' : 'Focus this triage lane'}
                          <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                            Narrow the queue to {getTriageLabel(level).toLowerCase()} rows.
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={!triageSummary?.leadCandidate}
                          onClick={() => {
                            if (!triageSummary?.leadCandidate) return
                            openCandidateFromSummary(triageSummary.leadCandidate.id, () => setTriageFilter(level))
                          }}
                          aria-controls="review-detail-panel"
                          aria-describedby={triageSummaryId}
                          aria-expanded={triageSummary?.leadCandidate?.id === selectedCandidate?.id}
                          aria-label={triageSummary?.leadCandidate ? `Open lead row ${getDisplayTitle(triageSummary.leadCandidate)} for ${getTriageLabel(level)}` : undefined}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                        >
                          Open lead row
                          <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                            {triageSummary?.leadCandidate ? getDisplayTitle(triageSummary.leadCandidate) : 'No lead row available in this triage lane'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by completeness</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into thin, usable, or rich extracts without losing the rest of the current queue context.</p>
              </div>
              {completenessFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {COMPLETENESS_BAND_LABELS[completenessFilter]}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(Object.values(completenessCounts) as number[]).every((count) => count === 0) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending completeness bands in the current filter set.</p>
              ) : (
                (['thin', 'usable', 'rich'] as CompletenessBand[]).map((band) => {
                  const count = completenessCounts[band]
                  if (count === 0) return null

                  const isFocusedBand = completenessFilter === band
                  const completenessSummary = completenessSummaries.get(band)
                  const completenessSummaryId = `review-completeness-summary-${band}`

                  return (
                    <div
                      key={band}
                      className={`rounded-2xl border px-4 py-4 transition-colors ${
                        isFocusedBand
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{COMPLETENESS_BAND_LABELS[band]}</span>
                            {isFocusedBand ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedBand ? 'Click to clear this completeness filter' : 'Click to filter the queue to this completeness band'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </div>

                      {completenessSummary?.leadCandidate && completenessSummary.leadInsight && completenessSummary.leadDecision ? (
                        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(completenessSummary.leadDecision)}`}>
                              {getDecisionLabel(completenessSummary.leadDecision)}
                            </span>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(completenessSummary.leadInsight.triageLevel)}`}>
                              {getTriageLabel(completenessSummary.leadInsight.triageLevel)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(completenessSummary.leadCandidate)}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(completenessSummary.leadCandidate, completenessSummary.leadInsight)}</p>
                        </div>
                      ) : null}

                      <p id={completenessSummaryId} className="sr-only">
                        {`${COMPLETENESS_BAND_LABELS[band]}. ${count} pending candidate${count === 1 ? '' : 's'} in this lane.${
                          isFocusedBand ? ' This completeness lane is currently active.' : ''
                        }${
                          completenessSummary?.leadCandidate && completenessSummary.leadInsight && completenessSummary.leadDecision
                            ? ` Lead row ${getDisplayTitle(completenessSummary.leadCandidate)}. Suggested action ${getDecisionLabel(completenessSummary.leadDecision)}. ${getReviewerNextMove(completenessSummary.leadCandidate, completenessSummary.leadInsight)}`
                            : ' No lead row is available in this completeness lane right now.'
                        }`}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => toggleCompletenessFocus(band)}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                          aria-describedby={completenessSummaryId}
                          aria-pressed={isFocusedBand}
                        >
                          {isFocusedBand ? 'Current completeness lane' : 'Focus this completeness lane'}
                          <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                            Narrow the queue to {COMPLETENESS_BAND_LABELS[band].toLowerCase()} rows.
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={!completenessSummary?.leadCandidate}
                          onClick={() => {
                            if (!completenessSummary?.leadCandidate) return
                            openCandidateFromSummary(completenessSummary.leadCandidate.id, () => toggleCompletenessFocus(band))
                          }}
                          aria-controls="review-detail-panel"
                          aria-describedby={completenessSummaryId}
                          aria-expanded={completenessSummary?.leadCandidate?.id === selectedCandidate?.id}
                          aria-label={completenessSummary?.leadCandidate ? `Open lead row ${getDisplayTitle(completenessSummary.leadCandidate)} for ${COMPLETENESS_BAND_LABELS[band]}` : undefined}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                        >
                          Open lead row
                          <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                            {completenessSummary?.leadCandidate ? getDisplayTitle(completenessSummary.leadCandidate) : 'No lead row available in this completeness lane'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by suggested action</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into likely keeps, merges, or rejects instead of working that out row by row.</p>
              </div>
              {suggestedActionFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {getSuggestedActionFilterLabel(suggestedActionFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(Object.values(suggestedActionCounts) as number[]).every((count) => count === 0) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending suggested-action lanes in the current filter set.</p>
              ) : (
                (['keep', 'merge', 'reject'] as FamilyDecision[]).map((decision) => {
                  const count = suggestedActionCounts[decision]
                  const isFocusedDecision = suggestedActionFilter === decision
                  const decisionSummary = suggestedActionSummaries.get(decision)

                  return (
                    <div
                      key={decision}
                      className={`rounded-2xl border px-4 py-4 transition-colors ${
                        isFocusedDecision
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] bg-[var(--surface-primary)]'
                      } ${count === 0 ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSuggestedActionFocus(decision)}
                        disabled={count === 0}
                        className="flex w-full items-center justify-between text-left disabled:cursor-not-allowed"
                        aria-pressed={isFocusedDecision}
                      >
                        <div className="pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDecisionTone(decision)}`}>
                              {getDecisionLabel(decision)}
                            </span>
                            {isFocusedDecision ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {decision === 'keep'
                              ? isFocusedDecision
                                ? 'Click to clear this canonical-seed lane'
                                : 'Click to focus the likely canonical seeds'
                              : decision === 'merge'
                                ? isFocusedDecision
                                  ? 'Click to clear this merge lane'
                                  : 'Click to focus the supporting duplicates'
                                : isFocusedDecision
                                  ? 'Click to clear this reject lane'
                                  : 'Click to focus the likely reject rows'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </button>

                      {decisionSummary?.leadCandidate && decisionSummary.leadInsight ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Lead row in this lane</p>
                              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{getDisplayTitle(decisionSummary.leadCandidate)}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(decisionSummary.leadInsight.triageLevel)}`}>
                              {getTriageLabel(decisionSummary.leadInsight.triageLevel)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{getReviewerNextMove(decisionSummary.leadCandidate, decisionSummary.leadInsight)}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <InfoBlock label="Source" value={getSourceLabel(decisionSummary.leadCandidate)} />
                            <InfoBlock
                              label="Duplicate pressure"
                              value={`${decisionSummary.leadInsight.familySize} row${decisionSummary.leadInsight.familySize === 1 ? '' : 's'}`}
                              subdued={decisionSummary.leadCandidate.dedupe_key || 'No family yet'}
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => focusCandidateDetailPanel(decisionSummary.leadCandidate!.id)}
                              aria-controls="review-detail-panel"
                              aria-expanded={decisionSummary.leadCandidate.id === selectedCandidate?.id}
                              aria-label={`Open lead row ${getDisplayTitle(decisionSummary.leadCandidate)} for the ${getDecisionLabel(decision)} lane`}
                              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            >
                              Open lead row
                            </button>
                            {decisionSummary.leadCandidate.dedupe_key ? (
                              <button
                                type="button"
                                onClick={() => focusFamily(decisionSummary.leadCandidate!.dedupe_key!, decisionSummary.leadCandidate!.id)}
                                aria-pressed={familyFilter === decisionSummary.leadCandidate.dedupe_key}
                                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                Focus this family
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by duplicate lane</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into solo rows, pairs, or bigger duplicate families without rebuilding the queue by hand.</p>
              </div>
              {familyShapeFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {DUPLICATE_SHAPE_LABELS[familyShapeFilter]}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(['solo', 'pair', 'small-family', 'large-family'] as Array<Exclude<DuplicateShapeFilter, 'all'>>).every(
                (shape) => pendingFamilyShapeSummary[shape].rows === 0
              ) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending duplicate lanes in the current filter set.</p>
              ) : (
                (['solo', 'pair', 'small-family', 'large-family'] as Array<Exclude<DuplicateShapeFilter, 'all'>>).map((shape) => {
                  const summary = pendingFamilyShapeSummary[shape]
                  const isFocusedShape = familyShapeFilter === shape
                  const familyCount = summary.families.size

                  return (
                    <div
                      key={shape}
                      className={`rounded-2xl border px-4 py-4 transition-colors ${
                        isFocusedShape
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] bg-[var(--surface-primary)]'
                      } ${summary.rows === 0 ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => focusFamilyShape(shape)}
                        disabled={summary.rows === 0}
                        className="flex w-full items-center justify-between text-left disabled:cursor-not-allowed"
                        aria-pressed={isFocusedShape}
                      >
                        <div className="pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{DUPLICATE_SHAPE_LABELS[shape]}</span>
                            {isFocusedShape ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {summary.rows === 0
                              ? 'Nothing pending in this lane right now'
                              : shape === 'solo'
                                ? isFocusedShape
                                  ? 'Click to clear this solo lane'
                                  : `Click to focus ${familyCount} standalone candidate${familyCount === 1 ? '' : 's'}`
                                : isFocusedShape
                                  ? 'Click to clear this duplicate lane'
                                  : `Click to focus ${familyCount} famil${familyCount === 1 ? 'y' : 'ies'} waiting`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {summary.rows} pending
                        </span>
                      </button>

                      {summary.leadCandidate && summary.leadInsight && summary.leadDecision ? (
                        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(summary.leadDecision)}`}>
                              {getDecisionLabel(summary.leadDecision)}
                            </span>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(summary.leadInsight.triageLevel)}`}>
                              {getTriageLabel(summary.leadInsight.triageLevel)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(summary.leadCandidate)}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(summary.leadCandidate, summary.leadInsight)}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <InfoBlock label="Source" value={getSourceLabel(summary.leadCandidate)} />
                            <InfoBlock
                              label="Family pressure"
                              value={`${summary.leadInsight.familySize} row${summary.leadInsight.familySize === 1 ? '' : 's'}`}
                              subdued={summary.leadCandidate.dedupe_key || 'No family yet'}
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => focusCandidateDetailPanel(summary.leadCandidate!.id)}
                              aria-controls="review-detail-panel"
                              aria-expanded={summary.leadCandidate.id === selectedCandidate?.id}
                              aria-label={`Open lead row ${getDisplayTitle(summary.leadCandidate)} for ${DUPLICATE_SHAPE_LABELS[shape]}`}
                              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            >
                              Open lead row
                            </button>
                            {summary.leadCandidate.dedupe_key ? (
                              <button
                                type="button"
                                onClick={() => focusFamily(summary.leadCandidate!.dedupe_key!, summary.leadCandidate!.id)}
                                aria-pressed={familyFilter === summary.leadCandidate.dedupe_key}
                                className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                Focus this family
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by source</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Useful when you want to clear one import batch at a time instead of mixing different transcript drops together.</p>
              </div>
              {sourceFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {sourceFilter}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(sourceCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending sources in the current filter set.</p>
              ) : (
                Object.entries(sourceCounts)
                  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                  .slice(0, 6)
                  .map(([source, count]) => {
                    const isFocusedSource = sourceFilter === source
                    const sourceSummary = sourceSummaries.get(source)

                    return (
                      <div
                        key={source}
                        className={`rounded-2xl border px-4 py-4 transition-colors ${
                          isFocusedSource
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 pr-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{source}</span>
                              {isFocusedSource ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                              {isFocusedSource ? 'Click to clear this source filter' : 'Click to focus this import/source batch'}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                            {count} pending
                          </span>
                        </div>

                        {sourceSummary?.leadCandidate && sourceSummary.leadInsight && sourceSummary.leadDecision ? (
                          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(sourceSummary.leadDecision)}`}>
                                {getDecisionLabel(sourceSummary.leadDecision)}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(sourceSummary.leadInsight.triageLevel)}`}>
                                {getTriageLabel(sourceSummary.leadInsight.triageLevel)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(sourceSummary.leadCandidate)}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(sourceSummary.leadCandidate, sourceSummary.leadInsight)}</p>
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => toggleSourceFocus(source)}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            aria-pressed={isFocusedSource}
                          >
                            {isFocusedSource ? 'Current source focus' : 'Focus this source'}
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              Narrow the queue to this source batch.
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!sourceSummary?.leadCandidate}
                            onClick={() => {
                              const leadCandidate = sourceSummary?.leadCandidate
                              if (!leadCandidate) return
                              openCandidateFromSummary(leadCandidate.id, () => toggleSourceFocus(source, leadCandidate.id))
                            }}
                            aria-controls="review-detail-panel"
                            aria-expanded={sourceSummary?.leadCandidate?.id === selectedCandidate?.id}
                            aria-label={sourceSummary?.leadCandidate ? `Open lead row ${getDisplayTitle(sourceSummary.leadCandidate)} for source ${source}` : undefined}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                          >
                            Open lead row
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              {sourceSummary?.leadCandidate ? getDisplayTitle(sourceSummary.leadCandidate) : 'No lead row available in this source'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by difficulty</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Useful when you want to clear one effort band at a time instead of mixing beginner clean-up with harder combinations.</p>
              </div>
              {difficultyFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {formatDifficultyLabel(difficultyFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(difficultyCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending difficulty bands in the current filter set.</p>
              ) : (
                Object.entries(difficultyCounts)
                  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                  .map(([difficulty, count]) => {
                    const isFocusedDifficulty = difficultyFilter === difficulty
                    const difficultySummary = difficultySummaries.get(difficulty)

                    return (
                      <div
                        key={difficulty}
                        className={`rounded-2xl border px-4 py-4 transition-colors ${
                          isFocusedDifficulty
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 pr-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text-primary)]">{formatDifficultyLabel(difficulty)}</span>
                              {isFocusedDifficulty ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                              {isFocusedDifficulty ? 'Click to clear this difficulty filter' : 'Click to focus this effort band'}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                            {count} pending
                          </span>
                        </div>

                        {difficultySummary?.leadCandidate && difficultySummary.leadInsight && difficultySummary.leadDecision ? (
                          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(difficultySummary.leadDecision)}`}>
                                {getDecisionLabel(difficultySummary.leadDecision)}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(difficultySummary.leadInsight.triageLevel)}`}>
                                {getTriageLabel(difficultySummary.leadInsight.triageLevel)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(difficultySummary.leadCandidate)}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(difficultySummary.leadCandidate, difficultySummary.leadInsight)}</p>
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => toggleDifficultyFocus(difficulty)}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            aria-pressed={isFocusedDifficulty}
                          >
                            {isFocusedDifficulty ? 'Current difficulty focus' : 'Focus this difficulty'}
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              Narrow the queue to this effort band.
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!difficultySummary?.leadCandidate}
                            onClick={() => {
                              const leadCandidate = difficultySummary?.leadCandidate
                              if (!leadCandidate) return
                              openCandidateFromSummary(leadCandidate.id, () => toggleDifficultyFocus(difficulty, leadCandidate.id))
                            }}
                            aria-controls="review-detail-panel"
                            aria-expanded={difficultySummary?.leadCandidate?.id === selectedCandidate?.id}
                            aria-label={difficultySummary?.leadCandidate ? `Open lead row ${getDisplayTitle(difficultySummary.leadCandidate)} for difficulty ${formatDifficultyLabel(difficulty)}` : undefined}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                          >
                            Open lead row
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              {difficultySummary?.leadCandidate ? getDisplayTitle(difficultySummary.leadCandidate) : 'No lead row available in this difficulty'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by category</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Useful when you want to clear one drill type at a time instead of mixing stance, footwork, and defence rows together.</p>
              </div>
              {categoryFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {categoryFilter === 'uncategorised' ? 'Uncategorised' : categoryFilter}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(categoryCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending categories in the current filter set.</p>
              ) : (
                Object.entries(categoryCounts)
                  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                  .slice(0, 6)
                  .map(([category, count]) => {
                    const isFocusedCategory = categoryFilter === category
                    const categorySummary = categorySummaries.get(category)

                    return (
                      <div
                        key={category}
                        className={`rounded-2xl border px-4 py-4 transition-colors ${
                          isFocusedCategory
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 pr-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium capitalize text-[var(--text-primary)]">{category === 'uncategorised' ? 'Uncategorised' : category}</span>
                              {isFocusedCategory ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                              {isFocusedCategory ? 'Click to clear this category filter' : 'Click to focus this drill type'}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                            {count} pending
                          </span>
                        </div>

                        {categorySummary?.leadCandidate && categorySummary.leadInsight && categorySummary.leadDecision ? (
                          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(categorySummary.leadDecision)}`}>
                                {getDecisionLabel(categorySummary.leadDecision)}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(categorySummary.leadInsight.triageLevel)}`}>
                                {getTriageLabel(categorySummary.leadInsight.triageLevel)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(categorySummary.leadCandidate)}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(categorySummary.leadCandidate, categorySummary.leadInsight)}</p>
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => toggleCategoryFocus(category)}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            aria-pressed={isFocusedCategory}
                          >
                            {isFocusedCategory ? 'Current category focus' : 'Focus this category'}
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              Narrow the queue to this drill type.
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!categorySummary?.leadCandidate}
                            onClick={() => {
                              const leadCandidate = categorySummary?.leadCandidate
                              if (!leadCandidate) return
                              openCandidateFromSummary(leadCandidate.id, () => toggleCategoryFocus(category, leadCandidate.id))
                            }}
                            aria-controls="review-detail-panel"
                            aria-expanded={categorySummary?.leadCandidate?.id === selectedCandidate?.id}
                            aria-label={categorySummary?.leadCandidate ? `Open lead row ${getDisplayTitle(categorySummary.leadCandidate)} for category ${category === 'uncategorised' ? 'Uncategorised' : category}` : undefined}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                          >
                            Open lead row
                            <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                              {categorySummary?.leadCandidate ? getDisplayTitle(categorySummary.leadCandidate) : 'No lead row available in this category'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Duplicate family pressure</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">The biggest clusters first, so Sha-Lyn can clean duplicates instead of reviewing rows in random order.</p>
            </div>
            {duplicateFamilySummary ? (
              <button
                type="button"
                onClick={() => void copyText(duplicateFamilySummary.handoffText, 'Copied duplicate family handoff')}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-primary)]"
              >
                Copy family handoff
              </button>
            ) : null}
          </div>

          {duplicateFamilies.length === 0 ? (
            <p className="mt-5 text-sm text-[var(--text-secondary)]">No dedupe-key families are visible under the current filter set.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {duplicateFamilies.slice(0, 8).map((family) => {
                const isFocusedFamily = familyFilter === family.dedupeKey
                const familyFocusStatusId = `${family.dedupeKey}-family-focus-status`

                return (
                  <div
                    key={family.dedupeKey}
                    className={`w-full rounded-2xl border px-4 py-4 transition-colors ${
                      isFocusedFamily
                        ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                        : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{family.dedupeKey}</p>
                          {isFocusedFamily ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                              Focused
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{family.sampleTitles.join(' • ')}</p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                        {family.count} rows
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {family.statuses.map((status) => (
                        <span key={status} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(status)}`}>
                          {REVIEW_STATUS_LABELS[status]}
                        </span>
                      ))}
                    </div>
                    {family.leadCandidate && family.leadInsight && family.leadDecision ? (
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(family.leadDecision)}`}>
                            {getDecisionLabel(family.leadDecision)}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(family.leadInsight.triageLevel)}`}>
                            {getTriageLabel(family.leadInsight.triageLevel)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(family.leadCandidate)}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(family.leadCandidate, family.leadInsight)}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => focusFamily(family.dedupeKey)}
                        aria-pressed={isFocusedFamily}
                        aria-describedby={familyFocusStatusId}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        {isFocusedFamily ? 'Current family focus' : 'Focus this family'}
                        <span id={familyFocusStatusId} className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          {isFocusedFamily ? 'This duplicate cluster is already focused in the queue.' : 'Narrow the queue to this duplicate cluster.'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={!family.leadCandidate}
                        onClick={() => {
                          const leadCandidate = family.leadCandidate
                          if (!leadCandidate) return
                          openCandidateFromSummary(leadCandidate.id, () => focusFamily(family.dedupeKey, leadCandidate.id))
                        }}
                        aria-controls="review-detail-panel"
                        aria-expanded={family.leadCandidate?.id === selectedCandidate?.id}
                        aria-label={family.leadCandidate ? `Open lead row ${getDisplayTitle(family.leadCandidate)} for duplicate family ${family.dedupeKey}` : undefined}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        Open lead row
                        <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          {family.leadCandidate ? getDisplayTitle(family.leadCandidate) : 'No lead row available in this family'}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Bulk review actions</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Service-role route is wired now, so this panel can actually push review decisions instead of cosplaying as a clipboard.
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Selected rows in this slice</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{visibleSelectedIds.length}</p>
                {hiddenSelectedCount > 0 ? (
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {hiddenSelectedCount} more selected row{hiddenSelectedCount === 1 ? '' : 's'} hidden by the current slice.
                  </p>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Pending {bulkSelectionCounts.pending} • Approved {bulkSelectionCounts.approved} • Merged {bulkSelectionCounts.merged} • Rejected {bulkSelectionCounts.rejected}
              </p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Ready right now: <span className="font-medium text-[var(--text-primary)]">{actionableSelectedLabel}</span>
              </p>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Bulk actions only apply to pending rows in the current slice, so already-reviewed or hidden selections stay available for comparison but are skipped.
                {skippedSelectedCount > 0 ? ` ${skippedSelectedCount} visible reviewed row${skippedSelectedCount === 1 ? '' : 's'} will be ignored.` : ''}
                {hiddenSelectedCount > 0 ? ` ${hiddenSelectedCount} hidden selected row${hiddenSelectedCount === 1 ? '' : 's'} will stay untouched until visible again.` : ''}
              </p>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Shortcuts: <span className="font-medium text-[var(--text-secondary)]">Shift + X</span> selects visible pending, <span className="font-medium text-[var(--text-secondary)]">c</span> clears the full selection, then <span className="font-medium text-[var(--text-secondary)]">Shift + A / R / M</span> runs the bulk action.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleSelectAllVisiblePending}
              aria-keyshortcuts={REVIEW_SELECT_ALL_VISIBLE_PENDING_SHORTCUTS}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              {allVisiblePendingSelected ? 'Clear visible pending selection' : 'Select all visible pending'}
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={clearSelectedRows}
              aria-keyshortcuts={REVIEW_CLEAR_SELECTION_SHORTCUTS}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
            >
              Clear all selected rows
            </button>

            <button
              type="button"
              disabled={actionableSelectedIds.length === 0 || isSubmitting}
              onClick={() =>
                runReviewAction({
                  action: 'approve',
                  candidateIds: actionableSelectedIds,
                  successLabel:
                    actionableSelectedIds.length === 1
                      ? 'Approved candidate into the drill library.'
                      : `Approved ${actionableSelectedIds.length} candidates into the drill library.`,
                })
              }
              aria-keyshortcuts={REVIEW_BULK_APPROVE_SHORTCUTS}
              title={bulkActionTitle}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Approve visible pending</span>
              <span className="text-xs text-[var(--text-tertiary)]">{actionableSelectedIds.length > 0 ? `${actionableSelectedIds.length} ready` : 'Create drills'}</span>
            </button>

            <button
              type="button"
              disabled={actionableSelectedIds.length === 0 || isSubmitting}
              onClick={() =>
                runReviewAction({
                  action: 'reject',
                  candidateIds: actionableSelectedIds,
                  successLabel: actionableSelectedIds.length === 1 ? 'Rejected candidate.' : `Rejected ${actionableSelectedIds.length} candidates.`,
                })
              }
              aria-keyshortcuts={REVIEW_BULK_REJECT_SHORTCUTS}
              title={bulkActionTitle}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Reject visible pending</span>
              <span className="text-xs text-[var(--text-tertiary)]">{actionableSelectedIds.length > 0 ? `${actionableSelectedIds.length} ready` : 'Mark rejected'}</span>
            </button>

            <label className="block text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Merge target</span>
              <select
                ref={bulkMergeTargetSelectRef}
                value={preferredMergeTargetId ?? ''}
                aria-describedby={`${REVIEW_MERGE_TARGET_HELP_ID} bulk-merge-target-status${mergeTargetNeedsExplicitSelection ? ' bulk-merge-target-warning' : ''}${matchedDrills.length > 1 ? ' bulk-merge-target-shortcuts' : ''}`}
                aria-invalid={mergeTargetNeedsExplicitSelection ? true : undefined}
                aria-keyshortcuts={REVIEW_MERGE_TARGET_SHORTCUTS}
                onChange={(event) => setSelectedCanonicalDrillId(event.target.value || null)}
                onKeyDown={handleSelectEscape}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="">No target selected</option>
                {matchedDrills.map((drill) => (
                  <option key={drill.id} value={drill.id}>
                    {drill.title} · Match {drill.matchScore}
                  </option>
                ))}
              </select>
              <span id="bulk-merge-target-status" className="mt-2 block text-xs leading-5 text-[var(--text-tertiary)]">
                {preferredMergeTarget
                  ? `${isUsingAutoMergeTarget ? 'Auto-selected top match' : 'Selected target'}: ${preferredMergeTarget.title} • Match ${preferredMergeTarget.matchScore}${preferredMergeTarget.matchReasons[0] ? ` • ${preferredMergeTarget.matchReasons[0]}` : ''}`
                  : 'Select a candidate with likely library matches to enable merge actions.'}
              </span>
              {mergeTargetNeedsExplicitSelection ? (
                <span id="bulk-merge-target-warning" className="mt-1 block text-xs leading-5 text-amber-700 dark:text-amber-400">
                  Multiple matches found. Pick one target before running merge actions.
                </span>
              ) : null}
              {matchedDrills.length > 1 ? (
                <span id="bulk-merge-target-shortcuts" className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">Shortcuts 4 to 9 pick the top visible merge targets by rank, while ← / → or ; and ' keep cycling.</span>
              ) : null}
            </label>

            <button
              type="button"
              disabled={actionableSelectedIds.length === 0 || !canRunMergeAction || isSubmitting}
              onClick={() =>
                canRunMergeAction && preferredMergeTargetId
                  ? runReviewAction({
                      action: 'merge',
                      candidateIds: actionableSelectedIds,
                      canonicalDrillId: preferredMergeTargetId,
                      successLabel:
                        actionableSelectedIds.length === 1
                          ? 'Merged candidate into the selected drill.'
                          : `Merged ${actionableSelectedIds.length} candidates into the selected drill.`,
                    })
                  : setActionError(mergeTargetPrompt)
              }
              aria-describedby={`bulk-merge-target-status${mergeTargetNeedsExplicitSelection ? ' bulk-merge-target-warning' : ''}`}
              aria-keyshortcuts={REVIEW_BULK_MERGE_SHORTCUTS}
              title={canRunMergeAction ? bulkActionTitle : mergeTargetPrompt}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Merge visible pending</span>
              <span className="text-xs text-[var(--text-tertiary)]">{canRunMergeAction ? (actionableSelectedIds.length > 0 ? `${actionableSelectedIds.length} ready` : 'Use chosen library match') : mergeTargetPrompt}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Visible raw drill candidates</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Filterable internal scan of the raw intake layer, ordered for curation rather than final library use.
              </p>
            </div>
          </div>

          {scopedCandidateIds ? (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold uppercase tracking-[0.14em]">Scoped review set</p>
                  <p className="mt-2 leading-6">
                    Showing {sortedCandidates.length} of {scopeRequestedCount} linked raw candidate{scopeRequestedCount === 1 ? '' : 's'} passed in from the drill library.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-keyshortcuts={REVIEW_COPY_VIEW_SHORTCUTS}
                    aria-describedby="review-current-view-copy-description"
                    onClick={() => copyCurrentView('Copied scoped review view link')}
                    className="inline-flex rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-950 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-100 dark:hover:bg-sky-900/30"
                  >
                    Copy scope link (V)
                  </button>
                  <button
                    type="button"
                    onClick={clearScopedReview}
                    className="inline-flex rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-950 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-100 dark:hover:bg-sky-900/30"
                  >
                    Clear scope
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {sortedCandidates.length === 0 ? (
            <EmptyState
              title="No matching candidates"
              body={
                hiddenSelectedCandidate
                  ? `${getDisplayTitle(hiddenSelectedCandidate)} is still selected, but the current slice hides it. Reveal that row or peel back the active modifiers to get back to it.`
                  : activeViewChips.length > 0
                    ? 'Nothing in raw_drill_candidates matches the current filter combination. Peel back the last modifier or reset the queue to get back to a wider slice.'
                    : 'Nothing in raw_drill_candidates matches the current filter combination.'
              }
              footer={
                activeViewChips.length > 0 || hiddenSelectedCandidate ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {hiddenSelectedCandidate ? (
                        <button
                          type="button"
                          onClick={revealHiddenSelectedCandidate}
                          className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                        >
                          Reveal selected row
                        </button>
                      ) : null}
                      {lastActiveViewModifierLabel ? (
                        <button
                          type="button"
                          onClick={clearLastViewModifier}
                          aria-keyshortcuts={REVIEW_PEEL_BACK_SHORTCUTS}
                          className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                        >
                          Peel back last
                          <span className="ml-2 text-[var(--text-tertiary)]">Backspace • {lastActiveViewModifierLabel}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={clearAllViewFilters}
                        aria-keyshortcuts={REVIEW_RESET_VIEW_SHORTCUTS}
                        className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        Reset view
                        <span className="ml-2 text-[var(--text-tertiary)]">0</span>
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Active modifiers blocking results</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeViewChips.map((chip) => (
                          <button
                            key={`empty-${chip.key}`}
                            type="button"
                            onClick={chip.onClear}
                            aria-label={chip.clearLabel}
                            title={chip.clearLabel}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                          >
                            <span>{chip.label}</span>
                            <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                              ×
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <>
              <p id="review-queue-list-description" className="sr-only">
                {queueListDescription}
              </p>
              <p id={REVIEW_QUEUE_KEYBOARD_HELP_ID} className="sr-only">
                Queue keyboard help: use J and K or the arrow keys to move between visible rows, N and P to jump between pending rows, and L to return to the lead row. Use G or Home for the first visible row, Shift plus G or End for the last visible row, and Page Up or Page Down to jump ten rows at a time. Press Enter or S to apply the suggested action for the active row, X or Space to toggle bulk selection, F to focus the active duplicate family, bracket keys and comma or period to move through families, number keys 4 to 9 or left and right arrows to change merge targets, 1 to 3 to jump routes, O to cycle sort, Backspace to peel back the view, 0 to reset the queue, question mark for full shortcut help, and Escape to return focus from row controls to the active queue row.
              </p>
              <div id="review-queue-list" role="list" aria-label="Review queue candidates" aria-describedby={`review-queue-list-description ${REVIEW_QUEUE_KEYBOARD_HELP_ID}`} aria-keyshortcuts={REVIEW_QUEUE_NAVIGATION_SHORTCUTS} className="space-y-4">
                <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)] lg:flex lg.items-center lg:justify-between">
                <span>Sorted by <span className="font-medium text-[var(--text-primary)]">{SORT_MODE_LABELS[sortMode]}</span></span>
                <span>{sortedCandidates.length} visible candidates</span>
              </div>
              {sortedCandidates.map((candidate, index) => {
                const insight = candidateInsights.get(candidate.id)
                const isSelected = selectedCandidate?.id === candidate.id
                const isBulkSelected = visibleSelectedIds.includes(candidate.id)

                if (!insight) return null

                const suggestedAction = getCandidateDecisionHint(candidate, insight)
                const rowTitleId = `candidate-title-${candidate.id}`
                const rowSummaryId = `candidate-summary-${candidate.id}`
                const suggestedActionLabel = getDecisionLabel(suggestedAction)
                const rowPositionSummary = `Visible row ${index + 1} of ${sortedCandidates.length}.`
                const rowLeadSummary = leadVisibleCandidate?.id === candidate.id ? 'Lead visible candidate in the current queue slice.' : ''
                const rowBulkSelectionSummary = isBulkSelected ? 'Selected for bulk actions.' : 'Not selected for bulk actions.'
                const rowSuggestedActionSummary =
                  candidate.review_status !== 'pending'
                    ? `Suggested action unavailable because this row is already ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()}.`
                    : suggestedAction === 'merge'
                      ? isSelected
                        ? canRunMergeAction
                          ? 'Suggested merge is ready with the current canonical target.'
                          : 'Suggested merge is blocked until a canonical target is explicitly chosen.'
                        : 'Suggested merge is available after selecting this row.'
                      : `Suggested action is ${suggestedActionLabel}.`
                const suggestedActionAriaLabel =
                  candidate.review_status !== 'pending'
                    ? `${suggestedActionLabel} suggestion unavailable for ${getDisplayTitle(candidate)} because this row is already ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()}.`
                    : suggestedAction === 'merge'
                      ? isSelected
                        ? canRunMergeAction
                          ? `Apply suggested merge for ${getDisplayTitle(candidate)} using the selected canonical target.`
                          : `Suggested merge for ${getDisplayTitle(candidate)} is unavailable until a canonical target is explicitly chosen.`
                        : `Suggested merge for ${getDisplayTitle(candidate)} is unavailable until this row is selected.`
                      : `Apply suggested ${suggestedActionLabel.toLowerCase()} action for ${getDisplayTitle(candidate)}.`
                const approveButtonAriaLabel = `Approve ${getDisplayTitle(candidate)} and create a drill.`
                const rejectButtonAriaLabel = `Reject ${getDisplayTitle(candidate)}.`
                const mergeButtonAriaLabel = !isSelected
                  ? `Merge ${getDisplayTitle(candidate)} after selecting this row and choosing a canonical target.`
                  : canRunMergeAction
                    ? `Merge ${getDisplayTitle(candidate)} into the selected canonical target.`
                    : `Merge ${getDisplayTitle(candidate)} after choosing a canonical target.`
                const suggestedActionDescribedBy = `${rowSummaryId}${suggestedAction === 'merge' && isSelected ? ` bulk-merge-target-status${mergeTargetNeedsExplicitSelection ? ' bulk-merge-target-warning' : ''}` : ''}`
                const mergeActionDescribedBy = `${rowSummaryId}${isSelected ? ` bulk-merge-target-status${mergeTargetNeedsExplicitSelection ? ' bulk-merge-target-warning' : ''}` : ''}`

                return (
                  <article
                    key={candidate.id}
                    id={`candidate-${candidate.id}`}
                    role="listitem"
                    aria-roledescription="review queue row"
                    aria-posinset={index + 1}
                    aria-setsize={sortedCandidates.length}
                    aria-current={isSelected ? 'true' : undefined}
                    tabIndex={isSelected ? 0 : -1}
                    aria-labelledby={rowTitleId}
                    aria-describedby={`${rowSummaryId} ${REVIEW_QUEUE_KEYBOARD_HELP_ID}`}
                    aria-keyshortcuts={REVIEW_QUEUE_ROW_SHORTCUTS}
                    onFocusCapture={() => {
                      if (selectedCandidateId === candidate.id) return
                      selectCandidate(candidate.id, { scrollIntoView: false })
                    }}
                    className={`rounded-3xl border bg-[var(--surface-elevated)] p-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-primary)] focus-within:ring-2 focus-within:ring-[var(--accent-primary)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface-primary)] ${
                      isSelected ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)]'
                    }`}
                  >
                    <p id={rowSummaryId} className="sr-only">
                      {`${isSelected ? 'Current queue row.' : 'Queue row.'} ${rowPositionSummary} Status ${REVIEW_STATUS_LABELS[candidate.review_status]}. ${getTriageLabel(insight.triageLevel)}. ${rowLeadSummary} ${rowBulkSelectionSummary} ${rowSuggestedActionSummary}${candidate.dedupe_key ? ` Family ${candidate.dedupe_key}.` : ''} Press Enter or S to apply the suggested action, X or Space to toggle bulk selection, and Escape to return focus to this row from its controls.`}
                    </p>
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-3">
                          <label className="mt-0.5 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={isBulkSelected}
                              aria-label={`${isBulkSelected ? 'Deselect' : 'Select'} ${getDisplayTitle(candidate)} for bulk actions`}
                              aria-describedby={rowSummaryId}
                              aria-keyshortcuts={REVIEW_SELECT_SHORTCUTS}
                              onChange={() => toggleSelected(candidate.id)}
                              className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-primary)] text-[var(--accent-primary)]"
                            />
                            <span className="sr-only">Select {getDisplayTitle(candidate)}</span>
                          </label>

                          <button
                            type="button"
                            aria-controls="review-detail-panel"
                            aria-describedby={rowSummaryId}
                            aria-expanded={isSelected}
                            aria-label={`${isSelected ? 'Viewing' : 'Open'} details for ${getDisplayTitle(candidate)}`}
                            onClick={() => focusCandidateDetailPanel(candidate.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 id={rowTitleId} className="text-lg font-semibold text-[var(--text-primary)]">{getDisplayTitle(candidate)}</h3>
                              <span aria-hidden="true" className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(candidate.review_status)}`}>
                                {REVIEW_STATUS_LABELS[candidate.review_status]}
                              </span>
                              <span aria-hidden="true" className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(insight.triageLevel)}`}>
                                {getTriageLabel(insight.triageLevel)}
                              </span>
                              <span aria-hidden="true" className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getAiDecisionTone(candidate.ai_decision ?? null)}`}>
                                {getAiDecisionLabel(candidate.ai_decision ?? null)}
                              </span>
                              <span aria-hidden="true" className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDecisionTone(suggestedAction)}`}>
                                {getDecisionLabel(suggestedAction)}
                              </span>
                              {candidate.dedupe_key && (
                                <span aria-hidden="true" className="inline-flex rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                  Family: {candidate.dedupe_key}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">Raw title: {candidate.raw_title || 'Missing raw title'}</p>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>
                            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{insight.triageSummary}</p>
                            {candidate.ai_reason ? (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                                AI: {candidate.ai_reason}{typeof candidate.ai_confidence === 'number' ? ` (${Math.round(candidate.ai_confidence * 100)}%)` : ''}
                              </p>
                            ) : null}
                            {candidate.when_to_assign && (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Assign when: {candidate.when_to_assign}</p>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-2">
                        <button
                          type="button"
                          aria-describedby={suggestedActionDescribedBy}
                          aria-keyshortcuts={REVIEW_SUGGESTED_ACTION_SHORTCUTS}
                          aria-label={suggestedActionAriaLabel}
                          disabled={isSubmitting || candidate.review_status !== 'pending' || (suggestedAction === 'merge' && (!isSelected || !canRunMergeAction))}
                          onClick={() => {
                            if (suggestedAction === 'keep') {
                              runReviewAction({
                                action: 'approve',
                                candidateIds: [candidate.id],
                                successLabel: 'Applied suggested action and approved candidate into the drill library.',
                              })
                              return
                            }

                            if (suggestedAction === 'reject') {
                              runReviewAction({
                                action: 'reject',
                                candidateIds: [candidate.id],
                                successLabel: 'Applied suggested action and rejected candidate.',
                              })
                              return
                            }

                            if (!isSelected) {
                              setActionError('Select this candidate first to apply the suggested merge.')
                              return
                            }

                            if (!canRunMergeAction || !preferredMergeTargetId) {
                              setActionError(mergeTargetPrompt)
                              return
                            }

                            runReviewAction({
                              action: 'merge',
                              candidateIds: [candidate.id],
                              canonicalDrillId: preferredMergeTargetId,
                              successLabel: 'Applied suggested action and merged candidate into the selected drill.',
                            })
                          }}
                          className={`sm:col-span-2 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                            suggestedAction === 'keep'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/30'
                              : suggestedAction === 'merge'
                                ? 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300 dark:hover:bg-sky-950/30'
                                : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30'
                          }`}
                          title={
                            candidate.review_status !== 'pending'
                              ? `This candidate is already ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()}.`
                              : suggestedAction === 'merge'
                                ? isSelected
                                  ? canRunMergeAction
                                    ? 'Apply the suggested merge into the selected canonical target.'
                                    : mergeTargetPrompt
                                  : 'Select this candidate first to apply the suggested merge.'
                                : 'Apply the queue recommendation for this candidate.'
                          }
                        >
                          Apply suggestion
                          <span className={`mt-1 block text-xs font-normal ${
                            suggestedAction === 'keep'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : suggestedAction === 'merge'
                                ? 'text-sky-700 dark:text-sky-400'
                                : 'text-rose-700 dark:text-rose-400'
                          }`}>
                            {suggestedActionLabel} • {getSuggestedActionShortcutLabel(suggestedAction)}
                            {suggestedAction === 'merge'
                              ? isSelected
                                ? canRunMergeAction
                                  ? ' using the chosen target'
                                  : ' once a target is explicitly chosen'
                                : ' after selecting this row'
                              : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-describedby={rowSummaryId}
                          aria-keyshortcuts={REVIEW_APPROVE_SHORTCUTS}
                          aria-label={approveButtonAriaLabel}
                          disabled={isSubmitting || candidate.review_status !== 'pending'}
                          onClick={() =>
                            runReviewAction({
                              action: 'approve',
                              candidateIds: [candidate.id],
                              successLabel: 'Approved candidate into the drill library.',
                            })
                          }
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Approve
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">Create drill</span>
                        </button>
                        <button
                          type="button"
                          aria-describedby={rowSummaryId}
                          aria-keyshortcuts={REVIEW_REJECT_SHORTCUTS}
                          aria-label={rejectButtonAriaLabel}
                          disabled={isSubmitting || candidate.review_status !== 'pending'}
                          onClick={() =>
                            runReviewAction({
                              action: 'reject',
                              candidateIds: [candidate.id],
                              successLabel: 'Rejected candidate.',
                            })
                          }
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Reject
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">Mark rejected</span>
                        </button>
                        <button
                          type="button"
                          aria-describedby={mergeActionDescribedBy}
                          aria-keyshortcuts={REVIEW_MERGE_SHORTCUTS}
                          aria-label={mergeButtonAriaLabel}
                          disabled={isSubmitting || candidate.review_status !== 'pending' || !isSelected || !canRunMergeAction}
                          onClick={() =>
                            canRunMergeAction && preferredMergeTargetId
                              ? runReviewAction({
                                  action: 'merge',
                                  candidateIds: [candidate.id],
                                  canonicalDrillId: preferredMergeTargetId,
                                  successLabel: 'Merged candidate into the selected drill.',
                                })
                              : setActionError(mergeTargetPrompt)
                          }
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                          title={isSelected ? (canRunMergeAction ? 'Merge this candidate into the chosen canonical target.' : mergeTargetPrompt) : 'Select this candidate first to choose a merge target.'}
                        >
                          Merge
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">{isSelected ? (canRunMergeAction ? 'Use chosen target' : mergeTargetPrompt) : 'Select first'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                      <InfoBlock label="Category" value={candidate.category || 'Uncategorised'} />
                      <InfoBlock label="Grade" value={formatGradeLevel(candidate.grade_level)} />
                      <InfoBlock label="Source" value={getSourceLabel(candidate)} subdued={candidate.source_type || undefined} />
                      <InfoBlock
                        label="Completeness"
                        value={`${insight.completenessScore}/6`}
                        subdued={insight.completenessLabel}
                      />
                      <InfoBlock label="Suggested action" value={getDecisionLabel(suggestedAction)} subdued={getReviewerNextMove(candidate, insight)} />
                      <InfoBlock
                        label="Duplicate pressure"
                        value={`${insight.familySize} row${insight.familySize === 1 ? '' : 's'}`}
                        subdued={candidate.dedupe_key ? candidate.dedupe_key : 'No dedupe key yet'}
                      />
                      <InfoBlock
                        label="Structure"
                        value={`${insight.stepsCount} steps`}
                        subdued={`${insight.focusPointsCount} focus points • ${insight.mistakesCount} common mistakes`}
                      />
                    </div>
                  </article>
                )
              })}
              </div>
            </>
          )}
        </div>

        <aside id="review-detail-panel" ref={detailPanelRef} tabIndex={-1} aria-labelledby={detailPanelLabelledBy} aria-describedby="review-detail-intro review-detail-selection-context" aria-keyshortcuts={REVIEW_RETURN_TO_QUEUE_SHORTCUTS} className="xl:sticky xl:top-6 xl:self-start max-xl:order-first focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-primary)]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
            <h2 id="review-detail-title" className="text-lg font-semibold text-[var(--text-primary)]">Review detail</h2>
            <p id="review-detail-intro" className="mt-1 text-sm text-[var(--text-secondary)]">
              Honest prep for approve, reject, and merge, with the service-role write path finally wired instead of mocked. Press Esc to jump back to the active queue row.
            </p>
            <p id="review-detail-selection-context" className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {selectedCandidateDetailDescription}
            </p>

            {!selectedCandidate ? (
              hiddenSelectedCandidate ? (
                <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-amber-950 dark:text-amber-100">{getDisplayTitle(hiddenSelectedCandidate)} is selected, but hidden by the current slice.</p>
                  <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-200/80">
                    Status: {REVIEW_STATUS_LABELS[hiddenSelectedCandidate.review_status]} • Source: {getSourceLabel(hiddenSelectedCandidate)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={revealHiddenSelectedCandidate}
                      className="inline-flex rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
                    >
                      Reveal selected row
                    </button>
                    <button
                      type="button"
                      onClick={clearAllViewFilters}
                      aria-keyshortcuts={REVIEW_RESET_VIEW_SHORTCUTS}
                      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      Reset view
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--text-secondary)]">Pick a visible candidate to inspect its detail panel.</p>
              )
            ) : (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Review navigator</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Candidate {selectedCandidateIndex + 1} of {sortedCandidates.length} visible
                        {selectedPendingIndex >= 0 ? ` • Pending item ${selectedPendingIndex + 1} of ${pendingCandidates.length}` : ' • Not in the pending slice'}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      {SORT_MODE_LABELS[sortMode]}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      {selectedPendingIndex >= 0
                        ? `Pending progress: ${selectedPendingIndex + 1}/${pendingCandidates.length} • ${pendingRowsAfterCurrent} left after this row`
                        : pendingCandidates.length > 0
                          ? `Pending progress: current row already reviewed • ${pendingCandidates.length} pending left in this view`
                          : 'Pending progress: queue slice is clear'}
                    </span>
                    {selectedCandidate.dedupe_key ? (
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                        {selectedFamilyPendingIndex >= 0
                          ? `Family progress: ${selectedFamilyPendingIndex + 1}/${selectedFamilyPendingCandidates.length} pending • ${familyPendingRowsAfterCurrent} left in family`
                          : selectedFamilyPendingCandidates.length > 0
                            ? `Family progress: ${selectedFamilyPendingCandidates.length} pending left in ${selectedCandidate.dedupe_key}`
                            : 'Family progress: no pending rows left in this family'}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <button
                      type="button"
                      aria-keyshortcuts={REVIEW_PREVIOUS_VISIBLE_SHORTCUTS}
                      aria-controls="review-detail-panel"
                      aria-label={previousVisibleCandidate ? `Open previous visible row ${getDisplayTitle(previousVisibleCandidate)} in the review detail panel` : undefined}
                      disabled={!previousVisibleCandidate || previousVisibleCandidate.id === selectedCandidate.id}
                      onClick={() => previousVisibleCandidate ? selectCandidate(previousVisibleCandidate.id, { revealInQueue: true }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Previous visible
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {previousVisibleCandidate
                          ? `${previousVisibleWraps ? 'Wrap to' : 'Shortcut K •'} ${getDisplayTitle(previousVisibleCandidate)}`
                          : 'No other visible rows in this slice'}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-keyshortcuts={REVIEW_NEXT_VISIBLE_SHORTCUTS}
                      aria-controls="review-detail-panel"
                      aria-label={nextVisibleCandidate ? `Open next visible row ${getDisplayTitle(nextVisibleCandidate)} in the review detail panel` : undefined}
                      disabled={!nextVisibleCandidate || nextVisibleCandidate.id === selectedCandidate.id}
                      onClick={() => nextVisibleCandidate ? selectCandidate(nextVisibleCandidate.id, { revealInQueue: true }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Next visible
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {nextVisibleCandidate
                          ? `${nextVisibleWraps ? 'Wrap to' : 'Shortcut J •'} ${getDisplayTitle(nextVisibleCandidate)}`
                          : 'No other visible rows in this slice'}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-keyshortcuts={REVIEW_PREVIOUS_PENDING_SHORTCUTS}
                      aria-controls="review-detail-panel"
                      aria-label={previousPendingCandidate ? `Open previous pending row ${getDisplayTitle(previousPendingCandidate)} in the review detail panel` : undefined}
                      disabled={!previousPendingCandidate || previousPendingCandidate.id === selectedCandidate.id}
                      onClick={() => previousPendingCandidate ? selectCandidate(previousPendingCandidate.id, { revealInQueue: true }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Previous pending
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {previousPendingCandidate
                          ? `${previousPendingWraps ? 'Wrap to' : 'Shortcut P •'} ${getDisplayTitle(previousPendingCandidate)}`
                          : 'No pending rows in this view'}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-keyshortcuts={REVIEW_NEXT_PENDING_SHORTCUTS}
                      aria-controls="review-detail-panel"
                      aria-label={nextPendingCandidate ? `Open next pending row ${getDisplayTitle(nextPendingCandidate)} in the review detail panel` : undefined}
                      disabled={!nextPendingCandidate || nextPendingCandidate.id === selectedCandidate.id}
                      onClick={() => nextPendingCandidate ? selectCandidate(nextPendingCandidate.id, { revealInQueue: true }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Next pending
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {nextPendingCandidate
                          ? `${nextPendingWraps ? 'Wrap to' : 'Shortcut N •'} ${getDisplayTitle(nextPendingCandidate)}`
                          : 'No pending rows in this view'}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-keyshortcuts={REVIEW_LEAD_VISIBLE_SHORTCUTS}
                      aria-controls="review-detail-panel"
                      aria-label={leadVisibleCandidate ? `Open lead visible row ${getDisplayTitle(leadVisibleCandidate)} in the review detail panel` : undefined}
                      disabled={!leadVisibleCandidate || leadVisibleCandidate.id === selectedCandidate.id}
                      onClick={() => leadVisibleCandidate ? selectCandidate(leadVisibleCandidate.id, { revealInQueue: true }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Jump to lead
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {leadVisibleCandidate
                          ? leadVisibleCandidate.id === selectedCandidate.id
                            ? 'Shortcut L • Already on the lead visible candidate'
                            : `Shortcut L • ${getDisplayTitle(leadVisibleCandidate)}`
                          : 'Shortcut L • No lead candidate in the current slice'}
                      </span>
                    </button>
                  </div>

                  {selectedCandidate.dedupe_key ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        aria-keyshortcuts={REVIEW_FAMILY_FOCUS_SHORTCUTS}
                        aria-pressed={familyFilter === selectedCandidate.dedupe_key}
                        aria-describedby={`${selectedCandidate.id}-family-focus-status`}
                        onClick={() =>
                          familyFilter === selectedCandidate.dedupe_key
                            ? clearFamilyFocus()
                            : focusFamily(selectedCandidate.dedupe_key!, selectedCandidate.id)
                        }
                        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        {familyFilter === selectedCandidate.dedupe_key ? 'Clear family focus' : 'Focus this family'}
                        <span id={`${selectedCandidate.id}-family-focus-status`} className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          Shortcut F • {selectedCandidate.dedupe_key} • {familyFilter === selectedCandidate.dedupe_key ? 'family focus active' : 'family focus inactive'}
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-keyshortcuts={REVIEW_PREVIOUS_DUPLICATE_FAMILY_SHORTCUTS}
                        aria-controls="review-detail-panel"
                        aria-label={previousDuplicateFamily ? `Open previous duplicate family ${previousDuplicateFamily.dedupeKey} in the review detail panel` : undefined}
                        disabled={!previousDuplicateFamily || previousDuplicateFamily.dedupeKey === selectedCandidate.dedupe_key}
                        onClick={() => previousDuplicateFamily ? focusFamily(previousDuplicateFamily.dedupeKey, previousDuplicateFamily.leadCandidate?.id ?? null) : null}
                        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        Previous duplicate family
                        <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          {previousDuplicateFamily ? `Shortcut [ • ${previousDuplicateFamily.dedupeKey} • ${previousDuplicateFamily.count} rows` : 'No earlier pending family visible'}
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-keyshortcuts={REVIEW_NEXT_DUPLICATE_FAMILY_SHORTCUTS}
                        aria-controls="review-detail-panel"
                        aria-label={nextDuplicateFamily ? `Open next duplicate family ${nextDuplicateFamily.dedupeKey} in the review detail panel` : undefined}
                        disabled={!nextDuplicateFamily || nextDuplicateFamily.dedupeKey === selectedCandidate.dedupe_key}
                        onClick={() => nextDuplicateFamily ? focusFamily(nextDuplicateFamily.dedupeKey, nextDuplicateFamily.leadCandidate?.id ?? null) : null}
                        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        Next duplicate family
                        <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          {nextDuplicateFamily ? `Shortcut ] • ${nextDuplicateFamily.dedupeKey} • ${nextDuplicateFamily.count} rows` : 'No other pending family visible'}
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {previousFamilyCandidate || nextFamilyCandidate ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-keyshortcuts={REVIEW_PREVIOUS_FAMILY_ROW_SHORTCUTS}
                        aria-controls="review-detail-panel"
                        aria-label={previousFamilyCandidate ? `Open previous family row ${getDisplayTitle(previousFamilyCandidate)} in the review detail panel` : undefined}
                        disabled={!previousFamilyCandidate || previousFamilyCandidate.id === selectedCandidate.id}
                        onClick={() => previousFamilyCandidate ? selectCandidate(previousFamilyCandidate.id, { revealInQueue: true }) : null}
                        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        Previous family row
                        <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          {previousFamilyCandidate
                            ? `${previousFamilyWraps ? 'Wrap to' : 'Shortcut , •'} ${getDisplayTitle(previousFamilyCandidate)}`
                            : 'No other rows in this visible family cluster'}
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-keyshortcuts={REVIEW_NEXT_FAMILY_ROW_SHORTCUTS}
                        aria-controls="review-detail-panel"
                        aria-label={nextFamilyCandidate ? `Open next family row ${getDisplayTitle(nextFamilyCandidate)} in the review detail panel` : undefined}
                        disabled={!nextFamilyCandidate || nextFamilyCandidate.id === selectedCandidate.id}
                        onClick={() => nextFamilyCandidate ? selectCandidate(nextFamilyCandidate.id, { revealInQueue: true }) : null}
                        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        Next family row
                        <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                          {nextFamilyCandidate
                            ? `${nextFamilyWraps ? 'Wrap to' : 'Shortcut . •'} ${getDisplayTitle(nextFamilyCandidate)}`
                            : 'No other rows in this visible family cluster'}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
                {(() => {
                  const insight = candidateInsights.get(selectedCandidate.id)

                  if (!insight) {
                    return <p className="text-sm text-[var(--text-secondary)]">Candidate detail is unavailable.</p>
                  }

                  const suggestedAction = getCandidateDecisionHint(selectedCandidate, insight)
                  const detailActionsDescriptionId = `${selectedCandidate.id}-detail-actions-description`
                  const detailNextPendingId = `${selectedCandidate.id}-detail-next-pending`
                  const detailActionsContextIds = `${detailActionsDescriptionId} ${detailNextPendingId}`
                  const detailSuggestedActionHintId = `${selectedCandidate.id}-detail-suggested-action-hint`
                  const detailApproveActionHintId = `${selectedCandidate.id}-detail-approve-action-hint`
                  const detailRejectActionHintId = `${selectedCandidate.id}-detail-reject-action-hint`
                  const detailMergeActionHintId = `${selectedCandidate.id}-detail-merge-action-hint`

                  return (
                    <>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Quick review actions</p>
                            <p id={detailActionsDescriptionId} className="mt-2 text-sm text-[var(--text-secondary)]">
                              {selectedCandidateIsPending
                                ? 'Review this row from the detail panel, then keep moving through the pending queue without bouncing back to the list.'
                                : `This row is already ${REVIEW_STATUS_LABELS[selectedCandidate.review_status].toLowerCase()}, so actions are locked to prevent accidental re-review.`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {selectedCandidateHandoff ? (
                              <button
                                type="button"
                                aria-keyshortcuts={REVIEW_COPY_CANDIDATE_HANDOFF_SHORTCUTS}
                                aria-describedby={detailActionsContextIds}
                                onClick={copySelectedCandidateHandoff}
                                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                Copy candidate handoff
                                <span className="sr-only">Shortcut Y</span>
                              </button>
                            ) : null}
                            {nextPendingCandidate && nextPendingCandidate.id !== selectedCandidate.id ? (
                              <span id={detailNextPendingId} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                Next pending: {getDisplayTitle(nextPendingCandidate)}
                              </span>
                            ) : (
                              <span id={detailNextPendingId} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                No later pending row in this view
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            aria-keyshortcuts={REVIEW_SUGGESTED_ACTION_SHORTCUTS}
                            aria-describedby={`${detailActionsContextIds} ${detailSuggestedActionHintId}${suggestedAction === 'merge' ? ` ${selectedCandidate.id}-merge-target-status${mergeTargetNeedsExplicitSelection ? ` ${selectedCandidate.id}-merge-target-warning` : ''}` : ''}`}
                            disabled={!selectedCandidateIsPending || isSubmitting || (suggestedAction === 'merge' && !canRunMergeAction)}
                            onClick={() => {
                              if (suggestedAction === 'keep') {
                                runReviewAction({
                                  action: 'approve',
                                  candidateIds: [selectedCandidate.id],
                                  successLabel: 'Applied suggested action and approved candidate into the drill library.',
                                })
                                return
                              }

                              if (suggestedAction === 'reject') {
                                runReviewAction({
                                  action: 'reject',
                                  candidateIds: [selectedCandidate.id],
                                  successLabel: 'Applied suggested action and rejected candidate.',
                                })
                                return
                              }

                              if (!canRunMergeAction || !preferredMergeTargetId) {
                                setActionError(mergeTargetPrompt)
                                return
                              }

                              runReviewAction({
                                action: 'merge',
                                candidateIds: [selectedCandidate.id],
                                canonicalDrillId: preferredMergeTargetId,
                                successLabel: 'Applied suggested action and merged candidate into the selected drill.',
                              })
                            }}
                            className={`sm:col-span-2 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                              suggestedAction === 'keep'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/30'
                                : suggestedAction === 'merge'
                                  ? 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300 dark:hover:bg-sky-950/30'
                                  : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30'
                            }`}
                          >
                            Apply suggested action
                            <span id={detailSuggestedActionHintId} className={`mt-1 block text-xs font-normal ${
                              suggestedAction === 'keep'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : suggestedAction === 'merge'
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-rose-700 dark:text-rose-400'
                            }`}>
                              {getSuggestedActionShortcutLabel(suggestedAction)} • {getSuggestedActionShortcutHint(suggestedAction, canRunMergeAction)}
                            </span>
                          </button>

                          <button
                            type="button"
                            aria-keyshortcuts={REVIEW_APPROVE_SHORTCUTS}
                            aria-describedby={`${detailActionsContextIds} ${detailApproveActionHintId}`}
                            disabled={!selectedCandidateIsPending || isSubmitting}
                            onClick={() =>
                              runReviewAction({
                                action: 'approve',
                                candidateIds: [selectedCandidate.id],
                                successLabel: 'Approved candidate into the drill library.',
                              })
                            }
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                          >
                            Approve candidate
                            <span id={detailApproveActionHintId} className="mt-1 block text-xs font-normal text-emerald-700 dark:text-emerald-400">Shortcut A • Creates a drill and advances selection</span>
                          </button>

                          <button
                            type="button"
                            aria-keyshortcuts={REVIEW_REJECT_SHORTCUTS}
                            aria-describedby={`${detailActionsContextIds} ${detailRejectActionHintId}`}
                            disabled={!selectedCandidateIsPending || isSubmitting}
                            onClick={() =>
                              runReviewAction({
                                action: 'reject',
                                candidateIds: [selectedCandidate.id],
                                successLabel: 'Rejected candidate.',
                              })
                            }
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-900 transition-colors hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-50 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30"
                          >
                            Reject candidate
                            <span id={detailRejectActionHintId} className="mt-1 block text-xs font-normal text-rose-700 dark:text-rose-400">Shortcut R • Marks it rejected and advances selection</span>
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Merge target</span>
                              <select
                                ref={detailMergeTargetSelectRef}
                                value={preferredMergeTargetId ?? ''}
                                aria-describedby={`${REVIEW_MERGE_TARGET_HELP_ID} ${selectedCandidate.id}-merge-target-status${mergeTargetNeedsExplicitSelection ? ` ${selectedCandidate.id}-merge-target-warning` : ''}${matchedDrills.length > 1 ? ` ${selectedCandidate.id}-merge-target-shortcuts` : ''}`}
                                aria-invalid={mergeTargetNeedsExplicitSelection ? true : undefined}
                                aria-keyshortcuts={REVIEW_MERGE_TARGET_SHORTCUTS}
                                onChange={(event) => setSelectedCanonicalDrillId(event.target.value || null)}
                                onKeyDown={handleSelectEscape}
                                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
                              >
                                <option value="">No target selected</option>
                                {matchedDrills.map((drill) => (
                                  <option key={drill.id} value={drill.id}>
                                    {drill.title} · Match {drill.matchScore}
                                  </option>
                                ))}
                              </select>
                              <span id={`${selectedCandidate.id}-merge-target-status`} className="mt-2 block text-xs leading-5 text-[var(--text-tertiary)]">
                                {preferredMergeTarget
                                  ? `${isUsingAutoMergeTarget ? 'Auto-selected top match' : 'Selected target'}: ${preferredMergeTarget.title} • Match ${preferredMergeTarget.matchScore}${preferredMergeTarget.matchReasons[0] ? ` • ${preferredMergeTarget.matchReasons[0]}` : ''}`
                                  : 'No likely canonical target yet for this candidate.'}
                              </span>
                              {mergeTargetNeedsExplicitSelection ? (
                                <span id={`${selectedCandidate.id}-merge-target-warning`} className="mt-1 block text-xs leading-5 text-amber-700 dark:text-amber-400">
                                  Multiple matches found. Pick one target before merging this row.
                                </span>
                              ) : null}
                              {matchedDrills.length > 1 ? (
                                <span id={`${selectedCandidate.id}-merge-target-shortcuts`} className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">Shortcuts 4 to 9 pick the top visible merge targets by rank, while ← / → or ; and ' keep cycling.</span>
                              ) : null}
                            </label>

                            {selectedMergeHandoff ? (
                              <button
                                type="button"
                                aria-keyshortcuts={REVIEW_COPY_MERGE_HANDOFF_SHORTCUTS}
                                aria-describedby={detailActionsContextIds}
                                onClick={copySelectedMergeHandoff}
                                className="inline-flex rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                Copy merge handoff
                                <span className="sr-only">Shortcut Shift Y</span>
                              </button>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            aria-keyshortcuts={REVIEW_MERGE_SHORTCUTS}
                            aria-describedby={`${detailActionsContextIds} ${detailMergeActionHintId} ${selectedCandidate.id}-merge-target-status${mergeTargetNeedsExplicitSelection ? ` ${selectedCandidate.id}-merge-target-warning` : ''}`}
                            disabled={!selectedCandidateIsPending || isSubmitting || !canRunMergeAction}
                            onClick={() =>
                              canRunMergeAction && preferredMergeTargetId
                                ? runReviewAction({
                                    action: 'merge',
                                    candidateIds: [selectedCandidate.id],
                                    canonicalDrillId: preferredMergeTargetId,
                                    successLabel: 'Merged candidate into the selected drill.',
                                  })
                                : setActionError(mergeTargetPrompt)
                            }
                            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm font-medium text-sky-900 transition-colors hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300 dark:hover:bg-sky-950/30"
                          >
                            Merge candidate
                            <span id={detailMergeActionHintId} className="mt-1 block text-xs font-normal text-sky-700 dark:text-sky-400">
                              Shortcut M • {canRunMergeAction ? 'Uses the selected canonical target and advances selection' : mergeTargetPrompt}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 id="review-detail-selected-candidate-title" className="text-xl font-semibold text-[var(--text-primary)]">{getDisplayTitle(selectedCandidate)}</h3>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(selectedCandidate.review_status)}`}>
                            {REVIEW_STATUS_LABELS[selectedCandidate.review_status]}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(insight.triageLevel)}`}>
                            {getTriageLabel(insight.triageLevel)}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDecisionTone(suggestedAction)}`}>
                            {getDecisionLabel(suggestedAction)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{getShortSummary(selectedCandidate)}</p>
                        <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{insight.triageSummary}</p>
                        {returnToLibraryHref ? (
                          <div className="mt-4">
                            <Link
                              href={returnToLibraryHref}
                              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            >
                              Back to current library view
                            </Link>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoBlock label="Raw title" value={selectedCandidate.raw_title || 'Missing raw title'} />
                        <InfoBlock label="Created" value={formatDateTime(selectedCandidate.created_at)} />
                        <InfoBlock
                          label="AI recommendation"
                          value={getAiDecisionLabel(selectedCandidate.ai_decision ?? null)}
                          subdued={selectedCandidate.ai_reason || (typeof selectedCandidate.ai_confidence === 'number' ? `${Math.round(selectedCandidate.ai_confidence * 100)}% confidence` : 'No AI recommendation yet')}
                        />
                        <InfoBlock label="Grade" value={formatGradeLevel(selectedCandidate.grade_level)} />
                        <InfoBlock label="Duration" value={selectedCandidate.estimated_duration_seconds ? `${selectedCandidate.estimated_duration_seconds}s` : 'Unknown'} />
                        <InfoBlock label="Canonical link" value={selectedCandidate.canonical_drill_id || 'Not linked yet'} />
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4 sm:col-span-2">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Source file</p>
                              <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{selectedCandidate.source_file || 'Missing'}</p>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">{selectedCandidate.source_type || 'Unknown source type'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                aria-pressed={sourceFilter === getSourceLabel(selectedCandidate)}
                                onClick={() => toggleSourceFocus(getSourceLabel(selectedCandidate), selectedCandidate.id)}
                                className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                {sourceFilter === getSourceLabel(selectedCandidate) ? 'Clear source focus' : 'Focus this source'}
                              </button>
                              {selectedCandidate.category ? (
                                <button
                                  type="button"
                                  aria-pressed={categoryFilter === selectedCandidate.category}
                                  onClick={() => toggleCategoryFocus(selectedCandidate.category, selectedCandidate.id)}
                                  className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                >
                                  {categoryFilter === selectedCandidate.category ? 'Clear category focus' : 'Focus this category'}
                                </button>
                              ) : null}
                              {selectedCandidate.difficulty ? (
                                <button
                                  type="button"
                                  aria-pressed={difficultyFilter === selectedCandidate.difficulty}
                                  onClick={() => toggleDifficultyFocus(selectedCandidate.difficulty, selectedCandidate.id)}
                                  className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                >
                                  {difficultyFilter === selectedCandidate.difficulty ? 'Clear difficulty focus' : 'Focus this difficulty'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <InfoBlock label="Suggested action" value={getDecisionLabel(suggestedAction)} subdued={getReviewerNextMove(selectedCandidate, insight)} />
                        <InfoBlock label="Completeness" value={`${insight.completenessScore}/6`} subdued={insight.completenessLabel} />
                        <InfoBlock
                          label="Duplicate pressure"
                          value={`${insight.familySize} row${insight.familySize === 1 ? '' : 's'}`}
                          subdued={selectedCandidate.dedupe_key || 'No dedupe key yet'}
                        />
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Reviewer next move</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{getReviewerNextMove(selectedCandidate, insight)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getCandidateReadinessGaps(selectedCandidate, insight).length === 0 ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                              No obvious readiness gaps
                            </span>
                          ) : (
                            getCandidateReadinessGaps(selectedCandidate, insight).map((gap) => (
                              <span key={gap} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">{gap}</span>
                            ))
                          )}
                        </div>
                      </div>

                      {selectedCandidateRelatedSlices.length > 0 ? (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Related queue slices</p>
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                Pivot straight into the pending rows that look most like this candidate, instead of backing out to the summary cards.
                              </p>
                            </div>
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                              Keeps current search and scope
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {selectedCandidateRelatedSlices.map((slice) => {
                              const sliceSummaryId = `${selectedCandidate.id}-related-slice-summary-${slice.key}`
                              const sliceLeadId = `${selectedCandidate.id}-related-slice-lead-${slice.key}`
                              const sliceNextOtherId = `${selectedCandidate.id}-related-slice-next-other-${slice.key}`
                              const sliceActionsId = `${selectedCandidate.id}-related-slice-actions-${slice.key}`
                              const sliceActionDescriptionIds = `${sliceSummaryId} ${sliceLeadId} ${sliceNextOtherId} ${sliceActionsId}`

                              return (
                                <div
                                  key={slice.key}
                                  className={`rounded-2xl border px-4 py-4 transition-colors ${
                                    slice.isActive
                                      ? 'border-[var(--accent-primary)] bg-[var(--surface-elevated)] shadow-sm'
                                      : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)]'
                                  } ${slice.count === 0 ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{slice.label}</p>
                                      <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{slice.detail}</p>
                                    </div>
                                    {slice.isActive ? (
                                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                        Active
                                      </span>
                                    ) : null}
                                  </div>
                                  <p id={sliceSummaryId} className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{slice.count}</p>
                                  <p id={sliceActionsId} className="mt-1 text-xs text-[var(--text-tertiary)]">
                                    pending row{slice.count === 1 ? '' : 's'} in this slice • {slice.isActive ? 'Clear, open next row, or copy handoff' : 'Focus, open lead row, open next row, or copy handoff'}
                                  </p>
                                  <p id={sliceLeadId} className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                                    {slice.leadCandidate ? `Lead row: ${getDisplayTitle(slice.leadCandidate)}` : 'No pending row in this slice yet'}
                                  </p>
                                  <p id={sliceNextOtherId} className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                                    {slice.nextOtherCandidate
                                      ? `Next other row: ${getDisplayTitle(slice.nextOtherCandidate)}`
                                      : 'No other pending row in this slice yet'}
                                  </p>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      aria-controls="review-detail-panel"
                                      aria-expanded={slice.leadCandidate?.id === selectedCandidate.id}
                                      aria-describedby={sliceActionDescriptionIds}
                                      aria-label={slice.leadCandidate ? `Open lead row ${getDisplayTitle(slice.leadCandidate)} for the ${slice.label.toLowerCase()}` : undefined}
                                      disabled={slice.count === 0}
                                      onClick={slice.openLeadRow}
                                      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none"
                                    >
                                      {slice.isActive ? 'Clear focus + open lead' : 'Focus + open lead'}
                                    </button>
                                    <button
                                      type="button"
                                      aria-controls="review-detail-panel"
                                      aria-expanded={slice.nextOtherCandidate?.id === selectedCandidate.id}
                                      aria-describedby={sliceActionDescriptionIds}
                                      aria-label={slice.nextOtherCandidate ? `Open next other row ${getDisplayTitle(slice.nextOtherCandidate)} for the ${slice.label.toLowerCase()}` : undefined}
                                      disabled={!slice.nextOtherCandidate}
                                      onClick={slice.openNextOtherRow}
                                      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none"
                                    >
                                      {slice.isActive ? 'Clear focus + open next row' : 'Focus + open next row'}
                                    </button>
                                    <button
                                      type="button"
                                      aria-describedby={sliceActionDescriptionIds}
                                      onClick={() => void copyText(slice.handoffText, `Copied ${slice.label.toLowerCase()} handoff`)}
                                      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                    >
                                      Copy handoff
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      <DetailList title="Steps" items={jsonToStringList(selectedCandidate.steps_json)} emptyLabel="No steps extracted yet." />
                      <DetailList title="Focus points" items={jsonToStringList(selectedCandidate.focus_points_json)} emptyLabel="No focus points extracted yet." />
                      <DetailList title="Common mistakes" items={jsonToStringList(selectedCandidate.common_mistakes_json)} emptyLabel="No common mistakes extracted yet." />

                      <TagGroup title="Format tags" items={selectedCandidate.format_tags} />
                      <TagGroup title="Skill tags" items={selectedCandidate.skill_tags} />
                      <TagGroup title="Tags" items={selectedCandidate.tags} />

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Review notes</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          {selectedCandidate.review_notes || 'No review notes yet.'}
                        </p>
                        {selectedCandidate.coach_demo_quote ? (
                          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                            Coach quote: {selectedCandidate.coach_demo_quote}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <p id={`${selectedCandidate.id}-merge-target-group-title`} className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Likely canonical targets</p>
                        <p id={`${selectedCandidate.id}-merge-target-group-description`} className="mt-2 text-sm text-[var(--text-secondary)]">
                          These are the strongest likely canonical targets from the curated drills table, so you can merge straight from here instead of juggling IDs by hand.
                        </p>
                        {matchedDrills.length > 1 ? (
                          <p id={`${selectedCandidate.id}-merge-target-group-shortcuts`} className="mt-2 text-xs text-[var(--text-tertiary)]">Keyboard tip: use 4 to 9 to pick the top visible targets by rank, or ; and ' to cycle target selection.</p>
                        ) : null}

                        {matchedDrills.length === 0 ? (
                          <p className="mt-4 text-sm text-[var(--text-secondary)]">No likely drill matches surfaced yet from the current library.</p>
                        ) : (
                          <div
                            className="mt-4 space-y-3"
                            role="group"
                            aria-labelledby={`${selectedCandidate.id}-merge-target-group-title`}
                            aria-describedby={`${selectedCandidate.id}-merge-target-group-description${matchedDrills.length > 1 ? ` ${selectedCandidate.id}-merge-target-group-shortcuts` : ''}`}
                          >
                            {matchedDrills.map((drill, index) => {
                              const isSelectedMergeTarget = preferredMergeTargetId === drill.id
                              const drillMatchReasonId = `${selectedCandidate.id}-merge-target-reasons-${drill.id}`
                              const drillSummaryId = `${selectedCandidate.id}-merge-target-summary-${drill.id}`

                              return (
                                <div
                                  key={drill.id}
                                  className={`rounded-2xl border p-3 ${
                                    isSelectedMergeTarget
                                      ? 'border-[var(--accent-primary)] bg-[var(--surface-elevated)] shadow-sm'
                                      : 'border-[var(--border)] bg-[var(--surface-elevated)]'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">{drill.title}</p>
                                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                                          Match {drill.matchScore}
                                        </span>
                                        {getMergeTargetShortcutKey(index) ? (
                                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                                            Shortcut {getMergeTargetShortcutKey(index)}
                                          </span>
                                        ) : null}
                                        {isSelectedMergeTarget ? (
                                          <span className="rounded-full border border-[var(--accent-primary)] bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--text-primary)]">
                                            Selected target
                                          </span>
                                        ) : null}
                                        {drill.is_curated ? (
                                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                                            Curated
                                          </span>
                                        ) : null}
                                        {!drill.is_active ? (
                                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
                                            Inactive
                                          </span>
                                        ) : null}
                                      </div>
                                      <p id={drillMatchReasonId} className="mt-2 text-xs text-[var(--text-tertiary)]">
                                        {drill.matchReasons.slice(0, 3).join(' • ')}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        aria-pressed={isSelectedMergeTarget}
                                        aria-describedby={`${drillMatchReasonId} ${drillSummaryId}`}
                                        aria-label={isSelectedMergeTarget ? `${drill.title} is the selected merge target` : `Use ${drill.title} as the merge target`}
                                        onClick={() => setSelectedCanonicalDrillId(drill.id)}
                                        className={`inline-flex shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                                          isSelectedMergeTarget
                                            ? 'border-[var(--accent-primary)] bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                                            : 'border-[var(--border)] bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                                        }`}
                                      >
                                        {isSelectedMergeTarget ? 'Merge target selected' : 'Use as merge target'}
                                      </button>
                                      <button
                                        type="button"
                                        aria-describedby={`${drillMatchReasonId} ${drillSummaryId}`}
                                        aria-label={`Merge ${getDisplayTitle(selectedCandidate)} into ${drill.title} now`}
                                        disabled={isSubmitting}
                                        onClick={() =>
                                          runReviewAction({
                                            action: 'merge',
                                            candidateIds: [selectedCandidate.id],
                                            canonicalDrillId: drill.id,
                                            successLabel: `Merged candidate into ${drill.title}.`,
                                          })
                                        }
                                        className="inline-flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                                      >
                                        Merge now
                                      </button>
                                      <Link
                                        href={returnToLibraryHref ? `${returnToLibraryHref}${returnToLibraryHref.includes('?') ? '&' : '?'}selected=${drill.id}` : `/drills?selected=${drill.id}`}
                                        aria-describedby={`${drillMatchReasonId} ${drillSummaryId}`}
                                        aria-label={`Open ${drill.title} in the drill library`}
                                        className="inline-flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                      >
                                        Open in library
                                      </Link>
                                    </div>
                                  </div>
                                  <p id={drillSummaryId} className="mt-2 text-sm text-[var(--text-secondary)]">{drill.summary || 'No library summary yet.'}</p>
                                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                                    {formatGradeLevel(drill.grade_level)} • {drill.category || 'Uncategorised'} • {drill.difficulty}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Family context</p>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                              {selectedCandidate.dedupe_key
                                ? `${selectedFamilyCandidates.length} visible row${selectedFamilyCandidates.length === 1 ? '' : 's'} share this dedupe key.`
                                : 'No dedupe key on this candidate yet.'}
                            </p>
                          </div>
                          {selectedCandidate.dedupe_key ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                {selectedCandidate.dedupe_key}
                              </span>
                              {familyFilter === selectedCandidate.dedupe_key ? (
                                <button
                                  type="button"
                                  onClick={clearFamilyFocus}
                                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                >
                                  Clear focus
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => focusFamily(selectedCandidate.dedupe_key!, selectedCandidate.id)}
                                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                >
                                  Focus family
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {selectedCandidate.dedupe_key ? (
                          <div className="mt-4 space-y-2">
                            {selectedFamilyCandidates.slice(0, 6).map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => {
                                  selectCandidate(candidate.id, { scrollIntoView: false })
                                  if (candidate.dedupe_key) {
                                    focusFamily(candidate.dedupe_key, candidate.id)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors ${
                                  candidate.id === selectedCandidate.id
                                    ? 'border-[var(--accent-primary)] bg-[var(--surface-elevated)]'
                                    : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)]'
                                }`}
                              >
                                <span className="min-w-0 pr-3 text-sm font-medium text-[var(--text-primary)]">{getDisplayTitle(candidate)}</span>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusTone(candidate.review_status)}`}>
                                  {REVIEW_STATUS_LABELS[candidate.review_status]}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {selectedFamilyWorkspace ? (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Family review workspace</p>
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                Queue up the right keep, merge, and reject rows for one duplicate cluster without losing the family context.
                              </p>
                            </div>
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                              {selectedFamilyWorkspace.ranked.length} rows
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <InfoBlock label="Suggested keep" value={String(selectedFamilyWorkspace.decisionCounts.keep)} subdued={getDisplayTitle(selectedFamilyWorkspace.keepCandidate)} />
                            <InfoBlock label="Suggested merge" value={String(selectedFamilyWorkspace.decisionCounts.merge)} subdued="Useful supporting duplicates" />
                            <InfoBlock label="Suggested reject" value={String(selectedFamilyWorkspace.decisionCounts.reject)} subdued="Thin or noisy overlap" />
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <button
                              type="button"
                              disabled={selectedFamilyWorkspace.pendingFamilyIds.length === 0}
                              aria-keyshortcuts={REVIEW_SELECT_PENDING_FAMILY_ROWS_SHORTCUTS}
                              aria-pressed={selectedFamilyWorkspace.pendingFamilyIds.length > 0 && selectedFamilyWorkspace.pendingFamilyIds.every((id) => visibleSelectedIds.includes(id))}
                              onClick={() => toggleSelectedBatch(selectedFamilyWorkspace.pendingFamilyIds)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              {selectedFamilyWorkspace.pendingFamilyIds.every((id) => visibleSelectedIds.includes(id)) ? 'Deselect pending family rows' : 'Select pending family rows'}
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.pendingFamilyIds.length > 0
                                  ? `${selectedFamilyWorkspace.pendingFamilyIds.length} pending row${selectedFamilyWorkspace.pendingFamilyIds.length === 1 ? '' : 's'} ready for bulk actions`
                                  : 'No pending family rows left'}
                              </span>
                              <span aria-hidden="true" className="mt-2 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                                Shortcut Shift + F
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={selectedFamilyWorkspace.pendingKeepIds.length === 0}
                              aria-pressed={selectedFamilyWorkspace.pendingKeepIds.length > 0 && selectedFamilyWorkspace.pendingKeepIds.every((id) => visibleSelectedIds.includes(id))}
                              onClick={() => toggleSelectedBatch(selectedFamilyWorkspace.pendingKeepIds)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              {selectedFamilyWorkspace.pendingKeepIds.every((id) => visibleSelectedIds.includes(id)) ? 'Deselect suggested keeps' : 'Select suggested keeps'}
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.pendingKeepIds.length > 0
                                  ? `${selectedFamilyWorkspace.pendingKeepIds.length} keep row${selectedFamilyWorkspace.pendingKeepIds.length === 1 ? '' : 's'} ready for a bulk approve pass`
                                  : 'No pending keep rows left'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={selectedFamilyWorkspace.pendingMergeIds.length === 0}
                              aria-pressed={selectedFamilyWorkspace.pendingMergeIds.length > 0 && selectedFamilyWorkspace.pendingMergeIds.every((id) => visibleSelectedIds.includes(id))}
                              onClick={() => toggleSelectedBatch(selectedFamilyWorkspace.pendingMergeIds)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              {selectedFamilyWorkspace.pendingMergeIds.every((id) => visibleSelectedIds.includes(id)) ? 'Deselect suggested merges' : 'Select suggested merges'}
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.pendingMergeIds.length > 0
                                  ? `${selectedFamilyWorkspace.pendingMergeIds.length} merge row${selectedFamilyWorkspace.pendingMergeIds.length === 1 ? '' : 's'} can be bulk-merged once the target looks right`
                                  : 'No pending merge rows left'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={selectedFamilyWorkspace.pendingRejectIds.length === 0}
                              aria-pressed={selectedFamilyWorkspace.pendingRejectIds.length > 0 && selectedFamilyWorkspace.pendingRejectIds.every((id) => visibleSelectedIds.includes(id))}
                              onClick={() => toggleSelectedBatch(selectedFamilyWorkspace.pendingRejectIds)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              {selectedFamilyWorkspace.pendingRejectIds.every((id) => visibleSelectedIds.includes(id)) ? 'Deselect suggested rejects' : 'Select suggested rejects'}
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.pendingRejectIds.length > 0
                                  ? `${selectedFamilyWorkspace.pendingRejectIds.length} reject row${selectedFamilyWorkspace.pendingRejectIds.length === 1 ? '' : 's'} ready for a cleanup pass`
                                  : 'No pending reject rows left'}
                              </span>
                            </button>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <button
                              type="button"
                              onClick={() => selectCandidate(selectedFamilyWorkspace.keepCandidate.id, { scrollIntoView: false })}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            >
                              Open suggested keep
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">{getDisplayTitle(selectedFamilyWorkspace.keepCandidate)}</span>
                            </button>
                            <button
                              type="button"
                              disabled={!selectedFamilyWorkspace.nextMergeCandidate}
                              onClick={() =>
                                selectedFamilyWorkspace.nextMergeCandidate
                                  ? selectCandidate(selectedFamilyWorkspace.nextMergeCandidate.id, { scrollIntoView: false })
                                  : null
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open next merge row
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.nextMergeCandidate ? getDisplayTitle(selectedFamilyWorkspace.nextMergeCandidate) : 'No pending merge row left'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={!selectedFamilyWorkspace.nextRejectCandidate}
                              onClick={() =>
                                selectedFamilyWorkspace.nextRejectCandidate
                                  ? selectCandidate(selectedFamilyWorkspace.nextRejectCandidate.id, { scrollIntoView: false })
                                  : null
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open next reject row
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.nextRejectCandidate ? getDisplayTitle(selectedFamilyWorkspace.nextRejectCandidate) : 'No pending reject row left'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={!previousDuplicateFamily || previousDuplicateFamily.dedupeKey === selectedCandidate.dedupe_key}
                              aria-keyshortcuts={REVIEW_PREVIOUS_DUPLICATE_FAMILY_SHORTCUTS}
                              aria-controls="review-detail-panel"
                              aria-label={previousDuplicateFamily ? `Open previous duplicate family ${previousDuplicateFamily.dedupeKey}` : undefined}
                              onClick={() => focusFamily(previousDuplicateFamily!.dedupeKey, previousDuplicateFamily!.leadCandidate?.id ?? null)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open previous family
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {previousDuplicateFamily
                                  ? `${previousDuplicateFamily.dedupeKey} • ${previousDuplicateFamily.count} rows`
                                  : 'No earlier pending duplicate family visible'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={!nextDuplicateFamily || nextDuplicateFamily.dedupeKey === selectedCandidate.dedupe_key}
                              aria-keyshortcuts={REVIEW_NEXT_DUPLICATE_FAMILY_SHORTCUTS}
                              aria-controls="review-detail-panel"
                              aria-label={nextDuplicateFamily ? `Open next duplicate family ${nextDuplicateFamily.dedupeKey}` : undefined}
                              onClick={() => focusFamily(nextDuplicateFamily!.dedupeKey, nextDuplicateFamily!.leadCandidate?.id ?? null)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open next family
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {nextDuplicateFamily
                                  ? `${nextDuplicateFamily.dedupeKey} • ${nextDuplicateFamily.count} rows`
                                  : 'No other pending duplicate family visible'}
                              </span>
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {selectedFamilyWorkspace.ranked.map(({ candidate, insight }) => {
                              const decision = getCandidateDecisionHint(candidate, insight)
                              const isSelected = candidate.id === selectedCandidate.id
                              const familyCandidateSummaryId = `family-candidate-summary-${candidate.id}`
                              const familyCandidateMetricsId = `family-candidate-metrics-${candidate.id}`

                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  aria-controls="review-detail-panel"
                                  aria-describedby={`${familyCandidateSummaryId} ${familyCandidateMetricsId}`}
                                  aria-expanded={isSelected}
                                  onClick={() => selectCandidate(candidate.id, { scrollIntoView: false })}
                                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                                    isSelected
                                      ? 'border-[var(--accent-primary)] bg-[var(--surface-elevated)]'
                                      : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)]'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">{getDisplayTitle(candidate)}</p>
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDecisionTone(decision)}`}>
                                          {getDecisionLabel(decision)}
                                        </span>
                                      </div>
                                      <p id={familyCandidateSummaryId} className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">{getShortSummary(candidate)}</p>
                                    </div>
                                    <div id={familyCandidateMetricsId} className="text-right text-xs text-[var(--text-tertiary)]">
                                      <p>{insight.completenessScore}/6 completeness</p>
                                      <p className="mt-1">{insight.stepsCount} steps • {insight.focusPointsCount} focus</p>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] px-4 py-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p id="family-handoff-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Reviewer handoff scaffold</p>
                                <p id="family-handoff-description" className="mt-1 text-sm text-[var(--text-secondary)]">
                                  Copy-ready notes for Jordan or Sha-Lyn when turning this family into a real curation pass.
                                </p>
                              </div>
                              <button
                                type="button"
                                aria-keyshortcuts={REVIEW_COPY_FAMILY_HANDOFF_SHORTCUTS}
                                aria-describedby="family-handoff-title family-handoff-description"
                                onClick={copyFamilyHandoff}
                                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                Copy notes
                                <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]" aria-hidden="true">Shift + H</span>
                                <span className="sr-only">Shortcut Shift H</span>
                              </button>
                            </div>
                            <textarea
                              readOnly
                              value={selectedFamilyWorkspace.handoffText}
                              aria-labelledby="family-handoff-title"
                              aria-describedby="family-handoff-description"
                              className="mt-4 min-h-[300px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 font-mono text-xs leading-6 text-[var(--text-secondary)] outline-none"
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </aside>
      </section>
      </div>
    </>
  )
}

function InfoBlock({ label, value, subdued }: { label: string; value: string; subdued?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 font-medium text-[var(--text-primary)]">{value}</p>
      {subdued ? <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{subdued}</p> : null}
    </div>
  )
}

function DetailList({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
          {items.map((item) => (
            <li key={item} className="rounded-xl border border-[var(--border)] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TagGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">None yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
