-- Pending raw drill candidates
select
  id,
  cleaned_title,
  category,
  difficulty,
  grade_level,
  review_status,
  source_type,
  source_file,
  created_at
from raw_drill_candidates
where review_status = 'pending'
order by coalesce(grade_level, 'zzz'), cleaned_title;

-- Duplicate families by dedupe key
select
  dedupe_key,
  count(*) as candidate_count,
  array_agg(distinct cleaned_title order by cleaned_title) as titles,
  array_agg(distinct category order by category) as categories,
  array_agg(distinct difficulty order by difficulty) as difficulties,
  array_agg(distinct grade_level order by grade_level) as grades
from raw_drill_candidates
where dedupe_key is not null and dedupe_key <> ''
group by dedupe_key
having count(*) > 1
order by candidate_count desc, dedupe_key asc;

-- Review queue for Grade 1 and Grade 2 content
select
  id,
  cleaned_title,
  category,
  difficulty,
  grade_level,
  review_status,
  source_file
from raw_drill_candidates
where coalesce(grade_level, '') in ('grade_1', 'grade_2')
order by grade_level, cleaned_title;

-- Canonical drill library
select
  id,
  title,
  slug,
  category,
  difficulty,
  grade_level,
  is_active,
  array_length(raw_candidate_ids, 1) as raw_candidate_count,
  updated_at
from drills
where is_active = true
order by title;

-- Raw candidates already linked to a canonical drill
select
  r.id,
  r.cleaned_title,
  r.review_status,
  r.grade_level,
  d.title as canonical_title,
  d.slug as canonical_slug
from raw_drill_candidates r
left join drills d on d.id = r.canonical_drill_id
where r.canonical_drill_id is not null
order by d.title, r.cleaned_title;
