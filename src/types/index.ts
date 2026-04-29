import { z } from 'zod'
import type {
  UserRole,
  TradeStatus,
  MilestoneStatus,
  DocumentType,
  NotificationType,
} from './database'

export type { UserRole, TradeStatus, MilestoneStatus, DocumentType, NotificationType }

// Re-export Database
export type { Database } from './database'

// App types
export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  invited_at: string | null
  last_login_at: string | null
  created_at: string
}

export interface Entity {
  id: string
  name: string
  country: string
  ruc_ein: string
  address: string
  city: string
  is_active: boolean
  created_at: string
}

export interface BankProfile {
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

export interface Client {
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

export interface Contact {
  id: string
  full_name: string
  phone: string
  email: string
  role: string | null
  is_default: boolean
  created_at: string
}

export interface Trade {
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
  // Joined
  entity?: Entity
  client?: Client
  contact?: Contact
  bank_profile?: BankProfile
}

export interface TradeDocument {
  id: string
  trade_id: string
  document_type: DocumentType
  file_name: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: unknown | null
  new_value: unknown | null
  ip_address: string | null
  created_at: string
  user?: User
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  trade_id: string | null
  created_at: string
}

export interface AppSetting {
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string
}

// PDF Extraction
export interface ExtractedContract {
  quantityTons: number
  productDescription: string
  brand: string
  validity: string
  temperature: string
  packing: string
  plantNo: string
  shipmentsDate: string
  origin: string
  destination: string
  freightCondition: string
  incoterm: string
  requiresInspection: string
  frigoUnitPrice: number
  frigoTotal: number
  obsClause: string
  contractRef: string
  extractedAt: string
  confidence: 'high' | 'medium' | 'low'
  rawText: string
}

// Contract Generation
export interface ContractGenerationData {
  // Entity
  entityId: string
  entityName: string
  entityCountry: string
  entityRucEin: string
  entityAddress: string
  entityCity: string
  // Bank
  bankProfileId: string
  intermediaryBankName: string
  intermediaryBankSwift: string
  bankName: string
  bankSwift: string
  accountNumber: string
  araNumber: string | null
  beneficiaryName: string
  beneficiaryAddress: string
  field71a: string
  // Client
  clientId: string
  clientName: string
  clientAddress: string
  clientCity: string
  clientCountry: string
  // Contact
  contactId: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  // Contract fields
  contractDate: string
  frigoContractRef: string
  quantityTons: number
  productDescription: string
  frigoUnitPrice: number
  frigoTotal: number
  saleUnitPrice: number
  saleTotal: number
  freightCost: number
  insuranceCost: number
  bankFees: number
  prepaymentDate: string
  prepaymentAmount: number
  balanceAmount: number
  observations: string
  // Mirrored fields
  brand: string
  validity: string
  temperature: string
  packing: string
  plantNo: string
  shipmentsDate: string
  origin: string
  destination: string
  freightCondition: string
  incoterm: string
}

// Zod schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['super_admin', 'internal', 'partner'] as const),
})

// Per PRD §5.1: only Company Name, Address, City, Country are required.
// Tax ID, contact details, and notes are optional. We default optionals
// to '' so the inferred type stays string and the DB insert works.
export const clientSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  tax_id: z.string().default(''),
  contact_name: z.string().default(''),
  contact_email: z.union([z.string().email('Invalid email address'), z.literal('')]).default(''),
  contact_phone: z.string().default(''),
  notes: z.string().optional(),
})

export const contactSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email address'),
  role: z.string().optional(),
  is_default: z.boolean().default(false),
})

export const entitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  country: z.string().min(1, 'Country is required'),
  ruc_ein: z.string().min(1, 'RUC/EIN is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  is_active: z.boolean().default(true),
})

export const bankProfileSchema = z.object({
  entity_id: z.string().uuid('Invalid entity'),
  profile_name: z.string().min(1, 'Profile name is required'),
  beneficiary_name: z.string().min(1, 'Beneficiary name is required'),
  beneficiary_address: z.string().min(1, 'Beneficiary address is required'),
  intermediary_bank_name: z.string().min(1, 'Intermediary bank name is required'),
  intermediary_bank_swift: z.string().min(1, 'Intermediary bank SWIFT is required'),
  bank_name: z.string().min(1, 'Bank name is required'),
  bank_swift: z.string().min(1, 'Bank SWIFT is required'),
  account_number: z.string().min(1, 'Account number is required'),
  ara_number: z.string().optional(),
  field_71a: z.string().default('OUR'),
  is_default: z.boolean().default(false),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type InviteUserFormData = z.infer<typeof inviteUserSchema>
export type ClientFormData = z.infer<typeof clientSchema>
export type ContactFormData = z.infer<typeof contactSchema>
export type EntityFormData = z.infer<typeof entitySchema>
export type BankProfileFormData = z.infer<typeof bankProfileSchema>

// Dashboard KPIs
export interface DashboardKPIs {
  activeTrades: number
  totalRevenue: number
  pendingMilestones: number
  overdueAlerts: number
  totalTrades: number
  totalInvestedCapital: number
  totalNetProfit: number
}

// Filter types
export interface TradeFilters {
  status?: TradeStatus
  clientId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}
