-- Single RPC that returns all Contract Wizard dropdown data in one round trip.
-- Reduces 3–4 separate REST queries (each ~300ms+ on free tier) to 1.

CREATE OR REPLACE FUNCTION get_wizard_setup_data()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'entities',      (SELECT COALESCE(json_agg(e ORDER BY e.name), '[]'::json)
                      FROM entities e),
    'bank_profiles', (SELECT COALESCE(json_agg(b ORDER BY b.is_default DESC, b.profile_name), '[]'::json)
                      FROM bank_profiles b),
    'clients',       (SELECT COALESCE(json_agg(c ORDER BY c.company_name), '[]'::json)
                      FROM clients c),
    'contacts',      (SELECT COALESCE(json_agg(co ORDER BY co.is_default DESC, co.full_name), '[]'::json)
                      FROM contacts co)
  );
$$;

GRANT EXECUTE ON FUNCTION get_wizard_setup_data() TO authenticated;

-- Quick test — should return counts > 0 for all keys
SELECT
  json_array_length((get_wizard_setup_data()->'entities'))      AS entities,
  json_array_length((get_wizard_setup_data()->'bank_profiles')) AS bank_profiles,
  json_array_length((get_wizard_setup_data()->'clients'))       AS clients,
  json_array_length((get_wizard_setup_data()->'contacts'))      AS contacts;
