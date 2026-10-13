import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/20261013230500_contract_commission_forecast_rpc.sql', import.meta.url), 'utf8')
const declarations = sql.split(/\bdeclare\b/i)[1]?.split(/\bbegin\b/i)[0] ?? ''

test('migration has no duplicate PL/pgSQL variables', () => {
  assert.ok(declarations)
  const variables = [...declarations.matchAll(/^\s*(v_[a-z_]+)\s+(?:uuid|numeric|integer|boolean|date|text|jsonb)\b/gm)].map(match => match[1])
  assert.ok(variables.length > 15)
  assert.equal(variables.length, new Set(variables).size)
})

test('migration uses one monthly due date check', () => {
  assert.ok(sql.includes('Vencimento fora do cronograma'))
  assert.match(sql, /v_expected_due/)
  assert.match(sql, /v_first_due/)
})

test('SQL validates financial input boundaries', () => {
  assert.ok(sql.includes("(v_row->>'percentual_aplicado')::numeric > 100"))
  assert.ok(sql.includes("(v_row->>'valor_base_mensalidade')::numeric <= 0"))
})

test('SQL recalculates financial values from the persisted contract and rule', () => {
  assert.ok(sql.includes('v_premium is distinct from v_contract_premium'))
  assert.ok(sql.includes('round(v_premium * v_pct / 100, 2)'))
  assert.ok(sql.includes('round((v_row->>\'valor_previsto\')::numeric * v_rule_tax / 100, 2)'))
  assert.ok(sql.includes('repasse_previsto_vendedor'))
  assert.ok(sql.includes('v_rule_carrier is distinct from v_contract_carrier'))
  assert.ok(sql.includes('v_count <> v_schedule_count'))
})

test('SQL rejects string-encoded monetary values', () => {
  for (const key of ['valor_previsto', 'imposto_retido', 'valor_liquido', 'repasse_previsto_vendedor', 'percentual_aplicado', 'valor_base_mensalidade']) {
    assert.ok(sql.includes("jsonb_typeof(v_row->'" + key + "') <> 'number'"))
  }
})
