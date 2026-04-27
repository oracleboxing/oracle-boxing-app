-- Migration: 004_raw_drill_ai_triage.sql
-- Purpose: persist AI triage recommendations for raw drill review

alter table raw_drill_candidates
  add column if not exists ai_decision text check (ai_decision in ('approve', 'merge', 'reject', 'review') or ai_decision is null),
  add column if not exists ai_confidence numeric,
  add column if not exists ai_reason text,
  add column if not exists ai_proposed_canonical_drill_id uuid,
  add column if not exists ai_review_family_id text,
  add column if not exists ai_reviewed_at timestamptz,
  add column if not exists ai_payload_json jsonb not null default '{}'::jsonb;

create index if not exists raw_drill_candidates_ai_decision_idx on raw_drill_candidates (ai_decision);
create index if not exists raw_drill_candidates_ai_confidence_idx on raw_drill_candidates (ai_confidence);
create index if not exists raw_drill_candidates_ai_review_family_id_idx on raw_drill_candidates (ai_review_family_id);

alter table raw_drill_candidates drop constraint if exists raw_drill_candidates_ai_proposed_canonical_drill_fk;
alter table raw_drill_candidates
  add constraint raw_drill_candidates_ai_proposed_canonical_drill_fk
  foreign key (ai_proposed_canonical_drill_id) references drills(id) on delete set null;
