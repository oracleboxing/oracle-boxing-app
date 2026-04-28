-- Migration: 010_seed_dynamic_warmups.sql
-- Purpose: first draft reusable dynamic warm-up exercises for workout building and demo animation planning.

begin;

insert into exercises (title, slug, discipline, item_type, category, summary, description, instructions_json, coaching_cues_json, common_mistakes_json, equipment_tags, difficulty, structure_json, is_active, is_curated)
values (
  'Light Bounce',
  'light-bounce',
  'strength_conditioning',
  'exercise',
  'dynamic_warmup',
  'Easy rhythmic bouncing to raise temperature and settle into an athletic stance.',
  'A simple dynamic warm-up starter. Stay relaxed, springy, and light through the ankles rather than jumping high.',
  '["Stand tall in an athletic stance with soft knees.","Bounce lightly on the balls of the feet.","Keep the shoulders relaxed and breathe steadily.","Start small, then gradually build rhythm without forcing height."]'::jsonb,
  '["Quiet feet, soft knees.","Think springy, not jumpy.","Keep the ribcage stacked over the hips."]'::jsonb,
  '["Jumping too high and wasting energy.","Locking the knees on landing.","Tensing the shoulders."]'::jsonb,
  '{}'::text[],
  'beginner',
  '{"demo_style":"action_man_loop","default_duration_seconds":30,"animation_prompt":"Small springy bounce on the balls of the feet, athletic stance, relaxed shoulders."}'::jsonb,
  true,
  false
)
on conflict (slug) do update set
  title = excluded.title,
  discipline = excluded.discipline,
  item_type = excluded.item_type,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  instructions_json = excluded.instructions_json,
  coaching_cues_json = excluded.coaching_cues_json,
  common_mistakes_json = excluded.common_mistakes_json,
  equipment_tags = excluded.equipment_tags,
  difficulty = excluded.difficulty,
  structure_json = excluded.structure_json,
  is_active = excluded.is_active,
  is_curated = excluded.is_curated,
  updated_at = now();

insert into exercises (title, slug, discipline, item_type, category, summary, description, instructions_json, coaching_cues_json, common_mistakes_json, equipment_tags, difficulty, structure_json, is_active, is_curated)
values (
  'Alternating Knee Raises',
  'alternating-knee-raises',
  'strength_conditioning',
  'exercise',
  'dynamic_warmup',
  'March-style dynamic knee lifts to warm the hips, glutes, and lower abs.',
  'Lift one knee at a time toward hip height while staying tall and balanced.',
  '["Stand tall with feet under hips.","Lift one knee toward hip height.","Lower it under control and switch sides.","Keep alternating with a smooth marching rhythm."]'::jsonb,
  '["Stand tall before you lift.","Knee up, toes relaxed.","Control the lowering, don''t stomp."]'::jsonb,
  '["Leaning back to lift the knee.","Rushing and losing balance.","Letting the standing knee lock out hard."]'::jsonb,
  '{}'::text[],
  'beginner',
  '{"demo_style":"action_man_loop","default_reps_each_side":10,"animation_prompt":"Alternating standing knee lifts to hip height with upright posture and controlled rhythm."}'::jsonb,
  true,
  false
)
on conflict (slug) do update set
  title = excluded.title,
  discipline = excluded.discipline,
  item_type = excluded.item_type,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  instructions_json = excluded.instructions_json,
  coaching_cues_json = excluded.coaching_cues_json,
  common_mistakes_json = excluded.common_mistakes_json,
  equipment_tags = excluded.equipment_tags,
  difficulty = excluded.difficulty,
  structure_json = excluded.structure_json,
  is_active = excluded.is_active,
  is_curated = excluded.is_curated,
  updated_at = now();

insert into exercises (title, slug, discipline, item_type, category, summary, description, instructions_json, coaching_cues_json, common_mistakes_json, equipment_tags, difficulty, structure_json, is_active, is_curated)
values (
  'Step Over The Gate',
  'step-over-the-gate',
  'strength_conditioning',
  'exercise',
  'dynamic_warmup',
  'Hip-opening step-over pattern for groin, glutes, and hip control.',
  'Imagine stepping one leg over a low gate, lifting the knee then opening the hip before placing the foot down.',
  '["Stand tall with space in front of you.","Lift one knee up in front of the body.","Open the knee out to the side as if stepping over a gate.","Place the foot down softly and alternate sides."]'::jsonb,
  '["Lift first, then open.","Move from the hip, not the lower back.","Keep the torso quiet."]'::jsonb,
  '["Swinging the leg without control.","Twisting the whole body to cheat the range.","Dropping heavily onto the foot."]'::jsonb,
  '{}'::text[],
  'beginner',
  '{"demo_style":"action_man_loop","default_reps_each_side":8,"animation_prompt":"Standing hip opener, knee lifts forward then opens outward like stepping over a gate."}'::jsonb,
  true,
  false
)
on conflict (slug) do update set
  title = excluded.title,
  discipline = excluded.discipline,
  item_type = excluded.item_type,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  instructions_json = excluded.instructions_json,
  coaching_cues_json = excluded.coaching_cues_json,
  common_mistakes_json = excluded.common_mistakes_json,
  equipment_tags = excluded.equipment_tags,
  difficulty = excluded.difficulty,
  structure_json = excluded.structure_json,
  is_active = excluded.is_active,
  is_curated = excluded.is_curated,
  updated_at = now();

insert into exercises (title, slug, discipline, item_type, category, summary, description, instructions_json, coaching_cues_json, common_mistakes_json, equipment_tags, difficulty, structure_json, is_active, is_curated)
values (
  'Standing Torso Twists',
  'standing-torso-twists',
  'strength_conditioning',
  'exercise',
  'dynamic_warmup',
  'Gentle rotational warm-up for the trunk, hips, and shoulders.',
  'Rotate side to side with control, letting the hips and shoulders loosen without yanking the spine.',
  '["Stand with feet just wider than hip width.","Keep the knees soft and arms relaxed.","Rotate the torso left and right smoothly.","Let the arms follow naturally without forcing range."]'::jsonb,
  '["Smooth rotation, no yanking.","Keep knees soft.","Let the shoulders follow the hips."]'::jsonb,
  '["Forcing the twist aggressively.","Locking the knees.","Turning only the neck instead of the trunk."]'::jsonb,
  '{}'::text[],
  'beginner',
  '{"demo_style":"action_man_loop","default_duration_seconds":30,"animation_prompt":"Standing relaxed torso rotations side to side, soft knees, arms loose."}'::jsonb,
  true,
  false
)
on conflict (slug) do update set
  title = excluded.title,
  discipline = excluded.discipline,
  item_type = excluded.item_type,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  instructions_json = excluded.instructions_json,
  coaching_cues_json = excluded.coaching_cues_json,
  common_mistakes_json = excluded.common_mistakes_json,
  equipment_tags = excluded.equipment_tags,
  difficulty = excluded.difficulty,
  structure_json = excluded.structure_json,
  is_active = excluded.is_active,
  is_curated = excluded.is_curated,
  updated_at = now();

insert into exercises (title, slug, discipline, item_type, category, summary, description, instructions_json, coaching_cues_json, common_mistakes_json, equipment_tags, difficulty, structure_json, is_active, is_curated)
values (
  'Squat And Open',
  'squat-and-open',
  'strength_conditioning',
  'exercise',
  'dynamic_warmup',
  'Bodyweight squat with a controlled hip-opening reach to prep hips and legs.',
  'Squat down under control, then use the bottom position to open the hips before standing tall again.',
  '["Stand with feet around shoulder width.","Sit into a comfortable bodyweight squat.","At the bottom, gently open the knees and chest.","Stand back up tall and repeat."]'::jsonb,
  '["Sit between the hips.","Knees track over toes.","Open the chest without collapsing the lower back."]'::jsonb,
  '["Forcing depth before warm.","Knees caving in.","Folding the chest down."]'::jsonb,
  '{}'::text[],
  'beginner',
  '{"demo_style":"action_man_loop","default_reps":8,"animation_prompt":"Bodyweight squat, brief hip-opening pause at bottom, stand tall."}'::jsonb,
  true,
  false
)
on conflict (slug) do update set
  title = excluded.title,
  discipline = excluded.discipline,
  item_type = excluded.item_type,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  instructions_json = excluded.instructions_json,
  coaching_cues_json = excluded.coaching_cues_json,
  common_mistakes_json = excluded.common_mistakes_json,
  equipment_tags = excluded.equipment_tags,
  difficulty = excluded.difficulty,
  structure_json = excluded.structure_json,
  is_active = excluded.is_active,
  is_curated = excluded.is_curated,
  updated_at = now();

insert into exercises (title, slug, discipline, item_type, category, summary, description, instructions_json, coaching_cues_json, common_mistakes_json, equipment_tags, difficulty, structure_json, is_active, is_curated)
values (
  'Alternating Forward Lunges',
  'alternating-forward-lunges',
  'strength_conditioning',
  'exercise',
  'dynamic_warmup',
  'Simple dynamic lunge pattern to warm quads, glutes, hips, and balance.',
  'Step forward into a controlled lunge, push back to standing, then alternate legs.',
  '["Stand tall with feet under hips.","Step one foot forward into a lunge.","Lower under control with the front knee tracking over the toes.","Push back to standing and alternate legs."]'::jsonb,
  '["Long spine, soft landing.","Front foot owns the floor.","Push back with control."]'::jsonb,
  '["Slamming the front foot down.","Letting the front knee collapse inward.","Leaning forward excessively."]'::jsonb,
  '{}'::text[],
  'beginner',
  '{"demo_style":"action_man_loop","default_reps_each_side":8,"animation_prompt":"Alternating forward lunges, controlled lowering, push back to standing."}'::jsonb,
  true,
  false
)
on conflict (slug) do update set
  title = excluded.title,
  discipline = excluded.discipline,
  item_type = excluded.item_type,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  instructions_json = excluded.instructions_json,
  coaching_cues_json = excluded.coaching_cues_json,
  common_mistakes_json = excluded.common_mistakes_json,
  equipment_tags = excluded.equipment_tags,
  difficulty = excluded.difficulty,
  structure_json = excluded.structure_json,
  is_active = excluded.is_active,
  is_curated = excluded.is_curated,
  updated_at = now();

commit;
