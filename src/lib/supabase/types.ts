export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MoveCategory = 'stance' | 'punching' | 'footwork' | 'defence' | 'combination' | 'warmup' | 'feint'
export type DrillCategory = MoveCategory
export type MoveDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type DrillDifficulty = MoveDifficulty
export type GradeLevel = 'grade_1' | 'grade_2' | 'grade_3'
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'merged'
export type SourceType = 'boxing_clinic' | 'one_on_one' | 'graduation' | 'other'
export type WorkoutDiscipline = 'boxing' | 'strength_conditioning' | 'running' | 'hybrid'
export type WorkoutItemType = 'warmup' | 'skill' | 'strength' | 'conditioning' | 'running' | 'cooldown' | 'recovery'
export type ExerciseDiscipline = 'strength_conditioning' | 'running'
export type TrainingItemDiscipline = ExerciseDiscipline
export type ExerciseType = 'exercise' | 'interval'
export type TrainingItemType = ExerciseType
export type CombinationCategory = 'basic_attack' | 'attack_defence' | 'feint_entry' | 'body_head' | 'footwork_entry' | 'exit' | 'counter'
export type CombinationItemRole = 'attack' | 'defence' | 'feint' | 'footwork' | 'position'
export type AiDecision = 'approve' | 'merge' | 'reject' | 'review'

export interface Database {
  public: {
    Tables: {
      raw_drill_candidates: {
        Row: {
          id: string
          raw_title: string
          cleaned_title: string
          slug_candidate: string
          dedupe_key: string | null
          summary: string | null
          description: string | null
          category: MoveCategory
          difficulty: MoveDifficulty
          grade_level: GradeLevel | null
          format_tags: string[]
          skill_tags: string[]
          tags: string[]
          steps_json: Json
          focus_points_json: Json
          common_mistakes_json: Json
          what_it_trains: string | null
          when_to_assign: string | null
          coach_demo_quote: string | null
          estimated_duration_seconds: number | null
          source_type: SourceType
          source_file: string | null
          review_status: ReviewStatus
          review_notes: string | null
          canonical_move_id: string | null
          ai_decision: AiDecision | null
          ai_confidence: number | null
          ai_reason: string | null
          ai_proposed_canonical_move_id: string | null
          ai_review_family_id: string | null
          ai_reviewed_at: string | null
          ai_payload_json: Json
          imported_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          raw_title: string
          cleaned_title: string
          slug_candidate: string
          dedupe_key?: string | null
          summary?: string | null
          description?: string | null
          category: MoveCategory
          difficulty: MoveDifficulty
          grade_level?: GradeLevel | null
          format_tags?: string[]
          skill_tags?: string[]
          tags?: string[]
          steps_json?: Json
          focus_points_json?: Json
          common_mistakes_json?: Json
          what_it_trains?: string | null
          when_to_assign?: string | null
          coach_demo_quote?: string | null
          estimated_duration_seconds?: number | null
          source_type: SourceType
          source_file?: string | null
          review_status?: ReviewStatus
          review_notes?: string | null
          canonical_move_id?: string | null
          ai_decision?: AiDecision | null
          ai_confidence?: number | null
          ai_reason?: string | null
          ai_proposed_canonical_move_id?: string | null
          ai_review_family_id?: string | null
          ai_reviewed_at?: string | null
          ai_payload_json?: Json
          imported_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['raw_drill_candidates']['Insert']>
      }
      moves: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string
          description: string | null
          category: MoveCategory | null
          difficulty: MoveDifficulty
          grade_level: GradeLevel | null
          format_tags: string[]
          skill_tags: string[]
          tags: string[]
          steps_json: Json
          focus_points_json: Json
          common_mistakes_json: Json
          what_it_trains: string | null
          when_to_assign: string | null
          coach_demo_quote: string | null
          demo_video_url: string | null
          animation_key: string | null
          source_type: SourceType | null
          source_file: string | null
          raw_candidate_ids: string[]
          is_active: boolean
          is_curated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          summary: string
          description?: string | null
          category?: MoveCategory | null
          difficulty?: MoveDifficulty
          grade_level?: GradeLevel | null
          format_tags?: string[]
          skill_tags?: string[]
          tags?: string[]
          steps_json?: Json
          focus_points_json?: Json
          common_mistakes_json?: Json
          what_it_trains?: string | null
          when_to_assign?: string | null
          coach_demo_quote?: string | null
          demo_video_url?: string | null
          animation_key?: string | null
          source_type?: SourceType | null
          source_file?: string | null
          raw_candidate_ids?: string[]
          is_active?: boolean
          is_curated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['moves']['Insert']>
      }
      combinations: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string | null
          description: string | null
          difficulty: MoveDifficulty | null
          category: CombinationCategory | null
          goal_tags: string[]
          is_active: boolean
          is_curated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          summary?: string | null
          description?: string | null
          difficulty?: MoveDifficulty | null
          category?: CombinationCategory | null
          goal_tags?: string[]
          is_active?: boolean
          is_curated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['combinations']['Insert']>
      }
      combination_items: {
        Row: {
          id: string
          combination_id: string
          move_id: string
          order_index: number
          role: CombinationItemRole | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          combination_id: string
          move_id: string
          order_index: number
          role?: CombinationItemRole | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['combination_items']['Insert']>
      }
      workout_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          grade: string | null
          difficulty: number | null
          duration_minutes: number | null
          round_count: number | null
          round_duration_seconds: number | null
          rest_duration_seconds: number | null
          drill_sequence: Json | null
          lesson_link: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          grade?: string | null
          difficulty?: number | null
          duration_minutes?: number | null
          round_count?: number | null
          round_duration_seconds?: number | null
          rest_duration_seconds?: number | null
          drill_sequence?: Json | null
          lesson_link?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['workout_templates']['Insert']>
      }
      workouts: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string | null
          description: string | null
          discipline: WorkoutDiscipline | null
          difficulty: string | null
          estimated_duration_minutes: number | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          summary?: string | null
          description?: string | null
          discipline?: WorkoutDiscipline | null
          difficulty?: string | null
          estimated_duration_minutes?: number | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['workouts']['Insert']>
      }
      workout_items: {
        Row: {
          id: string
          workout_id: string
          title: string
          item_type: WorkoutItemType | null
          order_index: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          title: string
          item_type?: WorkoutItemType | null
          order_index?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['workout_items']['Insert']>
      }
      exercises: {
        Row: {
          id: string
          title: string
          slug: string
          discipline: ExerciseDiscipline
          item_type: ExerciseType
          category: string | null
          summary: string
          description: string | null
          instructions_json: Json
          coaching_cues_json: Json
          common_mistakes_json: Json
          equipment_tags: string[]
          difficulty: MoveDifficulty | null
          structure_json: Json
          is_active: boolean
          is_curated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          discipline: ExerciseDiscipline
          item_type: ExerciseType
          category?: string | null
          summary: string
          description?: string | null
          instructions_json?: Json
          coaching_cues_json?: Json
          common_mistakes_json?: Json
          equipment_tags?: string[]
          difficulty?: MoveDifficulty | null
          structure_json?: Json
          is_active?: boolean
          is_curated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>
      }
      workout_item_exercises: {
        Row: {
          id: string
          workout_item_id: string
          exercise_id: string
          order_index: number
          prescription_json: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workout_item_id: string
          exercise_id: string
          order_index?: number
          prescription_json?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['workout_item_exercises']['Insert']>
      }
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          grade: string | null
          xp: number | null
          level: number | null
          streak_current: number | null
          streak_best: number | null
          total_rounds: number | null
          total_minutes: number | null
          badges: Json | null
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          grade?: string | null
          xp?: number | null
          level?: number | null
          streak_current?: number | null
          streak_best?: number | null
          total_rounds?: number | null
          total_minutes?: number | null
          badges?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      workout_logs: {
        Row: {
          id: string
          user_id: string | null
          workout_template_id: string | null
          custom_name: string | null
          drill_log: Json | null
          total_rounds: number | null
          total_minutes: number | null
          xp_earned: number | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          workout_template_id?: string | null
          custom_name?: string | null
          drill_log?: Json | null
          total_rounds?: number | null
          total_minutes?: number | null
          xp_earned?: number | null
          completed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['workout_logs']['Insert']>
      }
      feed_posts: {
        Row: {
          id: string
          user_id: string | null
          workout_log_id: string | null
          content: string | null
          post_type: string | null
          likes_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          workout_log_id?: string | null
          content?: string | null
          post_type?: string | null
          likes_count?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['feed_posts']['Insert']>
      }
      feed_likes: {
        Row: {
          user_id: string
          post_id: string
        }
        Insert: {
          user_id: string
          post_id: string
        }
        Update: {
          user_id?: string
          post_id?: string
        }
      }
      badges: {
        Row: {
          id: string
          name: string | null
          description: string | null
          icon: string | null
          xp_reward: number | null
          condition: Json | null
        }
        Insert: {
          id: string
          name?: string | null
          description?: string | null
          icon?: string | null
          xp_reward?: number | null
          condition?: Json | null
        }
        Update: Partial<Database['public']['Tables']['badges']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type RawDrillCandidate = Database['public']['Tables']['raw_drill_candidates']['Row']
export type Move = Database['public']['Tables']['moves']['Row']
export type Drill = Move
export type Combination = Database['public']['Tables']['combinations']['Row']
export type CombinationItem = Database['public']['Tables']['combination_items']['Row']
export type WorkoutTemplate = Database['public']['Tables']['workout_templates']['Row']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutItem = Database['public']['Tables']['workout_items']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type TrainingItem = Exercise
export type WorkoutItemExercise = Database['public']['Tables']['workout_item_exercises']['Row']
export type WorkoutItemTrainingItem = WorkoutItemExercise
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type WorkoutLog = Database['public']['Tables']['workout_logs']['Row']
export type FeedPost = Database['public']['Tables']['feed_posts']['Row']
export type FeedLike = Database['public']['Tables']['feed_likes']['Row']
export type Badge = Database['public']['Tables']['badges']['Row']
