import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const contract = readFileSync(new URL('../src/services/contractService.ts', import.meta.url), 'utf8')
const pipeline = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8')

test('implantation recognizes both confirmed payment columns', () => {
  assert.match(contract, /Boolean\(current\.data_confirmacao_pagamento\)/)
  assert.match(contract, /Boolean\(current\.data_pagamento\)/)
})

test('contract updates compare financial snapshot fields with saved values', () => {
  assert.match(contract, /\.from\('contract_financials'\)/)
  assert.match(contract, /data\.origem_comercial_lead, saved\.origem_comercial_lead/)
  assert.match(contract, /data\.sale_value, saved\.valor_mensal/)
})

test('winning opportunity is updated only after contract persistence', () => {
  const fn = pipeline.slice(pipeline.indexOf('const handleConfirmVendaGanha'))
  assert.ok(fn.indexOf('contractService.updateContract(') < fn.indexOf('opportunityService.updateOpportunity('))
  assert.ok(fn.indexOf('contractService.createContract(') < fn.indexOf('opportunityService.updateOpportunity('))
})
