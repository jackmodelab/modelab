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
      articles: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          excerpt: string | null
          id: string
          members_only: boolean
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          members_only?: boolean
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          members_only?: boolean
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          assessment_date: string
          attachments: Json
          booking_id: string | null
          client_id: string
          created_at: string
          data: Json
          id: string
          notes: string | null
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at: string
        }
        Insert: {
          assessment_date: string
          attachments?: Json
          booking_id?: string | null
          client_id: string
          created_at?: string
          data?: Json
          id?: string
          notes?: string | null
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
        }
        Update: {
          assessment_date?: string
          attachments?: Json
          booking_id?: string | null
          client_id?: string
          created_at?: string
          data?: Json
          id?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          client_id: string
          client_package_id: string | null
          created_at: string
          ends_at: string
          google_calendar_event_id: string | null
          id: string
          location_id: string
          notes: string | null
          rescheduled_to_booking_id: string | null
          service_id: string
          staff_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          client_id: string
          client_package_id?: string | null
          created_at?: string
          ends_at: string
          google_calendar_event_id?: string | null
          id?: string
          location_id: string
          notes?: string | null
          rescheduled_to_booking_id?: string | null
          service_id: string
          staff_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          client_id?: string
          client_package_id?: string | null
          created_at?: string
          ends_at?: string
          google_calendar_event_id?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          rescheduled_to_booking_id?: string | null
          service_id?: string
          staff_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rescheduled_to_booking_id_fkey"
            columns: ["rescheduled_to_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          assigned_at: string
          client_id: string
          id: string
          is_active: boolean
          staff_id: string
        }
        Insert: {
          assigned_at?: string
          client_id: string
          id?: string
          is_active?: boolean
          staff_id: string
        }
        Update: {
          assigned_at?: string
          client_id?: string
          id?: string
          is_active?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packages: {
        Row: {
          auto_renew: boolean
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          package_id: string
          purchased_at: string
          sessions_remaining: Json
          status: Database["public"]["Enums"]["package_status"]
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id: string
          purchased_at?: string
          sessions_remaining?: Json
          status?: Database["public"]["Enums"]["package_status"]
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string
          purchased_at?: string
          sessions_remaining?: Json
          status?: Database["public"]["Enums"]["package_status"]
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_screenings: {
        Row: {
          answers: Json
          client_id: string
          created_at: string
          id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          client_id: string
          created_at?: string
          id?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          client_id?: string
          created_at?: string
          id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_screenings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auth_user_id: string | null
          created_at: string
          date_of_birth: string | null
          discount_tier: Database["public"]["Enums"]["discount_tier"]
          email: string
          emergency_contact: Json | null
          full_name: string | null
          health_notes: string | null
          id: string
          marketing_consent: boolean
          phone: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          discount_tier?: Database["public"]["Enums"]["discount_tier"]
          email: string
          emergency_contact?: Json | null
          full_name?: string | null
          health_notes?: string | null
          id?: string
          marketing_consent?: boolean
          phone?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          discount_tier?: Database["public"]["Enums"]["discount_tier"]
          email?: string
          emergency_contact?: Json | null
          full_name?: string | null
          health_notes?: string | null
          id?: string
          marketing_consent?: boolean
          phone?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          file_type: string | null
          id: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by_staff_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          id?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by_staff_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          id?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_staff_id_fkey"
            columns: ["uploaded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          metadata: Json
          name: string | null
          phone: string | null
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          source: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          source?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          opens_at: string | null
          postcode: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["location_status"]
          suburb: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          opens_at?: string | null
          postcode?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["location_status"]
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          opens_at?: string | null
          postcode?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["location_status"]
          suburb?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          id: string
          includes: Json
          is_active: boolean
          is_hero_offer: boolean
          is_recurring: boolean
          name: string
          price_cents: number
          session_allocations: Json
          slug: string
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          tagline: string | null
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          includes?: Json
          is_active?: boolean
          is_hero_offer?: boolean
          is_recurring?: boolean
          name: string
          price_cents: number
          session_allocations?: Json
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tagline?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          includes?: Json
          is_active?: boolean
          is_hero_offer?: boolean
          is_recurring?: boolean
          name?: string
          price_cents?: number
          session_allocations?: Json
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tagline?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price_cents: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          base_price_cents: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          auth_user_id: string | null
          bio: string | null
          created_at: string
          credentials: Json
          display_name: string
          google_calendar_connected_at: string | null
          google_calendar_email: string | null
          google_refresh_token: string | null
          id: string
          is_active: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          bio?: string | null
          created_at?: string
          credentials?: Json
          display_name: string
          google_calendar_connected_at?: string | null
          google_calendar_email?: string | null
          google_refresh_token?: string | null
          id?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          bio?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string
          google_calendar_connected_at?: string | null
          google_calendar_email?: string | null
          google_refresh_token?: string | null
          id?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          location_id: string | null
          staff_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          staff_id: string
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          staff_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      assessment_type: "body_comp" | "movement_screen" | "custom"
      booking_status:
        | "confirmed"
        | "completed"
        | "cancelled_24hr_plus"
        | "cancelled_under_24hr"
        | "no_show"
        | "rescheduled"
      discount_tier: "standard" | "student_senior" | "friends_family"
      location_status: "active" | "coming_soon" | "closed"
      package_status:
        | "active"
        | "expired"
        | "consumed"
        | "refunded"
        | "cancelled"
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
    Enums: {
      assessment_type: ["body_comp", "movement_screen", "custom"],
      booking_status: [
        "confirmed",
        "completed",
        "cancelled_24hr_plus",
        "cancelled_under_24hr",
        "no_show",
        "rescheduled",
      ],
      discount_tier: ["standard", "student_senior", "friends_family"],
      location_status: ["active", "coming_soon", "closed"],
      package_status: [
        "active",
        "expired",
        "consumed",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const
