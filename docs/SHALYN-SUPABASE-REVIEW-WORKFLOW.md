# Sha-Lyn Supabase Review Workflow

This is the simplest practical workflow for reviewing drills in Supabase.

---

## Goal

Use Supabase as the content review layer so raw extracted drills can be cleaned up before they become app-facing content.

---

## Tables

### Review from
- `raw_drill_candidates`

### Publish into
- `drills`

---

## Review actions

For each candidate, choose one of:

### 1. Approve
Meaning:
- this raw drill is good source material
- it should survive review
- it may later become its own canonical drill or feed one

Update:
- `review_status = 'approved'`

### 2. Reject
Meaning:
- duplicate junk
- not reusable
- too vague
- too messy
- not really a drill

Update:
- `review_status = 'rejected'`
- optionally add `review_notes`

### 3. Merge
Meaning:
- this raw candidate belongs under an existing canonical drill

Update:
- `review_status = 'merged'`
- set `canonical_drill_id`

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
Spot duplicate families using `dedupe_key`

### Step 3
Decide the canonical drill shape
For example:
- Box Step
- Jab Technique
- Slip and Roll

### Step 4
Create or update the corresponding row in `drills`

### Step 5
Mark related raw candidates as `merged`

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

---

## Grade content

Grade 1 and Grade 2 extracted drills should flow into the same review system.

That means:
- grade drills still go into `raw_drill_candidates`
- then get reviewed
- then get promoted into `drills`

Don’t bypass the review layer just because the source is cleaner.

---

## Blunt version

Raw candidates are the inbox.
Canonical drills are the finished library.

Review is the thing in the middle that stops nonsense getting into the app.