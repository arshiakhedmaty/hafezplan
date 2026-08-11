export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      course_sections: {
        Row: {
          capacity: number | null
          course_id: string
          created_at: string
          exam_date: string | null
          exam_end: string | null
          exam_start: string | null
          id: string
          location: string | null
          meetings: Json
          owner_id: string | null
          professor: string | null
          section_name: string
        }
        Insert: {
          capacity?: number | null
          course_id: string
          created_at?: string
          exam_date?: string | null
          exam_end?: string | null
          exam_start?: string | null
          id?: string
          location?: string | null
          meetings?: Json
          owner_id?: string | null
          professor?: string | null
          section_name: string
        }
        Update: {
          capacity?: number | null
          course_id?: string
          created_at?: string
          exam_date?: string | null
          exam_end?: string | null
          exam_start?: string | null
          id?: string
          location?: string | null
          meetings?: Json
          owner_id?: string | null
          professor?: string | null
          section_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          corequisites: Json | null
          course_type: string
          created_at: string
          credits: number
          department: string | null
          id: string
          name_en: string
          name_fa: string
          owner_id: string | null
          prerequisites: Json | null
          repeatable: boolean
        }
        Insert: {
          code: string
          corequisites?: Json | null
          course_type?: string
          created_at?: string
          credits?: number
          department?: string | null
          id?: string
          name_en: string
          name_fa: string
          owner_id?: string | null
          prerequisites?: Json | null
          repeatable?: boolean
        }
        Update: {
          code?: string
          corequisites?: Json | null
          course_type?: string
          created_at?: string
          credits?: number
          department?: string | null
          id?: string
          name_en?: string
          name_fa?: string
          owner_id?: string | null
          prerequisites?: Json | null
          repeatable?: boolean
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          data: Json
          id: string
          is_final: boolean
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          is_final?: boolean
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          is_final?: boolean
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          degree: string | null
          display_name: string | null
          language: string
          major: string | null
          max_credits: number
          min_credits: number
          semester: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          display_name?: string | null
          language?: string
          major?: string | null
          max_credits?: number
          min_credits?: number
          semester?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          display_name?: string | null
          language?: string
          major?: string | null
          max_credits?: number
          min_credits?: number
          semester?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_courses: {
        Row: {
          course_code: string
          created_at: string
          id: string
          note: string | null
          override_eligible: boolean | null
          status: string
          user_id: string
        }
        Insert: {
          course_code: string
          created_at?: string
          id?: string
          note?: string | null
          override_eligible?: boolean | null
          status: string
          user_id: string
        }
        Update: {
          course_code?: string
          created_at?: string
          id?: string
          note?: string | null
          override_eligible?: boolean | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      student_preferences: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
