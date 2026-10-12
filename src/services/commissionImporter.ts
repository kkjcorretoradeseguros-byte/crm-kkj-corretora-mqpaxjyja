// Parser e rotina idempotente de importação para a planilha
// "Grade de comissão - Saúde Bliss.xlsx" (ou CSV equivalente).
// Conforme orientações do cliente:
// 1. Excluir completamente 'Go Care Saúde' (todas modalidades).
// 2. Plena Saúde PME: usar somente Opção 1 (100/50/40/20/20 = 230%).
// 3. Remover duplicatas idênticas.
// 4. Ignorar regras de total zero, preservando parcelas de 0% dentro de regras com comissão válida.
// 5. Não substituir as Regras Especiais PME já cadastradas.
// 6. Relatório de linhas processadas/importadas/descartadas/duplicadas/pendentes.

export interface SpreadsheetRow {
  operadora: string
  modalidade: string
  produto?: string
  parcelas: number[] // Ex: [100, 50, 40, 20, 20]
  vitalicio?: number
  observacoes?: string
}

export interface ImportReport {
  totalLinhasLidas: number
  regrasImportadas: number
  regrasDescartadas: number
  regrasDuplicadas: number
  regrasParaAnaliseAdm: number
  detalhesDescartes: string[]
  regrasValidadas: Array<{
    operadora: string
    modalidade: string
    percentuais: string
    status: 'importada' | 'descartada' | 'analise_adm'
    motivo?: string
  }>
}

export const commissionImporter = {
  /**
   * Processa linhas de planilha previamente parseadas (CSV ou JSON)
   */
  processRows(rows: SpreadsheetRow[]): ImportReport {
    const report: ImportReport = {
      totalLinhasLidas: rows.length,
      regrasImportadas: 0,
      regrasDescartadas: 0,
      regrasDuplicadas: 0,
      regrasParaAnaliseAdm: 0,
      detalhesDescartes: [],
      regrasValidadas: [],
    }

    const seenRules = new Set<string>()

    for (const row of rows) {
      const opNorm = (row.operadora || '').trim()
      const modNorm = (row.modalidade || '').trim()

      if (!opNorm) {
        report.regrasDescartadas++
        report.detalhesDescartes.push('Linha sem nome de operadora.')
        continue
      }

      // Regra 1: Excluir Go Care Saúde completamente
      if (opNorm.toLowerCase().includes('go care') || opNorm.toLowerCase().includes('gocare')) {
        report.regrasDescartadas++
        report.detalhesDescartes.push(
          `Operadora ${opNorm} descartada conforme diretriz de exclusão total.`,
        )
        report.regrasValidadas.push({
          operadora: opNorm,
          modalidade: modNorm,
          percentuais: row.parcelas.join('/'),
          status: 'descartada',
          motivo: 'Exclusão obrigatória (Go Care)',
        })
        continue
      }

      // Regra 4: Descartar regras com comissão total zero
      const somaParcelas = row.parcelas.reduce((acc, p) => acc + (p || 0), 0)
      if (somaParcelas <= 0 && (!row.vitalicio || row.vitalicio <= 0)) {
        report.regrasDescartadas++
        report.detalhesDescartes.push(
          `Regra de ${opNorm} (${modNorm}) com total zero de comissão descartada.`,
        )
        report.regrasValidadas.push({
          operadora: opNorm,
          modalidade: modNorm,
          percentuais: '0%',
          status: 'descartada',
          motivo: 'Comissão total zero',
        })
        continue
      }

      // Regra 2: Plena Saúde PME -> Usar somente opção 1 (100/50/40/20/20 = 230%)
      if (opNorm.toLowerCase().includes('plena') && modNorm.toUpperCase().includes('PME')) {
        const isOpcao1 = somaParcelas === 230
        if (!isOpcao1) {
          report.regrasDescartadas++
          report.detalhesDescartes.push(
            `Plena Saúde PME alternativa (${row.parcelas.join('/')}%) descartada; apenas Opção 1 mantida.`,
          )
          report.regrasValidadas.push({
            operadora: opNorm,
            modalidade: modNorm,
            percentuais: row.parcelas.join('/'),
            status: 'descartada',
            motivo: 'Apenas Opção 1 permitida para Plena Saúde PME',
          })
          continue
        }
      }

      // Regra 3: Deduplicação
      const ruleKey = `${opNorm.toLowerCase()}__${modNorm.toLowerCase()}__${row.parcelas.join('-')}`
      if (seenRules.has(ruleKey)) {
        report.regrasDuplicadas++
        report.detalhesDescartes.push(`Duplicata idêntica de ${opNorm} (${modNorm}) ignorada.`)
        report.regrasValidadas.push({
          operadora: opNorm,
          modalidade: modNorm,
          percentuais: row.parcelas.join('/'),
          status: 'descartada',
          motivo: 'Duplicata idêntica',
        })
        continue
      }
      seenRules.add(ruleKey)

      // Regra aprovada
      report.regrasImportadas++
      report.regrasValidadas.push({
        operadora: opNorm,
        modalidade: modNorm,
        percentuais: row.parcelas.join('/'),
        status: 'importada',
      })
    }

    return report
  },

  /**
   * Converte texto em formato CSV para linhas estruturadas
   */
  parseCsv(csvContent: string): SpreadsheetRow[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length <= 1) return []

    const rows: SpreadsheetRow[] = []
    // Pular cabeçalho
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/[;,]/).map((p) => p.trim())
      if (parts.length < 2) continue

      const operadora = parts[0]
      const modalidade = parts[1] || 'PME'
      const parcelasParts = parts.slice(2).filter(Boolean)
      const parcelas = parcelasParts.map((p) => parseFloat(p.replace('%', '')) || 0)

      rows.push({
        operadora,
        modalidade,
        parcelas,
      })
    }

    return rows
  },
}
