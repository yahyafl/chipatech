# Role-Test Predictions — Internal Team & Partner

Code-path analysis prediction of what UI/Logic tests would surface for the
two non-super_admin roles, derived from reading every route, guard, hook,
and RLS policy. Use this alongside `seed-test-roles.sql` to set up the
accounts, then verify each prediction against actual behaviour.

Generated: 2026-04-29 — after fixes from rounds 1-3 + role-test fixes.

---

## Internal Team — predicted results

### UI tests

| Test | Predicted | Why |
|---|---|---|
| UI-NAV-4 | PASS | Sidebar shows only `Trades` (→ `/internal/trades`) and `Clients` |
| UI-NAV-5 | PASS | No Settings, New Contract, Contacts links |
| UI-NAV-6 | PASS | Trades link routes to `/internal/trades` (InternalTradeList), not `/trades` |
| UI-NAV-7 | PASS | Direct URL hit on `/trades`, `/contracts/new`, `/settings` redirects to `/internal/trades` (RoleGuard) |
| UI-USR-* | PASS (blocked) | Settings inaccessible — entire User Management page never reachable |
| UI-CLI-1 | PASS | Clients page loads in read-only mode |
| UI-CLI-3 | PASS | Add/Edit/Delete buttons hidden (canEdit = false in ClientList) |
| UI-TLS-1 | PASS | Internal Trade List shows: Trade Ref, Client, Date, Status, Advance, Balance |
| UI-TLS-7 | N/A | Internal users go to `/internal/trades/:id/folder`, not the SuperAdmin TradeDetail |
| UI-FLD-1 | PASS | InternalTradeFolder shows documents + upload BOL/Signed/Other slots |
| UI-FLD-3 | PASS | Internal can upload documents (allowed by `documents_insert_admin_internal` RLS) |

### Logic tests

| Test | Predicted | Why |
|---|---|---|
| LG-RLS-2 | PASS | Internal can SELECT trades (200) |
| LG-RLS-3 | **PARTIAL FAIL → PASS after fix-role-test-issues.sql** | Without `trades_basic` view, Internal can read `frigo_total`, `sale_total`, `net_profit` via direct API. The view created in the SQL fix exposes only non-financial columns; frontend hook needs updating to query the view (TODO). |
| LG-RLS-4 | PASS | Internal SELECT on `clients` allowed |
| LG-RLS-5 | PASS | Internal cannot UPDATE/DELETE clients (clients_update_admin policy) |
| LG-RLS-6 | PASS | Internal cannot SELECT contacts (contacts_admin_only policy) |
| LG-RLS-7 | PASS | Internal cannot SELECT bank_profiles (bank_profiles_admin_only policy) |
| LG-RLS-8 | PASS | Internal can INSERT documents |
| LG-RLS-9 | PASS | Internal cannot UPDATE/DELETE trades (trades_*_admin policies) |

### Outstanding gap

**LG-RLS-3 column visibility** — the TS frontend currently queries `select=*` which Internal CAN read. To close the gap fully:

1. Run `fix-role-test-issues.sql` to create the `trades_basic` view (✅ done)
2. Update `useTrades` hook to switch to the view based on role:
```typescript
const fromTable = role === 'internal' ? 'trades_basic' : 'trades'
let query = supabase.from(fromTable).select(...)
```

For now the UI hides financial columns via `isSuperAdmin` checks in `TradeList`/`TradeDetail`, but Internal can't reach those routes anyway. The `InternalTradeList` only renders trade_reference + client name + dates + statuses, which trades_basic supports.

---

## Partner — predicted results

### UI tests

| Test | Predicted | Why |
|---|---|---|
| UI-NAV-8 | PASS | Partner sees only Partner Dashboard, no AppLayout sidebar |
| UI-NAV-9 | PASS | Direct URL hit on `/dashboard`, `/trades`, `/settings` redirects to `/partner` |
| UI-NAV-10 | PASS | Logout → `/login` |
| UI-MIL-1 | PASS | Notification badge visible |
| UI-DOC-* | PASS | Partner can download trade documents (RLS allows SELECT) |
| **UI-CLI-* / UI-CON-* / UI-USR-* / UI-EDT-*** | **PASS (blocked)** | All of these pages are unreachable for Partner |
| UI-TLS-1 (partner version) | PASS after fix | Partner sees client name in Trade List once `clients_select_admin_internal_partner` policy is applied |
| **UI-PAR-1** | PASS | PartnerDashboard renders KPIs (Total Trades, Total Sale Volume, Total Net Profit, Active, Overdue) — Frigo Purchase Price KPI removed in earlier round (F-P0-2 visibility fix) |
| **UI-PAR-2** | PASS | PartnerTradeDetail shows Sale Price/Unit, Sale Total, Shipping, Insurance, Bank Fees, Total Costs, Net Profit — but NOT Frigo Purchase Price (per spec §9.1) |
| UI-PAR-3 | PASS | No "Mark Received" buttons for Partner — the trade detail is read-only for them |

### Logic tests

| Test | Predicted | Why |
|---|---|---|
| LG-RLS-10 | PASS | Partner can SELECT trades (200) |
| LG-RLS-11 | PASS | Partner cannot UPDATE/DELETE trades |
| LG-RLS-12 | **PASS after fix** | Partner can SELECT clients (joined data needed for trade displays) |
| LG-RLS-13 | PASS | Partner cannot SELECT contacts |
| LG-RLS-14 | PASS | Partner cannot SELECT bank_profiles |
| LG-RLS-15 | PASS | Partner cannot INSERT/UPDATE documents |
| **LG-SEC-9** | PASS | No `profit_split` / `partner_share` / `share_pct` in any Partner-readable response — verified at schema level |

### Outstanding observation

**Frigo Purchase Price still derivable**: Partner can see `total_costs - shipping - insurance - bank_fees` on every trade, which equals `frigo_total`. So while we've hidden the column, math reveals the price. This is unavoidable without a separate `total_costs_excluding_supplier` field — not a regression from this round, just a limitation of the matrix.

---

## Test execution checklist

Once you've created the two test accounts:

### Internal Team
1. Sign in as the `internal` role account
2. Verify sidebar shows only Trades + Clients
3. Click Trades → confirm InternalTradeList renders without financials
4. Click any trade row → lands on /internal/trades/:id/folder
5. Try direct URL `/trades` → should redirect to `/internal/trades`
6. Try direct URL `/settings/users` → should redirect to `/internal/trades`
7. Click Clients → list loads, no Add/Edit/Delete buttons visible
8. Sign out → `localStorage.tm_*` keys should be gone

### Partner
1. Sign in as the `partner` role account
2. Verify lands on /partner (Partner Dashboard)
3. Verify NO main app sidebar (no Trades, Clients, Settings — uses PartnerLayout)
4. Confirm KPIs include Total Sale Volume (NOT "Invested Capital")
5. Click any trade row → /partner/trades/:id
6. Confirm trade detail shows Sale Price / Sale Total / Shipping / Insurance / Bank Fees / Total Costs / Net Profit
7. Confirm trade detail does NOT show Frigo Purchase Price (super_admin only)
8. Confirm no "Mark Received" buttons
9. Try direct URL `/trades`, `/dashboard`, `/settings` → all redirect to `/partner`
10. Documents section: Download buttons visible, no Upload

### RLS validation (curl with each role's JWT)
```bash
# Get JWT from the browser localStorage after logging in as each role
JWT="..."

# Internal: should succeed
curl -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  "https://xpupsaqsozpatsyeszox.supabase.co/rest/v1/clients?select=company_name"

# Internal: should return empty array (RLS blocks)
curl -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  "https://xpupsaqsozpatsyeszox.supabase.co/rest/v1/contacts?select=*"

# Internal: should return empty array (RLS blocks)
curl -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  "https://xpupsaqsozpatsyeszox.supabase.co/rest/v1/bank_profiles?select=*"

# Partner: should now succeed (after fix-role-test-issues.sql)
curl -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  "https://xpupsaqsozpatsyeszox.supabase.co/rest/v1/clients?select=company_name"
```
