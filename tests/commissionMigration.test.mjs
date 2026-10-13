import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/20261013230500_contract_commission_forecast_rpc.sql', import.meta.url), 'utf8')
const signature = 'public.persist_contract_commission_forecast(uuid,uuid,text,jsonb)'

test('SQL function execute grants match its four-argument signature', () => {
  assert.match(sql, /p_contract_id uuid,\s*p_rule_id uuid,\s*p_lead_origin text,\s*p_installments jsonb/)
  assert.ok(sql.includes('revoke all on function ' + signature))
  assert.ok(sql.includes('grant execute on function ' + signature))
})

test('SQL financial transaction requires admin, contract lock, and rejects overwrites', () => {
  assert.match(sql, /auth\.uid\(\) is null or not public\.is_admin\(\)/)
  assert.match(sql, /where id = p_contract_id for update/)
  assert.match(sql, /from public\.contract_financials where contract_id = p_contract_id/)
  assert.match(sql, /Comissão recorrente ainda não suportada/)
})

test('SQL validates source data and persists expected, not received, installments', () => {
  for (const field of ['v_contract_premium', 'v_rule_tax', 'v_split_rate', 'v_contract_lives', 'v_rule_product']) {
    assert.ok(sql.includes(field))
  }
  assert.match(sql, /'previsto'/)
  assert.match(sql, /insert into public\.contract_financials/)
  assert.match(sql, /insert into public\.commission_installments/)
})

test('SQL due dates are anchored to the first installment and month-end clamped', () => {
  assert.match(sql, /where \(x->>'numero_parcela'\)::integer = 1/)
  assert.match(sql, /Vencimento fora do cronograma/)
  assert.match(sql, /least\(extract\(day from v_first_due\)/)
  assert.doesNotMatch(sql, /select min\(\(x->>'data_vencimento'\)::date\) into v_first_due/)
})
