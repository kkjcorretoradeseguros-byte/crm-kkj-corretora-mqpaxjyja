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
  assert.equal((sql.match(/Vencimento fora do cronograma/g) ?? []).length, 1)
  assert.match(sql, /v_expected_due/)
  assert.match(sql, /v_first_due/)
})
