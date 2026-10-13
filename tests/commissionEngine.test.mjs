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

test('Carrier aliases preserve each negotiated PME schedule', () => {
  const cases = [
    ['Bradesco', [100, 100, 100, 50, 50]],
    ['Bradesco Saúde', [100, 100, 100, 50, 50]],
    ['Amil', [100, 100, 100]],
    ['SulAmérica', [100, 100, 100]],
    ['Porto Seguro', [100, 100, 100]],
    ['Alice', [100, 100, 100]],
    ['MedSênior', [100, 50, 50]],
    ['Hapvida', [100, 100, 100, 50]],
    ['Plena Saúde', [100, 50, 40, 20, 20]],
  ]
  for (const [carrierName, percentages] of cases) {
    const result = commissionEngine.calculate({ carrierName, mensalidade: 1000 })
    assert.deepEqual(result.parcelas.map(p => p.percentual), percentages, carrierName)
  }
})

test('Reject empty carrier and modality', () => {
  for (const carrierName of ['', '   ']) {
    assert.throws(() => commissionEngine.calculate({ carrierName, mensalidade: 1000 }))
  }
  assert.throws(() => commissionEngine.calculate({ carrierName: 'Amil', modalidade: ' ', mensalidade: 1000 }))
})

test('Tax accepts decimal and percentage representations consistently', () => {
  const decimal = commissionEngine.calculate({ carrierName: 'Amil', mensalidade: 1000, impostoAliquota: 0.15 })
  const percentage = commissionEngine.calculate({ carrierName: 'Amil', mensalidade: 1000, impostoAliquota: 15 })
  assert.deepEqual(decimal.parcelas, percentage.parcelas)
})

test('Different PME lead origins change only first installment seller payout', () => {
  const kkj = commissionEngine.calculate({ carrierName: 'Bradesco', mensalidade: 1000, leadOrigin: 'kkj' })
  const own = commissionEngine.calculate({ carrierName: 'Bradesco', mensalidade: 1000, leadOrigin: 'vendedor' })
  assert.equal(kkj.parcelas[0].repasse_vendedor, 425)
  assert.equal(own.parcelas[0].repasse_vendedor, 850)
  assert.deepEqual(kkj.parcelas.slice(1), own.parcelas.slice(1))
})
