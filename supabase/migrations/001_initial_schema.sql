-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('super_admin', 'internal', 'partner');
CREATE TYPE trade_status AS ENUM ('draft', 'active', 'advance_received', 'shipped', 'balance_received', 'overdue');
CREATE TYPE milestone_status AS ENUM ('pending', 'received', 'overdue');
CREATE TYPE document_type AS ENUM ('frigo_contract', 'sales_contract', 'signed_contract', 'bol', 'other');
CREATE TYPE notification_type AS ENUM ('milestone_overdue', 'payment_received', 'document_uploaded', 'trade_created');

-- Users table (mirrors Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'internal',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entities table
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  ruc_ein TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank profiles table
CREATE TABLE IF NOT EXISTS bank_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  beneficiary_address TEXT NOT NULL DEFAULT '',
  intermediary_bank_name TEXT NOT NULL DEFAULT '',
  intermediary_bank_swift TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL,
  bank_swift TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ara_number TEXT,
  field_71a TEXT NOT NULL DEFAULT 'OUR',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts table (internal)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_reference TEXT UNIQUE NOT NULL,
  entity_id UUID NOT NULL REFERENCES entities(id),
  bank_profile_id UUID NOT NULL REFERENCES bank_profiles(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  contract_date DATE NOT NULL,
  signing_date DATE,
  bol_date DATE,
  frigo_contract_ref TEXT NOT NULL DEFAULT '',
  quantity_tons DECIMAL(10,3) NOT NULL DEFAULT 0,
  product_description TEXT NOT NULL DEFAULT '',
  frigo_unit_price DECIMAL(12,3) NOT NULL DEFAULT 0,
  frigo_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_unit_price DECIMAL(12,3) NOT NULL DEFAULT 0,
  sale_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  insurance_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  bank_fees DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_costs DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_status milestone_status NOT NULL DEFAULT 'pending',
  advance_received_at TIMESTAMPTZ,
  balance_status milestone_status NOT NULL DEFAULT 'pending',
  balance_received_at TIMESTAMPTZ,
  trade_status trade_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(trade_status);
CREATE INDEX IF NOT EXISTS idx_trades_client ON trades(client_id);
CREATE INDEX IF NOT EXISTS idx_trades_entity ON trades(entity_id);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_trade ON documents(trade_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS helper function: get role of current user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- RLS: Users table
CREATE POLICY "Users can read their own record" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "SuperAdmin can manage all users" ON users
  FOR ALL USING (get_user_role() = 'super_admin');

-- RLS: Entities — authenticated users can read, only super_admin writes
CREATE POLICY "Authenticated can read entities" ON entities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin can manage entities" ON entities
  FOR ALL USING (get_user_role() = 'super_admin');

-- RLS: Bank profiles
CREATE POLICY "Authenticated can read bank_profiles" ON bank_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin can manage bank_profiles" ON bank_profiles
  FOR ALL USING (get_user_role() = 'super_admin');

-- RLS: Clients
CREATE POLICY "Authenticated can read clients" ON clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin can manage clients" ON clients
  FOR ALL USING (get_user_role() = 'super_admin');

-- RLS: Contacts
CREATE POLICY "Authenticated can read contacts" ON contacts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin can manage contacts" ON contacts
  FOR ALL USING (get_user_role() = 'super_admin');

-- RLS: Trades — all authenticated can read
CREATE POLICY "Authenticated can read trades" ON trades
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin can manage trades" ON trades
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Internal can update trade status" ON trades
  FOR UPDATE USING (get_user_role() IN ('super_admin', 'internal'));

-- RLS: Documents
CREATE POLICY "Authenticated can read documents" ON documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin and Internal can upload documents" ON documents
  FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'internal'));

CREATE POLICY "SuperAdmin can delete documents" ON documents
  FOR DELETE USING (get_user_role() = 'super_admin');

-- RLS: Audit logs — super_admin reads all, everyone can insert
CREATE POLICY "SuperAdmin can read audit logs" ON audit_logs
  FOR SELECT USING (get_user_role() = 'super_admin');

CREATE POLICY "Authenticated can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: Notifications
CREATE POLICY "Users can read their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Service role can manage notifications" ON notifications
  FOR ALL USING (true);

-- RLS: App settings
CREATE POLICY "Authenticated can read settings" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SuperAdmin can manage settings" ON app_settings
  FOR ALL USING (get_user_role() = 'super_admin');

-- Seed: Entity profiles
INSERT INTO entities (id, name, country, ruc_ein, address, city, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Chipa Tech E.A.S.', 'Paraguay', '80023325-5', 'Calle Dr. Eusebio Lilio y Bernardino Caballero #2880', 'Asuncion', true),
  ('22222222-2222-2222-2222-222222222222', 'Chipa Farm LLC', 'USA', 'EIN-TBD', '30 N Gould St Ste R', 'Sheridan, WY 82801', false)
ON CONFLICT (id) DO NOTHING;

-- Seed: Banking profiles
INSERT INTO bank_profiles (entity_id, profile_name, beneficiary_name, beneficiary_address, intermediary_bank_name, intermediary_bank_swift, bank_name, bank_swift, account_number, ara_number, field_71a, is_default) VALUES
  ('11111111-1111-1111-1111-111111111111', 'EAS — Banco Nacional de Fomento', 'FRIGORIFICO CONCEPCION S.A', 'SANTA TERESA Y AVIADORES DELCHACO', 'CITIBANK NA NEW YORK USA', 'CITIUS33', 'BANCO NACIONAL DE FOMENTO', 'BNFAPYPAXXX', '000000014514', NULL, 'OUR', true)
ON CONFLICT DO NOTHING;

-- Seed: Default contact
INSERT INTO contacts (full_name, phone, email, role, is_default) VALUES
  ('Ali Kanso', '+20 1017299515', 'ali@chipafarm.com', 'Sales Manager', true)
ON CONFLICT DO NOTHING;

-- App settings
INSERT INTO app_settings (key, value) VALUES
  ('active_entity_id', '"11111111-1111-1111-1111-111111111111"')
ON CONFLICT (key) DO NOTHING;
