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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      budget_items: {
        Row: {
          actual_spent: number | null
          approved_budget: number | null
          category: string | null
          comments: string | null
          created_at: string
          description: string | null
          id: string
          paid_status: string | null
          project_id: string | null
          spent_date: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          actual_spent?: number | null
          approved_budget?: number | null
          category?: string | null
          comments?: string | null
          created_at?: string
          description?: string | null
          id?: string
          paid_status?: string | null
          project_id?: string | null
          spent_date?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          actual_spent?: number | null
          approved_budget?: number | null
          category?: string | null
          comments?: string | null
          created_at?: string
          description?: string | null
          id?: string
          paid_status?: string | null
          project_id?: string | null
          spent_date?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_contributions: {
        Row: {
          agreed_return: string | null
          amount_committed: number | null
          amount_received: number | null
          amount_required: number | null
          bank_account: string | null
          capital_type: string | null
          comments: string | null
          created_at: string
          id: string
          investor_id: string | null
          project_id: string | null
          received_date: string | null
          reference: string | null
          status: string | null
          term: string | null
          updated_at: string | null
        }
        Insert: {
          agreed_return?: string | null
          amount_committed?: number | null
          amount_received?: number | null
          amount_required?: number | null
          bank_account?: string | null
          capital_type?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          investor_id?: string | null
          project_id?: string | null
          received_date?: string | null
          reference?: string | null
          status?: string | null
          term?: string | null
          updated_at?: string | null
        }
        Update: {
          agreed_return?: string | null
          amount_committed?: number | null
          amount_received?: number | null
          amount_required?: number | null
          bank_account?: string | null
          capital_type?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          investor_id?: string | null
          project_id?: string | null
          received_date?: string | null
          reference?: string | null
          status?: string | null
          term?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capital_contributions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_totals"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "capital_contributions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "capital_contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          date: string | null
          doc_type: string | null
          file_url: string | null
          id: string
          investor_id: string | null
          name: string | null
          project_id: string | null
          responsible: string | null
          status: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          doc_type?: string | null
          file_url?: string | null
          id?: string
          investor_id?: string | null
          name?: string | null
          project_id?: string | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          doc_type?: string | null
          file_url?: string | null
          id?: string
          investor_id?: string | null
          name?: string | null
          project_id?: string | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_totals"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "documents_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          completed_at: string | null
          created_at: string
          decline_reason: string | null
          id: string
          status: string | null
          truora_process_id: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          id?: string
          status?: string | null
          truora_process_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          id?: string
          status?: string | null
          truora_process_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_interests: {
        Row: {
          amount: number | null
          comments: string | null
          created_at: string
          id: string
          investment_type_pref: string | null
          phone: string | null
          project_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          comments?: string | null
          created_at?: string
          id?: string
          investment_type_pref?: string | null
          phone?: string | null
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          comments?: string | null
          created_at?: string
          id?: string
          investment_type_pref?: string | null
          phone?: string | null
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_interests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "investment_interests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          city_country: string | null
          created_at: string
          document_id: string | null
          email: string | null
          first_contact_date: string | null
          full_name: string
          id: string
          investment_type_pref: string | null
          last_contact_date: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          potential_amount: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          city_country?: string | null
          created_at?: string
          document_id?: string | null
          email?: string | null
          first_contact_date?: string | null
          full_name: string
          id?: string
          investment_type_pref?: string | null
          last_contact_date?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          potential_amount?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          city_country?: string | null
          created_at?: string
          document_id?: string | null
          email?: string | null
          first_contact_date?: string | null
          full_name?: string
          id?: string
          investment_type_pref?: string | null
          last_contact_date?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          potential_amount?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          capital_used_month: number | null
          created_at: string
          decisions: string | null
          financial_progress: string | null
          id: string
          next_report_date: string | null
          next_steps: string | null
          photos: string[] | null
          physical_progress: string | null
          project_id: string | null
          report_month: string | null
          report_pdf_url: string | null
          risks: string | null
          updated_at: string | null
        }
        Insert: {
          capital_used_month?: number | null
          created_at?: string
          decisions?: string | null
          financial_progress?: string | null
          id?: string
          next_report_date?: string | null
          next_steps?: string | null
          photos?: string[] | null
          physical_progress?: string | null
          project_id?: string | null
          report_month?: string | null
          report_pdf_url?: string | null
          risks?: string | null
          updated_at?: string | null
        }
        Update: {
          capital_used_month?: number | null
          created_at?: string
          decisions?: string | null
          financial_progress?: string | null
          id?: string
          next_report_date?: string | null
          next_steps?: string | null
          photos?: string[] | null
          physical_progress?: string | null
          project_id?: string | null
          report_month?: string | null
          report_pdf_url?: string | null
          risks?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "monthly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          capital_required: number | null
          city: string | null
          company: string | null
          created_at: string
          deadline: string | null
          description: string | null
          drive_folder_url: string | null
          estimated_rent: number | null
          estimated_sale_value: number | null
          fundraising_goal: number | null
          id: string
          in_fundraising: boolean
          lat: number | null
          lng: number | null
          lot_value: number | null
          main_photos: string[] | null
          name: string
          next_step: string | null
          progress: number | null
          responsible: string | null
          selling_points: Json | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          capital_required?: number | null
          city?: string | null
          company?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          drive_folder_url?: string | null
          estimated_rent?: number | null
          estimated_sale_value?: number | null
          fundraising_goal?: number | null
          id?: string
          in_fundraising?: boolean
          lat?: number | null
          lng?: number | null
          lot_value?: number | null
          main_photos?: string[] | null
          name: string
          next_step?: string | null
          progress?: number | null
          responsible?: string | null
          selling_points?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          capital_required?: number | null
          city?: string | null
          company?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          drive_folder_url?: string | null
          estimated_rent?: number | null
          estimated_sale_value?: number | null
          fundraising_goal?: number | null
          id?: string
          in_fundraising?: boolean
          lat?: number | null
          lng?: number | null
          lot_value?: number | null
          main_photos?: string[] | null
          name?: string
          next_step?: string | null
          progress?: number | null
          responsible?: string | null
          selling_points?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reassignment_requests: {
        Row: {
          amount: number | null
          from_project_id: string | null
          id: string
          investor_id: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          to_project_id: string | null
        }
        Insert: {
          amount?: number | null
          from_project_id?: string | null
          id?: string
          investor_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          to_project_id?: string | null
        }
        Update: {
          amount?: number | null
          from_project_id?: string | null
          id?: string
          investor_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          to_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reassignment_requests_from_project_id_fkey"
            columns: ["from_project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "reassignment_requests_from_project_id_fkey"
            columns: ["from_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassignment_requests_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_totals"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "reassignment_requests_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassignment_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassignment_requests_to_project_id_fkey"
            columns: ["to_project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "reassignment_requests_to_project_id_fkey"
            columns: ["to_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_date: string | null
          created_at: string
          estimated_date: string | null
          id: string
          next_action: string | null
          priority: string | null
          project_id: string | null
          responsible: string | null
          stage: string | null
          status: string | null
          task: string | null
          updated_at: string | null
        }
        Insert: {
          actual_date?: string | null
          created_at?: string
          estimated_date?: string | null
          id?: string
          next_action?: string | null
          priority?: string | null
          project_id?: string | null
          responsible?: string | null
          stage?: string | null
          status?: string | null
          task?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_date?: string | null
          created_at?: string
          estimated_date?: string | null
          id?: string
          next_action?: string | null
          priority?: string | null
          project_id?: string | null
          responsible?: string | null
          stage?: string | null
          status?: string | null
          task?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          capital_type: string | null
          created_at: string
          date: string | null
          id: string
          investor_id: string | null
          project_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          capital_type?: string | null
          created_at?: string
          date?: string | null
          id?: string
          investor_id?: string | null
          project_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          capital_type?: string | null
          created_at?: string
          date?: string | null
          id?: string
          investor_id?: string | null
          project_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_totals"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "transactions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          identity_verified: boolean
          onboarding_completed: boolean
          phone: string | null
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          identity_verified?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          identity_verified?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      investor_totals: {
        Row: {
          investor_id: string | null
          total_committed: number | null
          total_received: number | null
        }
        Relationships: []
      }
      project_totals: {
        Row: {
          capital_pending: number | null
          capital_received: number | null
          executed_budget: number | null
          project_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_save_table_changes: {
        Args: { p_inserts?: Json; p_table: string; p_updates?: Json }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
