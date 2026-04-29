-- ============================================================
-- TradeMirror OS — Fix / Seed Core Reference Data
-- Fully idempotent — safe to run multiple times.
-- Uses UPSERT throughout; never deletes referenced rows.
-- Paste into Supabase → SQL Editor and click Run.
-- ============================================================

-- 1. Entities (upsert — update name/status if already exists)
INSERT INTO entities (id, name, country, ruc_ein, address, city, is_active) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Chipa Tech E.A.S.', 'Paraguay', '80023325-5',
    'Calle Dr. Eusebio Lilio y Bernardino Caballero #2880', 'Asuncion', true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Chipa Farm LLC', 'USA', 'EIN-TBD',
    '30 N Gould St Ste R', 'Sheridan, WY 82801', true
  )
ON CONFLICT (id) DO UPDATE
  SET name      = EXCLUDED.name,
      is_active = true;

-- 2. Bank profiles (upsert — never delete, trades may already reference them)
INSERT INTO bank_profiles (
  id, entity_id, profile_name,
  beneficiary_name, beneficiary_address,
  intermediary_bank_name, intermediary_bank_swift,
  bank_name, bank_swift, account_number,
  ara_number, field_71a, is_default
) VALUES
  (
    'dddddddd-0001-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'EAS — Banco Nacional de Fomento',
    'FRIGORIFICO CONCEPCION S.A',
    'SANTA TERESA Y AVIADORES DELCHACO, ASUNCION, PARAGUAY',
    'CITIBANK NA NEW YORK USA', 'CITIUS33',
    'BANCO NACIONAL DE FOMENTO', 'BNFAPYPAXXX', '000000014514',
    NULL, 'OUR', true
  ),
  (
    'dddddddd-0002-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'LLC — JPMorgan Chase Wyoming',
    'CHIPA FARM LLC',
    '30 N GOULD ST STE R, SHERIDAN WY 82801, USA',
    'JPMORGAN CHASE BANK NA NEW YORK USA', 'CHASUS33',
    'JPMORGAN CHASE BANK NA', 'CHASUS33', '987654321',
    NULL, 'OUR', true
  )
ON CONFLICT (id) DO UPDATE
  SET profile_name            = EXCLUDED.profile_name,
      beneficiary_name        = EXCLUDED.beneficiary_name,
      beneficiary_address     = EXCLUDED.beneficiary_address,
      intermediary_bank_name  = EXCLUDED.intermediary_bank_name,
      intermediary_bank_swift = EXCLUDED.intermediary_bank_swift,
      bank_name               = EXCLUDED.bank_name,
      bank_swift              = EXCLUDED.bank_swift,
      account_number          = EXCLUDED.account_number,
      is_default              = true;

-- 3. Contacts (upsert — trades reference contacts via contact_id FK)
INSERT INTO contacts (id, full_name, phone, email, role, is_default) VALUES
  ('eeeeeeee-0001-0000-0000-000000000001', 'Ali Kanso',       '+20 1017299515',   'ali@chipafarm.com',   'Sales Manager', true),
  ('eeeeeeee-0002-0000-0000-000000000002', 'Rabih Chipatech', '+1 307 555 0101',  'rabih@chipatech.com', 'Director',      false),
  ('eeeeeeee-0003-0000-0000-000000000003', 'Sara Molina',     '+595 21 555 0202', 'sara@chipatech.com',  'Operations',    false)
ON CONFLICT (id) DO UPDATE
  SET full_name  = EXCLUDED.full_name,
      phone      = EXCLUDED.phone,
      email      = EXCLUDED.email,
      role       = EXCLUDED.role,
      is_default = EXCLUDED.is_default;

-- 4. Clients (upsert)
INSERT INTO clients (
  id, company_name, address, city, country, tax_id,
  contact_name, contact_email, contact_phone, notes
) VALUES
  (
    'aaaaaaaa-0001-0000-0000-000000000001',
    'Al Barakat Trading Co.', '45 Sheikh Zayed Road', 'Dubai', 'UAE',
    'TRN-100234567', 'Mohammed Al Rashid', 'm.rashid@albarakat.ae', '+971 4 321 5678',
    'Preferred client — net-30 payment terms'
  ),
  (
    'aaaaaaaa-0002-0000-0000-000000000002',
    'Nile Valley Meats Ltd.', '12 Corniche El Nil', 'Cairo', 'Egypt',
    'EG-99012345', 'Ahmed Hassan', 'a.hassan@nilevalley.eg', '+20 2 2570 1234',
    'Large volume buyer — monthly contracts'
  ),
  (
    'aaaaaaaa-0003-0000-0000-000000000003',
    'Eurasian Food Group', 'Tverskaya St. 15', 'Moscow', 'Russia',
    'RU-7701234567', 'Dmitri Volkov', 'd.volkov@eurasianfood.ru', '+7 495 123 4567',
    NULL
  ),
  (
    'aaaaaaaa-0004-0000-0000-000000000004',
    'Gulf Prime Foods LLC', 'King Fahad District', 'Riyadh', 'Saudi Arabia',
    'SA-300123456', 'Khalid Al Saud', 'k.alsaud@gulfprime.sa', '+966 11 456 7890',
    'Requires Halal certification on all shipments'
  ),
  (
    'aaaaaaaa-0005-0000-0000-000000000005',
    'Meridian Proteins S.A.', 'Av. Corrientes 1234', 'Buenos Aires', 'Argentina',
    'AR-30-12345678-9', 'Carlos Mendez', 'c.mendez@meridianproteins.ar', '+54 11 4321 5678',
    'South American regional distributor'
  ),
  (
    'aaaaaaaa-0006-0000-0000-000000000006',
    'East Asia Imports Co.', '88 Nathan Road', 'Hong Kong', 'China',
    'HK-12345678', 'David Chen', 'd.chen@eastasiaimports.hk', '+852 2345 6789',
    'Quarterly bulk orders'
  )
ON CONFLICT (id) DO UPDATE
  SET company_name  = EXCLUDED.company_name,
      country       = EXCLUDED.country;

-- 5. App settings
INSERT INTO app_settings (key, value) VALUES
  ('active_entity_id', '"11111111-1111-1111-1111-111111111111"'),
  ('default_markup_pct', '10'),
  ('advance_pct', '50'),
  ('app_name', '"TradeMirror OS"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── Verification ─────────────────────────────────────────────────────────
SELECT table_name, row_count,
  CASE
    WHEN table_name = 'entities'      AND row_count >= 2 THEN 'OK'
    WHEN table_name = 'bank_profiles' AND row_count >= 2 THEN 'OK'
    WHEN table_name = 'contacts'      AND row_count >= 3 THEN 'OK'
    WHEN table_name = 'clients'       AND row_count >= 6 THEN 'OK'
    ELSE 'CHECK'
  END AS status
FROM (
  SELECT 'entities'      AS table_name, count(*)::int AS row_count FROM entities
  UNION ALL
  SELECT 'bank_profiles',               count(*)::int FROM bank_profiles
  UNION ALL
  SELECT 'contacts',                    count(*)::int FROM contacts
  UNION ALL
  SELECT 'clients',                     count(*)::int FROM clients
  UNION ALL
  SELECT 'app_settings',                count(*)::int FROM app_settings
) t
ORDER BY table_name;
