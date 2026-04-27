-- Migration: 007_allow_feint_drill_category.sql
-- Purpose: allow canonical feint movements to live as their own drill category.

alter table raw_drill_candidates
  drop constraint if exists raw_drill_candidates_category_check;

alter table raw_drill_candidates
  add constraint raw_drill_candidates_category_check
    check (category in ('stance', 'punching', 'footwork', 'defence', 'combination', 'warmup', 'feint'));

alter table drills
  drop constraint if exists drills_category_check;

alter table drills
  add constraint drills_category_check
    check (category in ('stance', 'punching', 'footwork', 'defence', 'combination', 'warmup', 'feint') or category is null);
