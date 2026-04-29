-- ============================================================
-- TradeMirror OS — Complete Test Seed Data
-- Paste into Supabase SQL Editor at:
-- https://app.supabase.com/project/xpupsaqsozpatsyeszox/sql/new
-- ============================================================

-- ---- 1. Activate both entities ----
UPDATE entities SET is_active = true
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- ---- 2. Banking Profiles (fixed UUIDs so trades can reference them) ----
DELETE FROM bank_profiles WHERE entity_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

INSERT INTO bank_profiles (
  id, entity_id, profile_name, beneficiary_name, beneficiary_address,
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
  );

-- ---- 3. Contacts (fixed UUIDs) ----
DELETE FROM contacts;

INSERT INTO contacts (id, full_name, phone, email, role, is_default) VALUES
  ('eeeeeeee-0001-0000-0000-000000000001', 'Ali Kanso',       '+20 1017299515',   'ali@chipafarm.com',    'Sales Manager', true),
  ('eeeeeeee-0002-0000-0000-000000000002', 'Rabih Chipatech', '+1 307 555 0101',  'rabih@chipatech.com',  'Director',      false),
  ('eeeeeeee-0003-0000-0000-000000000003', 'Sara Molina',     '+595 21 555 0202', 'sara@chipatech.com',   'Operations',    false);

-- ---- 4. Clients ----
INSERT INTO clients (
  id, company_name, address, city, country, tax_id,
  contact_name, contact_email, contact_phone, notes
) VALUES
  (
    'aaaaaaaa-0001-0000-0000-000000000001',
    'Al Barakat Trading Co.', '45 Sheikh Zayed Road', 'Dubai', 'UAE',
    'TRN-100234567', 'Mohammed Al Rashid',
    'm.rashid@albarakat.ae', '+971 4 321 5678',
    'Preferred client — net-30 payment terms'
  ),
  (
    'aaaaaaaa-0002-0000-0000-000000000002',
    'Nile Valley Meats Ltd.', '12 Corniche El Nil', 'Cairo', 'Egypt',
    'EG-99012345', 'Ahmed Hassan',
    'a.hassan@nilevalley.eg', '+20 2 2570 1234',
    'Large volume buyer — monthly contracts'
  ),
  (
    'aaaaaaaa-0003-0000-0000-000000000003',
    'Eurasian Food Group', 'Tverskaya St. 15', 'Moscow', 'Russia',
    'RU-7701234567', 'Dmitri Volkov',
    'd.volkov@eurasianfood.ru', '+7 495 123 4567',
    NULL
  ),
  (
    'aaaaaaaa-0004-0000-0000-000000000004',
    'Gulf Prime Foods LLC', 'King Fahad District', 'Riyadh', 'Saudi Arabia',
    'SA-300123456', 'Khalid Al Saud',
    'k.alsaud@gulfprime.sa', '+966 11 456 7890',
    'Requires Halal certification on all shipments'
  ),
  (
    'aaaaaaaa-0005-0000-0000-000000000005',
    'Meridian Proteins S.A.', 'Av. Corrientes 1234', 'Buenos Aires', 'Argentina',
    'AR-30-12345678-9', 'Carlos Mendez',
    'c.mendez@meridianproteins.ar', '+54 11 4321 5678',
    'South American regional distributor'
  ),
  (
    'aaaaaaaa-0006-0000-0000-000000000006',
    'East Asia Imports Co.', '88 Nathan Road', 'Hong Kong', 'China',
    'HK-12345678', 'David Chen',
    'd.chen@eastasiaimports.hk', '+852 2345 6789',
    'Quarterly bulk orders'
  )
ON CONFLICT (id) DO NOTHING;

-- ---- 5. Trades (8 records covering every status) ----
INSERT INTO trades (
  id, trade_reference,
  entity_id, bank_profile_id, client_id, contact_id,
  contract_date, signing_date, bol_date,
  frigo_contract_ref, quantity_tons, product_description,
  frigo_unit_price, frigo_total,
  sale_unit_price, sale_total,
  shipping_cost, insurance_cost, bank_fees,
  total_costs, net_profit,
  advance_status, advance_received_at,
  balance_status, balance_received_at,
  trade_status
) VALUES

  -- CF-2026-001  status=balance_received (fully completed)
  (
    'cccccccc-0001-0000-0000-000000000001', 'CF-2026-001',
    '11111111-1111-1111-1111-111111111111',
    'dddddddd-0001-0000-0000-000000000001',
    'aaaaaaaa-0001-0000-0000-000000000001',
    'eeeeeeee-0001-0000-0000-000000000001',
    '2026-01-10', '2026-01-12', '2026-02-01',
    '698-2025 CHIPA', 25.000,
    'FROZEN BONELESS BEEF - MANUFACTURING QUALITY 85/15 CL',
    3800.000, 95000.00, 4180.000, 104500.00,
    2500.00, 500.00, 800.00, 98800.00, 5700.00,
    'received', '2026-01-18 10:00:00+00',
    'received', '2026-02-08 14:00:00+00',
    'balance_received'
  ),

  -- CF-2026-002  status=shipped (advance received, BOL issued, balance pending)
  (
    'cccccccc-0002-0000-0000-000000000002', 'CF-2026-002',
    '11111111-1111-1111-1111-111111111111',
    'dddddddd-0001-0000-0000-000000000001',
    'aaaaaaaa-0002-0000-0000-000000000002',
    'eeeeeeee-0001-0000-0000-000000000001',
    '2026-02-03', '2026-02-05', '2026-02-28',
    '701-2026 CHIPA', 30.000,
    'FROZEN BONELESS BEEF - MANUFACTURING QUALITY 90/10 CL',
    4000.000, 120000.00, 4400.000, 132000.00,
    3000.00, 600.00, 1000.00, 124600.00, 7400.00,
    'received', '2026-02-10 09:00:00+00',
    'pending', NULL,
    'shipped'
  ),

  -- CF-2026-003  status=advance_received (advance paid, no BOL yet)
  (
    'cccccccc-0003-0000-0000-000000000003', 'CF-2026-003',
    '11111111-1111-1111-1111-111111111111',
    'dddddddd-0001-0000-0000-000000000001',
    'aaaaaaaa-0004-0000-0000-000000000004',
    'eeeeeeee-0001-0000-0000-000000000001',
    '2026-03-01', '2026-03-03', NULL,
    '703-2026 CHIPA', 20.000,
    'FROZEN BEEF TRIMMINGS 80/20',
    3500.000, 70000.00, 3850.000, 77000.00,
    2000.00, 400.00, 700.00, 73100.00, 3900.00,
    'received', '2026-03-10 11:00:00+00',
    'pending', NULL,
    'advance_received'
  ),

  -- CF-2026-004  status=active (signed, waiting for advance) — via LLC entity
  (
    'cccccccc-0004-0000-0000-000000000004', 'CF-2026-004',
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-0002-0000-0000-000000000002',
    'aaaaaaaa-0003-0000-0000-000000000003',
    'eeeeeeee-0002-0000-0000-000000000002',
    '2026-03-15', '2026-03-17', NULL,
    '705-2026 CHIPA', 40.000,
    'FROZEN BONELESS BEEF - MANUFACTURING QUALITY 85/15 CL',
    3900.000, 156000.00, 4290.000, 171600.00,
    4500.00, 900.00, 1200.00, 162600.00, 9000.00,
    'pending', NULL,
    'pending', NULL,
    'active'
  ),

  -- CF-2026-005  status=overdue (advance never arrived — 65 days overdue)
  (
    'cccccccc-0005-0000-0000-000000000005', 'CF-2026-005',
    '11111111-1111-1111-1111-111111111111',
    'dddddddd-0001-0000-0000-000000000001',
    'aaaaaaaa-0005-0000-0000-000000000005',
    'eeeeeeee-0001-0000-0000-000000000001',
    '2026-02-05', '2026-02-07', NULL,
    '702-2026 CHIPA', 35.000,
    'FROZEN BEEF CHUCK 85/15',
    3700.000, 129500.00, 4070.000, 142450.00,
    3500.00, 700.00, 950.00, 134650.00, 7800.00,
    'overdue', NULL,
    'pending', NULL,
    'overdue'
  ),

  -- CF-2026-006  status=draft (just created, no signing yet)
  (
    'cccccccc-0006-0000-0000-000000000006', 'CF-2026-006',
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-0002-0000-0000-000000000002',
    'aaaaaaaa-0006-0000-0000-000000000006',
    'eeeeeeee-0003-0000-0000-000000000003',
    '2026-04-20', NULL, NULL,
    '708-2026 CHIPA', 50.000,
    'FROZEN BONELESS BEEF - MANUFACTURING QUALITY 90/10 CL',
    4100.000, 205000.00, 4510.000, 225500.00,
    5000.00, 1000.00, 1500.00, 212500.00, 13000.00,
    'pending', NULL,
    'pending', NULL,
    'draft'
  ),

  -- CF-2026-007  status=balance_received — via LLC entity (second completed trade)
  (
    'cccccccc-0007-0000-0000-000000000007', 'CF-2026-007',
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-0002-0000-0000-000000000002',
    'aaaaaaaa-0001-0000-0000-000000000001',
    'eeeeeeee-0002-0000-0000-000000000002',
    '2026-01-05', '2026-01-07', '2026-01-25',
    '695-2025 CHIPA', 22.500,
    'FROZEN BEEF TRIMMINGS 80/20',
    3600.000, 81000.00, 3960.000, 89100.00,
    2200.00, 450.00, 750.00, 84400.00, 4700.00,
    'received', '2026-01-14 08:00:00+00',
    'received', '2026-02-02 16:00:00+00',
    'balance_received'
  ),

  -- CF-2026-008  status=active (signed today, advance pending)
  (
    'cccccccc-0008-0000-0000-000000000008', 'CF-2026-008',
    '11111111-1111-1111-1111-111111111111',
    'dddddddd-0001-0000-0000-000000000001',
    'aaaaaaaa-0004-0000-0000-000000000004',
    'eeeeeeee-0001-0000-0000-000000000001',
    '2026-04-25', '2026-04-26', NULL,
    '709-2026 CHIPA', 28.000,
    'FROZEN BONELESS BEEF - MANUFACTURING QUALITY 85/15 CL',
    3850.000, 107800.00, 4235.000, 118580.00,
    2800.00, 560.00, 900.00, 112060.00, 6520.00,
    'pending', NULL,
    'pending', NULL,
    'active'
  )

ON CONFLICT (id) DO NOTHING;

-- ---- 6. Documents ----
INSERT INTO documents (
  id, trade_id, document_type, file_name, storage_path, uploaded_at
) VALUES
  -- CF-2026-001 full set
  ('ffffffff-0001-0000-0000-000000000001', 'cccccccc-0001-0000-0000-000000000001', 'frigo_contract',  '698-2025 CHIPA - Frigo Contract.pdf',   'contracts/CF-2026-001/frigo_contract.pdf',  '2026-01-10 12:00:00+00'),
  ('ffffffff-0002-0000-0000-000000000002', 'cccccccc-0001-0000-0000-000000000001', 'sales_contract',  'CF-2026-001 Sales Contract.pdf',         'contracts/CF-2026-001/sales_contract.pdf',  '2026-01-12 14:00:00+00'),
  ('ffffffff-0003-0000-0000-000000000003', 'cccccccc-0001-0000-0000-000000000001', 'signed_contract', 'CF-2026-001 Signed Contract.pdf',        'contracts/CF-2026-001/signed_contract.pdf', '2026-01-14 09:00:00+00'),
  ('ffffffff-0004-0000-0000-000000000004', 'cccccccc-0001-0000-0000-000000000001', 'bol',             'CF-2026-001 Bill of Lading.pdf',         'contracts/CF-2026-001/bol.pdf',             '2026-02-01 11:00:00+00'),
  -- CF-2026-002 partial set
  ('ffffffff-0005-0000-0000-000000000005', 'cccccccc-0002-0000-0000-000000000002', 'frigo_contract',  '701-2026 CHIPA - Frigo Contract.pdf',   'contracts/CF-2026-002/frigo_contract.pdf',  '2026-02-03 10:00:00+00'),
  ('ffffffff-0006-0000-0000-000000000006', 'cccccccc-0002-0000-0000-000000000002', 'sales_contract',  'CF-2026-002 Sales Contract.pdf',         'contracts/CF-2026-002/sales_contract.pdf',  '2026-02-05 15:00:00+00'),
  ('ffffffff-0007-0000-0000-000000000007', 'cccccccc-0002-0000-0000-000000000002', 'bol',             'CF-2026-002 Bill of Lading.pdf',         'contracts/CF-2026-002/bol.pdf',             '2026-02-28 12:00:00+00'),
  -- CF-2026-007 partial set
  ('ffffffff-0008-0000-0000-000000000008', 'cccccccc-0007-0000-0000-000000000007', 'frigo_contract',  '695-2025 CHIPA - Frigo Contract.pdf',   'contracts/CF-2026-007/frigo_contract.pdf',  '2026-01-05 09:00:00+00'),
  ('ffffffff-0009-0000-0000-000000000009', 'cccccccc-0007-0000-0000-000000000007', 'sales_contract',  'CF-2026-007 Sales Contract.pdf',         'contracts/CF-2026-007/sales_contract.pdf',  '2026-01-07 11:00:00+00'),
  ('ffffffff-000a-0000-0000-000000000010', 'cccccccc-0007-0000-0000-000000000007', 'bol',             'CF-2026-007 Bill of Lading.pdf',         'contracts/CF-2026-007/bol.pdf',             '2026-01-25 14:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---- 7. Audit Logs ----
INSERT INTO audit_logs (id, action, entity_type, entity_id, new_value, created_at) VALUES
  ('99999999-0001-0000-0000-000000000001', 'trade_created',      'trade', 'cccccccc-0001-0000-0000-000000000001', '{"trade_reference":"CF-2026-001","client":"Al Barakat Trading Co."}',        '2026-01-10 12:00:00+00'),
  ('99999999-0002-0000-0000-000000000002', 'document_uploaded',  'trade', 'cccccccc-0001-0000-0000-000000000001', '{"document_type":"frigo_contract","file":"698-2025 CHIPA - Frigo Contract.pdf"}', '2026-01-10 12:05:00+00'),
  ('99999999-0003-0000-0000-000000000003', 'document_uploaded',  'trade', 'cccccccc-0001-0000-0000-000000000001', '{"document_type":"sales_contract","file":"CF-2026-001 Sales Contract.pdf"}', '2026-01-12 14:00:00+00'),
  ('99999999-0004-0000-0000-000000000004', 'milestone_received', 'trade', 'cccccccc-0001-0000-0000-000000000001', '{"milestone":"advance","amount":52250.00}',                                   '2026-01-18 10:00:00+00'),
  ('99999999-0005-0000-0000-000000000005', 'status_changed',     'trade', 'cccccccc-0001-0000-0000-000000000001', '{"old_status":"advance_received","new_status":"shipped"}',                    '2026-02-01 11:00:00+00'),
  ('99999999-0006-0000-0000-000000000006', 'milestone_received', 'trade', 'cccccccc-0001-0000-0000-000000000001', '{"milestone":"balance","amount":52250.00}',                                   '2026-02-08 14:00:00+00'),
  ('99999999-0007-0000-0000-000000000007', 'trade_created',      'trade', 'cccccccc-0002-0000-0000-000000000002', '{"trade_reference":"CF-2026-002","client":"Nile Valley Meats Ltd."}',         '2026-02-03 10:00:00+00'),
  ('99999999-0008-0000-0000-000000000008', 'milestone_received', 'trade', 'cccccccc-0002-0000-0000-000000000002', '{"milestone":"advance","amount":66000.00}',                                   '2026-02-10 09:00:00+00'),
  ('99999999-0009-0000-0000-000000000009', 'trade_created',      'trade', 'cccccccc-0003-0000-0000-000000000003', '{"trade_reference":"CF-2026-003","client":"Gulf Prime Foods LLC"}',           '2026-03-01 10:00:00+00'),
  ('99999999-000a-0000-0000-000000000010', 'milestone_overdue',  'trade', 'cccccccc-0005-0000-0000-000000000005', '{"milestone":"advance","days_overdue":65,"amount":71225.00}',                 '2026-04-15 08:00:00+00'),
  ('99999999-000b-0000-0000-000000000011', 'trade_created',      'trade', 'cccccccc-0007-0000-0000-000000000007', '{"trade_reference":"CF-2026-007","client":"Al Barakat Trading Co."}',         '2026-01-05 09:00:00+00'),
  ('99999999-000c-0000-0000-000000000012', 'milestone_received', 'trade', 'cccccccc-0007-0000-0000-000000000007', '{"milestone":"advance","amount":44550.00}',                                   '2026-01-14 08:00:00+00'),
  ('99999999-000d-0000-0000-000000000013', 'milestone_received', 'trade', 'cccccccc-0007-0000-0000-000000000007', '{"milestone":"balance","amount":44550.00}',                                   '2026-02-02 16:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ---- 8. App Settings ----
INSERT INTO app_settings (key, value) VALUES
  ('active_entity_id', '"11111111-1111-1111-1111-111111111111"'),
  ('default_markup_pct', '10'),
  ('advance_pct', '50'),
  ('app_name', '"TradeMirror OS"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---- Verification Query ----
SELECT table_name, row_count FROM (
  SELECT 'entities'     AS table_name, count(*)::int AS row_count FROM entities
  UNION ALL
  SELECT 'bank_profiles',              count(*)::int FROM bank_profiles
  UNION ALL
  SELECT 'clients',                    count(*)::int FROM clients
  UNION ALL
  SELECT 'contacts',                   count(*)::int FROM contacts
  UNION ALL
  SELECT 'trades',                     count(*)::int FROM trades
  UNION ALL
  SELECT 'documents',                  count(*)::int FROM documents
  UNION ALL
  SELECT 'audit_logs',                 count(*)::int FROM audit_logs
  UNION ALL
  SELECT 'app_settings',               count(*)::int FROM app_settings
) t ORDER BY table_name;
