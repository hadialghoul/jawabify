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
  public: {
    Tables: {
      agents: {
        Row: {
          active: boolean
          areas: string[]
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          property_types: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          areas?: string[]
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          property_types?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          areas?: string[]
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          property_types?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_incidents: {
        Row: {
          ai_reply: string | null
          contact_id: string | null
          created_at: string
          id: string
          incident_type: string
          metadata: Json
          model: string | null
          reason: string | null
          resolved: boolean
          tenant_id: string | null
          updated_at: string
          user_message: string | null
        }
        Insert: {
          ai_reply?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          incident_type: string
          metadata?: Json
          model?: string | null
          reason?: string | null
          resolved?: boolean
          tenant_id?: string | null
          updated_at?: string
          user_message?: string | null
        }
        Update: {
          ai_reply?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          incident_type?: string
          metadata?: Json
          model?: string | null
          reason?: string | null
          resolved?: boolean
          tenant_id?: string | null
          updated_at?: string
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_incidents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          is_active: boolean
          shopify_product_id: string | null
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          is_active?: boolean
          shopify_product_id?: string | null
          tenant_id?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          is_active?: boolean
          shopify_product_id?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          guided_order_flow_ai_hints_enabled: boolean
          guided_order_flow_enabled: boolean
          id: string
          key: string
          tenant_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          guided_order_flow_ai_hints_enabled?: boolean
          guided_order_flow_enabled?: boolean
          id?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          guided_order_flow_ai_hints_enabled?: boolean
          guided_order_flow_enabled?: boolean
          id?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_items: {
        Row: {
          bill_id: string
          created_at: string
          id: string
          menu_item_id: string | null
          modifiers: Json
          name: string
          qty: number
          unit_price: number
        }
        Insert: {
          bill_id: string
          created_at?: string
          id?: string
          menu_item_id?: string | null
          modifiers?: Json
          name: string
          qty?: number
          unit_price?: number
        }
        Update: {
          bill_id?: string
          created_at?: string
          id?: string
          menu_item_id?: string | null
          modifiers?: Json
          name?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          contact_id: string | null
          created_at: string
          currency: string
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number
          display_id: number | null
          handoff_reason: string | null
          id: string
          needs_human: boolean
          notes: string | null
          order_type: string | null
          payment_method: string | null
          reservation_id: string | null
          source: string
          status: string
          table_id: string | null
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          display_id?: number | null
          handoff_reason?: string | null
          id?: string
          needs_human?: boolean
          notes?: string | null
          order_type?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          source?: string
          status?: string
          table_id?: string | null
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          display_id?: number | null
          handoff_reason?: string | null
          id?: string
          needs_human?: boolean
          notes?: string | null
          order_type?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          source?: string
          status?: string
          table_id?: string | null
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          error: string | null
          error_code: string | null
          failed_at: string | null
          id: string
          last_error_at: string | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string
          phone_number: string
          read_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          whatsapp_message_id: string | null
        }
        Insert: {
          attempts?: number
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          last_error_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string
          phone_number: string
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          attempts?: number
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          last_error_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string
          phone_number?: string
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          append_opt_out: boolean
          auto_paused: boolean
          completed_at: string | null
          concurrency: number
          created_at: string
          created_by: string | null
          delivered_count: number
          failed_count: number
          id: string
          name: string
          opt_out_variable_index: number | null
          paused_reason: string | null
          read_count: number
          replied_count: number
          scheduled_at: string | null
          send_rate_per_minute: number
          sent_count: number
          started_at: string | null
          status: string
          template_body: string | null
          template_language: string
          template_name: string
          tenant_id: string
          total_recipients: number
          updated_at: string
          variable_fallbacks: string[]
          variables: Json
        }
        Insert: {
          append_opt_out?: boolean
          auto_paused?: boolean
          completed_at?: string | null
          concurrency?: number
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          name: string
          opt_out_variable_index?: number | null
          paused_reason?: string | null
          read_count?: number
          replied_count?: number
          scheduled_at?: string | null
          send_rate_per_minute?: number
          sent_count?: number
          started_at?: string | null
          status?: string
          template_body?: string | null
          template_language?: string
          template_name: string
          tenant_id: string
          total_recipients?: number
          updated_at?: string
          variable_fallbacks?: string[]
          variables?: Json
        }
        Update: {
          append_opt_out?: boolean
          auto_paused?: boolean
          completed_at?: string | null
          concurrency?: number
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          name?: string
          opt_out_variable_index?: number | null
          paused_reason?: string | null
          read_count?: number
          replied_count?: number
          scheduled_at?: string | null
          send_rate_per_minute?: number
          sent_count?: number
          started_at?: string | null
          status?: string
          template_body?: string | null
          template_language?: string
          template_name?: string
          tenant_id?: string
          total_recipients?: number
          updated_at?: string
          variable_fallbacks?: string[]
          variables?: Json
        }
        Relationships: []
      }
      consultation_leads: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          source_path: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          source_path?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          source_path?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          ai_enabled: boolean
          assigned_at: string | null
          assigned_by_member_id: string | null
          assigned_member_id: string | null
          blocked: boolean
          blocked_at: string | null
          created_at: string
          email: string | null
          external_id: string | null
          handle: string | null
          human_requested_at: string | null
          id: string
          interest_reason: string | null
          interested_at: string | null
          is_interested: boolean
          is_online: boolean | null
          name: string | null
          needs_human: boolean
          notes: string | null
          opted_out: boolean
          opted_out_at: string | null
          phone_number: string
          platform: string
          tags: string[]
          tenant_id: string | null
          updated_at: string
          vertical_flow_state: Json | null
        }
        Insert: {
          address?: string | null
          ai_enabled?: boolean
          assigned_at?: string | null
          assigned_by_member_id?: string | null
          assigned_member_id?: string | null
          blocked?: boolean
          blocked_at?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          handle?: string | null
          human_requested_at?: string | null
          id?: string
          interest_reason?: string | null
          interested_at?: string | null
          is_interested?: boolean
          is_online?: boolean | null
          name?: string | null
          needs_human?: boolean
          notes?: string | null
          opted_out?: boolean
          opted_out_at?: string | null
          phone_number: string
          platform?: string
          tags?: string[]
          tenant_id?: string | null
          updated_at?: string
          vertical_flow_state?: Json | null
        }
        Update: {
          address?: string | null
          ai_enabled?: boolean
          assigned_at?: string | null
          assigned_by_member_id?: string | null
          assigned_member_id?: string | null
          blocked?: boolean
          blocked_at?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          handle?: string | null
          human_requested_at?: string | null
          id?: string
          interest_reason?: string | null
          interested_at?: string | null
          is_interested?: boolean
          is_online?: boolean | null
          name?: string | null
          needs_human?: boolean
          notes?: string | null
          opted_out?: boolean
          opted_out_at?: string | null
          phone_number?: string
          platform?: string
          tags?: string[]
          tenant_id?: string | null
          updated_at?: string
          vertical_flow_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_by_member_id_fkey"
            columns: ["assigned_by_member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          stripe_price_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          stripe_price_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_courses: {
        Row: {
          active: boolean
          age_group: string | null
          capacity: number
          created_at: string
          currency: string
          description: string | null
          id: string
          level: string | null
          name: string
          payment_link_url: string | null
          payment_options: string[]
          price: number
          schedule: string | null
          start_date: string | null
          subject: string | null
          tenant_id: string
          trial_available: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_group?: string | null
          capacity?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          level?: string | null
          name: string
          payment_link_url?: string | null
          payment_options?: string[]
          price?: number
          schedule?: string | null
          start_date?: string | null
          subject?: string | null
          tenant_id: string
          trial_available?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_group?: string | null
          capacity?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          level?: string | null
          name?: string
          payment_link_url?: string | null
          payment_options?: string[]
          price?: number
          schedule?: string | null
          start_date?: string | null
          subject?: string | null
          tenant_id?: string
          trial_available?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      education_enrollments: {
        Row: {
          amount_paid: number
          contact_id: string | null
          course_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_status: string
          plan_type: string
          progress_last_sent_at: string | null
          progress_next_at: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          source: string
          start_date: string | null
          status: string
          student_age: string | null
          student_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          contact_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          payment_status?: string
          plan_type?: string
          progress_last_sent_at?: string | null
          progress_next_at?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          source?: string
          start_date?: string | null
          status?: string
          student_age?: string | null
          student_name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          contact_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          payment_status?: string
          plan_type?: string
          progress_last_sent_at?: string | null
          progress_next_at?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          source?: string
          start_date?: string | null
          status?: string
          student_age?: string | null
          student_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "education_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "education_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      education_leads: {
        Row: {
          contact_id: string | null
          course_id: string | null
          created_at: string
          handoff_reason: string | null
          id: string
          needs_human: boolean
          notes: string | null
          parent_name: string | null
          parent_phone: string | null
          preferred_schedule: string | null
          source: string
          status: string
          student_age: string | null
          student_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          course_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          needs_human?: boolean
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          preferred_schedule?: string | null
          source?: string
          status?: string
          student_age?: string | null
          student_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          course_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          needs_human?: boolean
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          preferred_schedule?: string | null
          source?: string
          status?: string
          student_age?: string | null
          student_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_leads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "education_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      education_settings: {
        Row: {
          bot_tone: string
          calendly_url: string | null
          created_at: string
          crm_webhook_url: string | null
          currency: string
          day_before_reminder: boolean
          enrollment_confirmation_template: string
          google_calendar_url: string | null
          google_sheet_url: string | null
          human_transfer_phone: string | null
          languages: string[]
          meta_ads_pixel: string | null
          payment_link_template: string | null
          progress_day_of_week: number
          progress_message_template: string
          reminder_hours_before: number
          tenant_id: string
          trial_class_minutes: number
          updated_at: string
        }
        Insert: {
          bot_tone?: string
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          day_before_reminder?: boolean
          enrollment_confirmation_template?: string
          google_calendar_url?: string | null
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          languages?: string[]
          meta_ads_pixel?: string | null
          payment_link_template?: string | null
          progress_day_of_week?: number
          progress_message_template?: string
          reminder_hours_before?: number
          tenant_id: string
          trial_class_minutes?: number
          updated_at?: string
        }
        Update: {
          bot_tone?: string
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          day_before_reminder?: boolean
          enrollment_confirmation_template?: string
          google_calendar_url?: string | null
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          languages?: string[]
          meta_ads_pixel?: string | null
          payment_link_template?: string | null
          progress_day_of_week?: number
          progress_message_template?: string
          reminder_hours_before?: number
          tenant_id?: string
          trial_class_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      healthcare_appointments: {
        Row: {
          contact_id: string | null
          created_at: string
          doctor_id: string | null
          duration_min: number
          followup_at: string | null
          followup_sent_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          patient_name: string
          patient_phone: string | null
          reason: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          source: string
          specialty_id: string | null
          status: string
          tenant_id: string
          triage_notes: string | null
          updated_at: string
          urgency_level: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          doctor_id?: string | null
          duration_min?: number
          followup_at?: string | null
          followup_sent_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          patient_name: string
          patient_phone?: string | null
          reason?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          source?: string
          specialty_id?: string | null
          status?: string
          tenant_id: string
          triage_notes?: string | null
          updated_at?: string
          urgency_level?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          doctor_id?: string | null
          duration_min?: number
          followup_at?: string | null
          followup_sent_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          patient_name?: string
          patient_phone?: string | null
          reason?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          source?: string
          specialty_id?: string | null
          status?: string
          tenant_id?: string
          triage_notes?: string | null
          updated_at?: string
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "healthcare_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "healthcare_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_appointments_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "healthcare_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_doctors: {
        Row: {
          active: boolean
          availability: Json
          bio: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          specialty_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          availability?: Json
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialty_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          availability?: Json
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialty_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_doctors_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "healthcare_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_doctors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_lab_results: {
        Row: {
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          patient_name: string | null
          result_url: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_name?: string | null
          result_url?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_name?: string | null
          result_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_lab_results_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_lab_results_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "healthcare_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_lab_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_leads: {
        Row: {
          assigned_doctor_id: string | null
          contact_id: string | null
          created_at: string
          handoff_reason: string | null
          id: string
          intent: string
          needs_human: boolean
          notes: string | null
          reason: string | null
          source: string
          specialty_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          urgency_level: string | null
        }
        Insert: {
          assigned_doctor_id?: string | null
          contact_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          intent?: string
          needs_human?: boolean
          notes?: string | null
          reason?: string | null
          source?: string
          specialty_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          urgency_level?: string | null
        }
        Update: {
          assigned_doctor_id?: string | null
          contact_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          intent?: string
          needs_human?: boolean
          notes?: string | null
          reason?: string | null
          source?: string
          specialty_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_leads_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "healthcare_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_leads_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "healthcare_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_settings: {
        Row: {
          appointment_duration_min: number
          bot_tone: string
          calendly_url: string | null
          created_at: string
          crm_webhook_url: string | null
          currency: string
          followup_hours_after: number
          google_calendar_url: string | null
          google_sheet_url: string | null
          human_transfer_phone: string | null
          lab_message_template: string
          lab_webhook_url: string | null
          languages: string[]
          meta_ads_pixel: string | null
          reminder_hours_before: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_duration_min?: number
          bot_tone?: string
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          followup_hours_after?: number
          google_calendar_url?: string | null
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          lab_message_template?: string
          lab_webhook_url?: string | null
          languages?: string[]
          meta_ads_pixel?: string | null
          reminder_hours_before?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_duration_min?: number
          bot_tone?: string
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          followup_hours_after?: number
          google_calendar_url?: string | null
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          lab_message_template?: string
          lab_webhook_url?: string | null
          languages?: string[]
          meta_ads_pixel?: string | null
          reminder_hours_before?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_specialties: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          triage_questions: Json
          updated_at: string
          urgency_keywords: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          triage_questions?: Json
          updated_at?: string
          urgency_keywords?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          triage_questions?: Json
          updated_at?: string
          urgency_keywords?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_specialties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_images: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string
          is_active: boolean
          label: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url: string
          is_active?: boolean
          label: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          label?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_agent_id: string | null
          bedrooms_min: number | null
          budget_max: number | null
          budget_min: number | null
          contact_id: string | null
          created_at: string
          handoff_reason: string | null
          id: string
          intent: string | null
          needs_human: boolean
          notes: string | null
          preferred_areas: string[]
          property_type: string | null
          score: number
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          bedrooms_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          contact_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          intent?: string | null
          needs_human?: boolean
          notes?: string | null
          preferred_areas?: string[]
          property_type?: string | null
          score?: number
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          bedrooms_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          contact_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          intent?: string | null
          needs_human?: boolean
          notes?: string | null
          preferred_areas?: string[]
          property_type?: string | null
          score?: number
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          agent_id: string | null
          area_name: string | null
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          currency: string
          description: string | null
          external_ref: string | null
          external_source: string
          id: string
          images: Json
          kind: string
          price: number | null
          property_type: string
          region: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          area_name?: string | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          external_ref?: string | null
          external_source?: string
          id?: string
          images?: Json
          kind: string
          price?: number | null
          property_type: string
          region?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          area_name?: string | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          external_ref?: string | null
          external_source?: string
          id?: string
          images?: Json
          kind?: string
          price?: number | null
          property_type?: string
          region?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_modifiers: {
        Row: {
          created_at: string
          group_name: string
          id: string
          max_select: number
          menu_item_id: string
          options: Json
          required: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_name: string
          id?: string
          max_select?: number
          menu_item_id: string
          options?: Json
          required?: boolean
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          max_select?: number
          menu_item_id?: string
          options?: Json
          required?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_modifiers_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_modifiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          platform: string
          sent_by_member_id: string | null
          status: string
          twilio_sid: string | null
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          platform?: string
          sent_by_member_id?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          platform?: string
          sent_by_member_id?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sessions: {
        Row: {
          contact_id: string
          created_at: string
          draft: Json
          expires_at: string
          flow_kind: string
          id: string
          last_message_id: string | null
          pending_hints: Json
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          draft?: Json
          expires_at?: string
          flow_kind?: string
          id?: string
          last_message_id?: string | null
          pending_hints?: Json
          state?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          draft?: Json
          expires_at?: string
          flow_kind?: string
          id?: string
          last_message_id?: string | null
          pending_hints?: Json
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          confirmation_sent_at: string | null
          contact_id: string | null
          created_at: string
          created_by_member_id: string | null
          customer_address: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          display_id: number
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          line_items: Json | null
          product_name: string
          quantity: number
          shopify_last_attempt_at: string | null
          shopify_order_id: string | null
          shopify_sync_attempts: number
          shopify_sync_error: string | null
          shopify_sync_status: string | null
          shopify_synced_at: string | null
          source: string | null
          status: string
          tenant_id: string | null
          total_price: number | null
          tracking_company: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          confirmation_sent_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_member_id?: string | null
          customer_address: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          display_id?: number
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          line_items?: Json | null
          product_name: string
          quantity?: number
          shopify_last_attempt_at?: string | null
          shopify_order_id?: string | null
          shopify_sync_attempts?: number
          shopify_sync_error?: string | null
          shopify_sync_status?: string | null
          shopify_synced_at?: string | null
          source?: string | null
          status?: string
          tenant_id?: string | null
          total_price?: number | null
          tracking_company?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          confirmation_sent_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_member_id?: string | null
          customer_address?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          display_id?: number
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          line_items?: Json | null
          product_name?: string
          quantity?: number
          shopify_last_attempt_at?: string | null
          shopify_order_id?: string | null
          shopify_sync_attempts?: number
          shopify_sync_error?: string | null
          shopify_sync_status?: string | null
          shopify_synced_at?: string | null
          source?: string | null
          status?: string
          tenant_id?: string | null
          total_price?: number | null
          tracking_company?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          business_name: string | null
          business_type: string | null
          city: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          display_name: string | null
          expected_volume: string | null
          id: string
          onboarding_completed: boolean
          referral_source: string | null
          tour_completed_at: string | null
          tour_step: number
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          expected_volume?: string | null
          id?: string
          onboarding_completed?: boolean
          referral_source?: string | null
          tour_completed_at?: string | null
          tour_step?: number
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          expected_volume?: string | null
          id?: string
          onboarding_completed?: boolean
          referral_source?: string | null
          tour_completed_at?: string | null
          tour_step?: number
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      push_attempts: {
        Row: {
          body: string | null
          created_at: string
          error: string | null
          event_type: string
          http_status: number | null
          id: string
          outcome: string
          tenant_id: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          error?: string | null
          event_type: string
          http_status?: number | null
          id?: string
          outcome: string
          tenant_id?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          http_status?: number | null
          id?: string
          outcome?: string
          tenant_id?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          tenant_id: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          tenant_id?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          tenant_id?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      real_estate_settings: {
        Row: {
          areas_covered: string[]
          budget_brackets: Json
          calendly_url: string | null
          created_at: string
          crm_webhook_url: string | null
          currency: string
          followup_hours_after: number
          google_sheet_url: string | null
          human_transfer_phone: string | null
          languages: string[]
          reminder_hours_before: number
          tenant_id: string
          updated_at: string
          viewing_duration_min: number
        }
        Insert: {
          areas_covered?: string[]
          budget_brackets?: Json
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          followup_hours_after?: number
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          languages?: string[]
          reminder_hours_before?: number
          tenant_id: string
          updated_at?: string
          viewing_duration_min?: number
        }
        Update: {
          areas_covered?: string[]
          budget_brackets?: Json
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          followup_hours_after?: number
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          languages?: string[]
          reminder_hours_before?: number
          tenant_id?: string
          updated_at?: string
          viewing_duration_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          contact_id: string | null
          created_at: string
          ends_at: string
          guest_name: string
          guest_phone: string | null
          id: string
          notes: string | null
          party_size: number
          reminder_at: string | null
          reminder_sent_at: string | null
          source: string
          starts_at: string
          status: string
          table_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          ends_at: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number
          reminder_at?: string | null
          reminder_sent_at?: string | null
          source?: string
          starts_at: string
          status?: string
          table_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          ends_at?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number
          reminder_at?: string | null
          reminder_sent_at?: string | null
          source?: string
          starts_at?: string
          status?: string
          table_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          created_at: string
          daily_specials: string | null
          eta_text: string | null
          human_transfer_phone: string | null
          kitchen_notify_phone: string | null
          max_party_size: number | null
          opening_hours: Json | null
          reminder_hours_before: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_specials?: string | null
          eta_text?: string | null
          human_transfer_phone?: string | null
          kitchen_notify_phone?: string | null
          max_party_size?: number | null
          opening_hours?: Json | null
          reminder_hours_before?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_specials?: string | null
          eta_text?: string | null
          human_transfer_phone?: string | null
          kitchen_notify_phone?: string | null
          max_party_size?: number | null
          opening_hours?: Json | null
          reminder_hours_before?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          seats: number
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          seats?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          seats?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          shop_domain: string
          state: string
          tenant_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          shop_domain: string
          state: string
          tenant_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          shop_domain?: string
          state?: string
          tenant_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shopify_pending_installs: {
        Row: {
          access_token: string
          claimed_at: string | null
          created_at: string
          id: string
          install_source: string
          shop_domain: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          install_source?: string
          shop_domain: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          install_source?: string
          shop_domain?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_pending_installs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_webhook_events: {
        Row: {
          received_at: string
          shop_domain: string | null
          topic: string | null
          webhook_id: string
        }
        Insert: {
          received_at?: string
          shop_domain?: string | null
          topic?: string | null
          webhook_id: string
        }
        Update: {
          received_at?: string
          shop_domain?: string | null
          topic?: string | null
          webhook_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_provider: string
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          shop_domain: string | null
          shopify_subscription_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_provider?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          shop_domain?: string | null
          shopify_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_provider?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          shop_domain?: string | null
          shopify_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_credentials: {
        Row: {
          access_token: string | null
          account_sid: string | null
          auth_token: string | null
          created_at: string
          id: string
          ig_account_id: string | null
          ig_username: string | null
          install_source: string
          is_active: boolean
          page_id: string | null
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          shop_domain: string | null
          tenant_id: string
          updated_at: string
          verify_token: string | null
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          account_sid?: string | null
          auth_token?: string | null
          created_at?: string
          id?: string
          ig_account_id?: string | null
          ig_username?: string | null
          install_source?: string
          is_active?: boolean
          page_id?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider: string
          shop_domain?: string | null
          tenant_id: string
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          account_sid?: string | null
          auth_token?: string | null
          created_at?: string
          id?: string
          ig_account_id?: string | null
          ig_username?: string | null
          install_source?: string
          is_active?: boolean
          page_id?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          shop_domain?: string | null
          tenant_id?: string
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_member_sessions: {
        Row: {
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          last_seen_at: string
          member_id: string | null
          started_at: string
          tenant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          member_id?: string | null
          started_at?: string
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          member_id?: string | null
          started_at?: string
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_member_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_member_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          last_seen_at: string | null
          role: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          role?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          role?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_wallets: {
        Row: {
          balance_credits: number
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance_credits?: number
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance_credits?: number
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_replies_enabled: boolean
          billing_origin: string
          created_at: string
          id: string
          name: string
          order_confirmation_template_language: string
          order_confirmation_template_name: string | null
          owner_user_id: string
          updated_at: string
          vertical: string
        }
        Insert: {
          ai_replies_enabled?: boolean
          billing_origin?: string
          created_at?: string
          id?: string
          name: string
          order_confirmation_template_language?: string
          order_confirmation_template_name?: string | null
          owner_user_id: string
          updated_at?: string
          vertical?: string
        }
        Update: {
          ai_replies_enabled?: boolean
          billing_origin?: string
          created_at?: string
          id?: string
          name?: string
          order_confirmation_template_language?: string
          order_confirmation_template_name?: string | null
          owner_user_id?: string
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      tour_events: {
        Row: {
          created_at: string
          event: string
          id: string
          step_id: string | null
          step_index: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          step_id?: string | null
          step_index?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          step_id?: string | null
          step_index?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewings: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          created_at: string
          duration_min: number
          followup_at: string | null
          followup_sent_at: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          lead_id: string | null
          listing_id: string | null
          notes: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_min?: number
          followup_at?: string | null
          followup_sent_at?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          lead_id?: string | null
          listing_id?: string | null
          notes?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_min?: number
          followup_at?: string | null
          followup_sent_at?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          lead_id?: string | null
          listing_id?: string | null
          notes?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          balance_after: number
          campaign_id: string | null
          created_at: string
          credits_delta: number
          description: string | null
          id: string
          metadata: Json
          stripe_session_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          balance_after: number
          campaign_id?: string | null
          created_at?: string
          credits_delta: number
          description?: string | null
          id?: string
          metadata?: Json
          stripe_session_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          balance_after?: number
          campaign_id?: string | null
          created_at?: string
          credits_delta?: number
          description?: string | null
          id?: string
          metadata?: Json
          stripe_session_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_leads: {
        Row: {
          assigned_staff_id: string | null
          contact_id: string | null
          created_at: string
          handoff_reason: string | null
          id: string
          interest: string | null
          needs_human: boolean
          notes: string | null
          service_id: string | null
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          contact_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          interest?: string | null
          needs_human?: boolean
          notes?: string | null
          service_id?: string | null
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          contact_id?: string | null
          created_at?: string
          handoff_reason?: string | null
          id?: string
          interest?: string | null
          needs_human?: boolean
          notes?: string | null
          service_id?: string | null
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_leads_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "wellness_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_leads_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "wellness_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_packages: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price: number | null
          service_id: string | null
          service_ids: string[]
          sessions_count: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          price?: number | null
          service_id?: string | null
          service_ids?: string[]
          sessions_count?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price?: number | null
          service_id?: string | null
          service_ids?: string[]
          sessions_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "wellness_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number
          id: string
          image_url: string | null
          name: string
          price: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          image_url?: string | null
          name: string
          price?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          image_url?: string | null
          name?: string
          price?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_sessions: {
        Row: {
          contact_id: string | null
          created_at: string
          duration_min: number
          followup_at: string | null
          followup_sent_at: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          lead_id: string | null
          notes: string | null
          package_id: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          service_id: string | null
          source: string
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          duration_min?: number
          followup_at?: string | null
          followup_sent_at?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          package_id?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          service_id?: string | null
          source?: string
          staff_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          duration_min?: number
          followup_at?: string | null
          followup_sent_at?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          package_id?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          service_id?: string | null
          source?: string
          staff_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "wellness_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_sessions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "wellness_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "wellness_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_sessions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "wellness_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_settings: {
        Row: {
          bot_tone: string
          calendly_url: string | null
          created_at: string
          crm_webhook_url: string | null
          currency: string
          followup_hours_after: number
          google_sheet_url: string | null
          human_transfer_phone: string | null
          languages: string[]
          payment_link: string | null
          reminder_hours_before: number
          second_reminder_hours_before: number
          session_duration_min: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bot_tone?: string
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          followup_hours_after?: number
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          languages?: string[]
          payment_link?: string | null
          reminder_hours_before?: number
          second_reminder_hours_before?: number
          session_duration_min?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bot_tone?: string
          calendly_url?: string | null
          created_at?: string
          crm_webhook_url?: string | null
          currency?: string
          followup_hours_after?: number
          google_sheet_url?: string | null
          human_transfer_phone?: string | null
          languages?: string[]
          payment_link?: string | null
          reminder_hours_before?: number
          second_reminder_hours_before?: number
          session_duration_min?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_staff: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          specialties: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialties?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialties?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_unrouted_events: {
        Row: {
          created_at: string
          display_phone_number: string | null
          from_number: string | null
          id: string
          phone_number_id: string | null
          preview: string | null
        }
        Insert: {
          created_at?: string
          display_phone_number?: string | null
          from_number?: string | null
          id?: string
          phone_number_id?: string | null
          preview?: string | null
        }
        Update: {
          created_at?: string
          display_phone_number?: string | null
          from_number?: string | null
          id?: string
          phone_number_id?: string | null
          preview?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_tenant_vertical: {
        Args: { p_expected: string; p_tenant_id: string }
        Returns: undefined
      }
      claim_campaign_recipients: {
        Args: { p_campaign_id: string; p_limit: number; p_worker: string }
        Returns: {
          attempts: number
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          error: string | null
          error_code: string | null
          failed_at: string | null
          id: string
          last_error_at: string | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string
          phone_number: string
          read_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          whatsapp_message_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "campaign_recipients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_stale_member_sessions: {
        Args: { p_max_minutes?: number }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_assignment_counts: {
        Args: { p_tenant_id: string }
        Returns: {
          assigned_count: number
          member_id: string
        }[]
      }
      get_contact_previews: {
        Args: { p_contact_ids: string[] }
        Returns: {
          contact_id: string
          last_content: string
          last_created_at: string
          unread_count: number
        }[]
      }
      get_member_activity: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          display_name: string
          email: string
          end_reason: string
          ended_at: string
          last_seen_at: string
          member_id: string
          messages_sent: number
          orders_handled: number
          role: string
          session_id: string
          started_at: string
          user_id: string
        }[]
      }
      get_tenant_analytics: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: Json
      }
      get_tenant_subscription: {
        Args: { p_tenant_id: string }
        Returns: {
          billing_provider: string
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          shop_domain: string | null
          shopify_subscription_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_tenant_today_stats: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: Json
      }
      get_tenant_vertical: { Args: { p_tenant_id: string }; Returns: string }
      get_unread_contact_ids: {
        Args: { p_limit?: number; p_tenant_id: string }
        Returns: {
          contact_id: string
          last_created_at: string
          unread_count: number
        }[]
      }
      get_user_tenant_id: { Args: { p_user_id: string }; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: { p_tenant_id: string }; Returns: boolean }
      match_knowledge: {
        Args: {
          match_count?: number
          p_tenant_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      release_stale_campaign_locks: {
        Args: { p_max_minutes?: number }
        Returns: number
      }
      tenant_member_role: { Args: { p_tenant_id: string }; Returns: string }
      tenant_subscription_active: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      wallet_credit: {
        Args: {
          p_campaign_id?: string
          p_credits: number
          p_description?: string
          p_metadata?: Json
          p_stripe_session_id?: string
          p_tenant_id: string
          p_type: string
        }
        Returns: {
          balance_after: number
          campaign_id: string | null
          created_at: string
          credits_delta: number
          description: string | null
          id: string
          metadata: Json
          stripe_session_id: string | null
          tenant_id: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_debit: {
        Args: {
          p_campaign_id?: string
          p_credits: number
          p_description?: string
          p_metadata?: Json
          p_tenant_id: string
          p_type: string
        }
        Returns: {
          balance_after: number
          campaign_id: string | null
          created_at: string
          credits_delta: number
          description: string | null
          id: string
          metadata: Json
          stripe_session_id: string | null
          tenant_id: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
