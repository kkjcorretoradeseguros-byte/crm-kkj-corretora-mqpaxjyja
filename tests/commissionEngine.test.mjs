import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/commissionEngine.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { commissionEngine } = await import('data:text/javascript,' + encodeURIComponent(compiled))

test('Bradesco PME: 400% over five installments and 15% tax on seller payout', () => {
  const result = commissionEngine.calculate({ carrierName: 'Bradesco Saúde', mensalidade: 1000 })
  assert.deepEqual(result.parcelas.map(p => p.valor_previsto), [1000, 1000, 1000, 500, 500])
  assert.equal(result.totalFaturamentoPrevisto, 4000)
  assert.equal(result.parcelas[0].repasse_vendedor, 425)
  assert.equal(result.parcelas[1].repasse_vendedor, 0)
})

test('PME seller-sourced lead: full first net commission', () => {
  const result = commissionEngine.calculate({ carrierName: 'Amil', mensalidade: 1000, leadOrigin: 'vendedor' })
  assert.equal(result.parcelas[0].repasse_vendedor, 850)
  assert.match(result.vitalicioInfo, /2%/)
})

test('PF and Adesão: 30% of first net payment', () => {
  for (const modalidade of ['PF', 'Adesão']) {
    const result = commissionEngine.calculate({ carrierName: 'Amil', modalidade, mensalidade: 1000 })
    assert.equal(result.parcelas[0].repasse_vendedor, 255)
  }
})

test('Reject invalid values instead of creating corrupt projections', () => {
  for (const mensalidade of [0, -1, NaN, Infinity]) {
    assert.throws(() => commissionEngine.calculate({ carrierName: 'Amil', mensalidade }))
  }
  for (const impostoAliquota of [-1, 101, NaN, Infinity]) {
    assert.throws(() => commissionEngine.calculate({ carrierName: 'Amil', mensalidade: 1000, impostoAliquota }))
  }
})

test('Unknown carrier does not invent a commission schedule', () => {
  const result = commissionEngine.calculate({ carrierName: 'Operadora sem regra', mensalidade: 1000 })
  assert.deepEqual(result.parcelas, [])
})

test('Accented carrier names resolve the same commercial schedule', () => {
  for (const carrierName of ['SulAmérica', 'Sulamerica', 'MedSênior', 'Medsenior', 'Plena Saúde', 'Plena Saude']) {
    const result = commissionEngine.calculate({ carrierName, mensalidade: 1000 })
    assert.ok(result.parcelas.length > 0, carrierName)
  }
})
