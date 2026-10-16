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

test('financial snapshots accept equivalent numeric values', () => {
  assert.match(contract, /typeof incoming === 'number'/)
  assert.match(contract, /Number\(incoming\) !== Number\(current\)/)
})

test('first commission receipt follows financial persistence', () => {
  const forecast = readFileSync(new URL('../src/services/commissionForecastService.ts', import.meta.url), 'utf8')
  const ensure = forecast.slice(forecast.indexOf('export async function ensureConfirmedContractForecast'))
  assert.ok(ensure.indexOf('persistContractCommissionForecast(') < ensure.lastIndexOf('confirmFirstCommissionReceipt(contractId)'))
  assert.match(ensure, /\.rpc\('confirm_first_commission_receipt'/)
})

test('missing saved financial value is not treated as numeric zero', () => {
  assert.match(contract, /current === null \|\| current === undefined/)
})

test('commercial lead origin migration keeps legacy contracts unclassified', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261016155500_contract_commercial_lead_origin.sql', import.meta.url), 'utf8')
  assert.match(migration, /add column if not exists origem_comercial_lead text/)
  assert.match(migration, /origem_comercial_lead is null/)
  assert.doesNotMatch(migration, /update\s+public\.contracts\s+set\s+origem_comercial_lead/i)
})

test('non-admin users cannot confirm client payment in winning sale flow', () => {
  const fn = pipeline.slice(pipeline.indexOf('const handleConfirmVendaGanha'))
  const guard = fn.indexOf("data.isPaymentConfirmed && user?.role !== 'ADMINISTRADOR'")
  const companyWrite = fn.indexOf('companyService.updateCompany(')
  assert.ok(guard >= 0 && guard < companyWrite)
})

test('commission preview rejects invalid lives and monthly premiums', () => {
  const forecast = readFileSync(new URL('../src/services/commissionForecastService.ts', import.meta.url), 'utf8')
  const preview = forecast.slice(forecast.indexOf('export async function previewConfirmedContractCommissions'), forecast.indexOf('export async function ensureConfirmedContractForecast'))
  assert.match(preview, /Number\.isInteger\(lives\) \|\| lives < 1/)
  assert.match(preview, /Number\.isFinite\(Number\(contract\.valor_mensal\)\)/)
  assert.match(preview, /Number\(contract\.valor_mensal\) > 0/)
  assert.ok(preview.indexOf('Number.isInteger(lives)') < preview.indexOf('const applicable ='))
})

test('reprocessing a won sale preserves active contract status', () => {
  const fn = pipeline.slice(pipeline.indexOf('const handleConfirmVendaGanha'))
  assert.match(fn, /status: activeContract\.status === 'Ativo' \? 'Ativo' : 'Em Implantação'/)
})

test('direct commission preview rejects zero premium', () => {
  const forecast = readFileSync(new URL('../src/services/commissionForecastService.ts', import.meta.url), 'utf8')
  const preview = forecast.slice(forecast.indexOf('export async function previewContractCommissions'), forecast.indexOf('export async function persistContractCommissionForecast'))
  assert.match(preview, /params\.mensalidade <= 0/)
})

test('winning sale rejects multiple contracts instead of picking the first', () => {
  const fn = pipeline.slice(pipeline.indexOf('const handleConfirmVendaGanha'))
  const guard = fn.indexOf('existingContracts.totalItems > 1')
  const selection = fn.indexOf('existingContracts.items[0]')
  assert.ok(guard >= 0 && selection > guard)
})
