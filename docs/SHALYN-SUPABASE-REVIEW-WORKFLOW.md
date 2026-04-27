# Sha-Lyn Supabase Review Workflow

This is the simplest practical workflow for reviewing boxing source candidates in Supabase.

---

## Goal

Use Supabase as the content review layer so raw extracted drill candidates can be cleaned up before they become app-facing canonical content.

Product wording may still call the member-facing library “drills”. The database source of truth is:
- `raw_drill_candidates` for intake and review
- `moves` for approved canonical boxing movements
- `combinations` for approved canonical sequences
- `combination_items` for the ordered moves inside each combination

---

## Tables

### Review from
- `raw_drill_candidates`

### Publish into
- `moves`
- `combinations`
- `combination_items`

---

## Review actions

For each candidate, choose one of:

### 1. Approve
Meaning:
- this raw candidate is good source material
- it should survive review
- it may later become its own canonical move, feed an existing move, or inform a combination

Update:
- `review_status = 'approved'`

### 2. Reject
Meaning:
- duplicate junk
- not reusable
- too vague
- too messy
- not really useful training content

Update:
- `review_status = 'rejected'`
- optionally add `review_notes`

### 3. Merge
Meaning:
- this raw candidate belongs under an existing canonical move

Update:
- `review_status = 'merged'`
- set `canonical_move_id`

### 4. Promote to combination
Meaning:
- this raw candidate is a sequence rather than a single move
- the sequence should become or improve a row in `combinations`
- its parts should be represented in `combination_items`

Update:
- create or update the row in `combinations`
- create ordered rows in `combination_items`
- set source candidates to `merged` when they have been accounted for
- use `review_notes` if the source informs a combination but does not map cleanly to one `canonical_move_id`

---

## Example review sequence

### Step 1
Pull pending candidates:
```sql
select *
from raw_drill_candidates
where review_status = 'pending'
order by cleaned_title;
```

### Step 2
Spot duplicate families using `dedupe_key`.

### Step 3
Decide the canonical shape.

Single-move examples:
- Box Step
- Jab Technique
- Slip
- Roll

Combination examples:
- 1-2
- 1-2-3
- Jab and Move
- Jab, Slip, Cross

### Step 4
Create or update the corresponding row in `moves` or `combinations`.

### Step 5
If creating a combination, add its ordered move rows in `combination_items`.

### Step 6
Mark related raw candidates as `merged` when they are accounted for.

---

## Practical first target

Do not try to solve the whole library in one go.

Start with the first canonical batch:
- Static Rotations
- Stance and Shape
- Box Step
- Step Pivot
- Dip Pivot
- Pivot
- Jab Technique
- Basic Jab
- Flicker Jab
- Power Jab
- Jab to the Body
- Cross to the Body
- Slip and Roll
- Jab and Move
- Box Step with Jab
- 1-2 Combination
- Static 1-2
- 1-2 and Move
- 1-2-3 Combination
- 1-1-2 Combination

Some of these will be canonical `moves`. Some will be canonical `combinations`.

---

## Grade content

Grade 1 and Grade 2 extracted drills should flow into the same review system.

That means:
- grade source candidates still go into `raw_drill_candidates`
- then get reviewed
- then get promoted into `moves` or `combinations`

Don’t bypass the review layer just because the source is cleaner.

---

## Blunt version

Raw candidates are the inbox.
Canonical moves and combinations are the finished library.

Review is the thing in the middle that stops nonsense getting into the app.
