export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'super_admin' | 'internal' | 'partner'
export type TradeStatus = 'draft' | 'active' | 'advance_received' | 'shipped' | 'balance_received' | 'overdue'
export type MilestoneStatus = 'pending' | 'received' | 'overdue'
export type DocumentType = 'frigo_contract' | 'sales_contract' | 'signed_contract' | 'bol' | 'other'
export type NotificationType = 'milestone_overdue' | 'payment_received' | 'document_uploaded' | 'trade_created'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          is_active: boolean
          invited_at: string | null
          last_login_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: UserRole
          is_active?: boolean
          invited_at?: string | null
          last_login_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: UserRole
          is_active?: boolean
          invited_at?: string | null
          last_login_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          id: string
          name: string
          country: string
          ruc_ein: string
          address: string
          city: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          country: string
          ruc_ein: string
          address: string
          city: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          country?: string
          ruc_ein?: string
          address?: string
          city?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      bank_profiles: {
        Row: {
          id: string
          entity_id: string
          profile_name: string
          beneficiary_name: string
          beneficiary_address: string
          intermediary_bank_name: string
          intermediary_bank_swift: string
          bank_name: string
          bank_swift: string
          account_number: string
          ara_number: string | null
          field_71a: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          entity_id: string
          profile_name: string
          beneficiary_name: string
          beneficiary_address: string
          intermediary_bank_name: string
          intermediary_bank_swift: string
          bank_name: string
          bank_swift: string
          account_number: string
          ara_number?: string | null
          field_71a?: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          entity_id?: string
          profile_name?: string
          beneficiary_name?: string
          beneficiary_address?: string
          intermediary_bank_name?: string
          intermediary_bank_swift?: string
          bank_name?: string
          bank_swift?: string
          account_number?: string
          ara_number?: string | null
          field_71a?: string
          is_default?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_profiles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          company_name: string
          address: string
          city: string
          country: string
          tax_id: string
          contact_name: string
          contact_email: string
          contact_phone: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_name: string
          address: string
          city: string
          country: string
          tax_id: string
          contact_name: string
          contact_email: string
          contact_phone: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          address?: string
          city?: string
          country?: string
          tax_id?: string
          contact_name?: string
          contact_email?: string
          contact_phone?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          full_name: string
          phone: string
          email: string
          role: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone: string
          email: string
          role?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string
          email?: string
          role?: string | null
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          id: string
          trade_reference: string
          entity_id: string
          bank_profile_id: string
          client_id: string
          contact_id: string
          contract_date: string
          signing_date: string | null
          bol_date: string | null
          frigo_contract_ref: string
          quantity_tons: number
          product_description: string
          frigo_unit_price: number
          frigo_total: number
          sale_unit_price: number
          sale_total: number
          shipping_cost: number
          insurance_cost: number
          bank_fees: number
          total_costs: number
          net_profit: number
          advance_status: MilestoneStatus
          advance_received_at: string | null
          balance_status: MilestoneStatus
          balance_received_at: string | null
          trade_status: TradeStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trade_reference?: string
          entity_id: string
          bank_profile_id: string
          client_id: string
          contact_id: string
          contract_date: string
          signing_date?: string | null
          bol_date?: string | null
          frigo_contract_ref: string
          quantity_tons: number
          product_description: string
          frigo_unit_price: number
          frigo_total: number
          sale_unit_price: number
          sale_total: number
          shipping_cost?: number
          insurance_cost?: number
          bank_fees?: number
          total_costs?: number
          net_profit?: number
          advance_status?: MilestoneStatus
          advance_received_at?: string | null
          balance_status?: MilestoneStatus
          balance_received_at?: string | null
          trade_status?: TradeStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trade_reference?: string
          entity_id?: string
          bank_profile_id?: string
          client_id?: string
          contact_id?: string
          contract_date?: string
          signing_date?: string | null
          bol_date?: string | null
          frigo_contract_ref?: string
          quantity_tons?: number
          product_description?: string
          frigo_unit_price?: number
          frigo_total?: number
          sale_unit_price?: number
          sale_total?: number
          shipping_cost?: number
          insurance_cost?: number
          bank_fees?: number
          total_costs?: number
          net_profit?: number
          advance_status?: MilestoneStatus
          advance_received_at?: string | null
          balance_status?: MilestoneStatus
          balance_received_at?: string | null
          trade_status?: TradeStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_bank_profile_id_fkey"
            columns: ["bank_profile_id"]
            isOneToOne: false
            referencedRelation: "bank_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      documents: {
        Row: {
          id: string
          trade_id: string
          document_type: DocumentType
          file_name: string
          storage_path: string
          uploaded_by: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          trade_id: string
          document_type: DocumentType
          file_name: string
          storage_path: string
          uploaded_by: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          trade_id?: string
          document_type?: DocumentType
          file_name?: string
          storage_path?: string
          uploaded_by?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          body: string
          read: boolean
          trade_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          body: string
          read?: boolean
          trade_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          title?: string
          body?: string
          read?: boolean
          trade_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_by?: string | null
          updated_at?: string
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
      user_role: UserRole
      trade_status: TradeStatus
      milestone_status: MilestoneStatus
      document_type: DocumentType
      notification_type: NotificationType
    }
  }
}
