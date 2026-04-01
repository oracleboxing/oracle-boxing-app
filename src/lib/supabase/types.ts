export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      drills: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          category: string | null
          grade: string | null
          difficulty: number | null
          cues: string[] | null
          common_mistakes: string[] | null
          video_url: string | null
          duration_default: number | null
          rep_based: boolean | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          category?: string | null
          grade?: string | null
          difficulty?: number | null
          cues?: string[] | null
          common_mistakes?: string[] | null
          video_url?: string | null
          duration_default?: number | null
          rep_based?: boolean | null
          tags?: string[] | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['drills']['Insert']>
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
export type Drill = Database['public']['Tables']['drills']['Row']
export type WorkoutTemplate = Database['public']['Tables']['workout_templates']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type WorkoutLog = Database['public']['Tables']['workout_logs']['Row']
export type FeedPost = Database['public']['Tables']['feed_posts']['Row']
export type FeedLike = Database['public']['Tables']['feed_likes']['Row']
export type Badge = Database['public']['Tables']['badges']['Row']
