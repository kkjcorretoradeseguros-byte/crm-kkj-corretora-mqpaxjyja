// Motor de comissionamento KKJ
// Aplica regras de comissão por posição específica da mensalidade,
// adesão 100% integral KKJ, repasses de vendedores e regras especiais de Saúde PME.

export interface SpecialRuleSchedule {
  carrier: string
  modalidade: string
  parcelas: number[] // Ex: [100, 100, 100, 50, 50]
  vitalicioPercentual?: number // Ex: 2%
  vitalicioAPartirDe?: number // Ex: a partir da 4ª
  totalPercentual: number
  semVitalicio: boolean
}

// 9. REGRAS ESPECIAIS SAÚDE PME CONFORME PRESCRIÇÃO DO CLIENTE:
// - Bradesco Saúde: 100/100/100/50/50 (total 400%, sem vitalício)
// - Amil: 100/100/100 + 2% vitalício a partir da 4ª (total 300% + recorrência)
// - SulAmérica: idêntica à Amil (100/100/100 + 2% vitalício a partir da 4ª)
// - Porto Seguro: idêntica à Amil (100/100/100 + 2% vitalício a partir da 4ª)
// - Alice: 100/100/100 (total 300%, sem vitalício)
// - MedSênior: 100/50/50 (total 200%, sem vitalício)
// - Hapvida: 100/100/100/50 (total 350%, sem vitalício)
// - Plena Saúde PME: Opção 1 (100/50/40/20/20 = 230%)
export const SPECIAL_PME_RULES: Record<string, SpecialRuleSchedule> = {
  'bradesco saúde': {
    carrier: 'Bradesco Saúde',
    modalidade: 'PME',
    parcelas: [100, 100, 100, 50, 50],
    totalPercentual: 400,
    semVitalicio: true,
  },
  bradesco: {
    carrier: 'Bradesco Saúde',
    modalidade: 'PME',
    parcelas: [100, 100, 100, 50, 50],
    totalPercentual: 400,
    semVitalicio: true,
  },
  amil: {
    carrier: 'Amil',
    modalidade: 'PME',
    parcelas: [100, 100, 100],
    vitalicioPercentual: 2,
    vitalicioAPartirDe: 4,
    totalPercentual: 300,
    semVitalicio: false,
  },
  sulamérica: {
    carrier: 'SulAmérica',
    modalidade: 'PME',
    parcelas: [100, 100, 100],
    vitalicioPercentual: 2,
    vitalicioAPartirDe: 4,
    totalPercentual: 300,
    semVitalicio: false,
  },
  sulamerica: {
    carrier: 'SulAmérica',
    modalidade: 'PME',
    parcelas: [100, 100, 100],
    vitalicioPercentual: 2,
    vitalicioAPartirDe: 4,
    totalPercentual: 300,
    semVitalicio: false,
  },
  'porto seguro': {
    carrier: 'Porto Seguro',
    modalidade: 'PME',
    parcelas: [100, 100, 100],
    vitalicioPercentual: 2,
    vitalicioAPartirDe: 4,
    totalPercentual: 300,
    semVitalicio: false,
  },
  porto: {
    carrier: 'Porto Seguro',
    modalidade: 'PME',
    parcelas: [100, 100, 100],
    vitalicioPercentual: 2,
    vitalicioAPartirDe: 4,
    totalPercentual: 300,
    semVitalicio: false,
  },
  alice: {
    carrier: 'Alice',
    modalidade: 'PME',
    parcelas: [100, 100, 100],
    totalPercentual: 300,
    semVitalicio: true,
  },
  medsênior: {
    carrier: 'MedSênior',
    modalidade: 'PME',
    parcelas: [100, 50, 50],
    totalPercentual: 200,
    semVitalicio: true,
  },
  medsenior: {
    carrier: 'MedSênior',
    modalidade: 'PME',
    parcelas: [100, 50, 50],
    totalPercentual: 200,
    semVitalicio: true,
  },
  hapvida: {
    carrier: 'Hapvida',
    modalidade: 'PME',
    parcelas: [100, 100, 100, 50],
    totalPercentual: 350,
    semVitalicio: true,
  },
  'plena saúde': {
    carrier: 'Plena Saúde',
    modalidade: 'PME',
    parcelas: [100, 50, 40, 20, 20],
    totalPercentual: 230,
    semVitalicio: true,
  },
  'plena saude': {
    carrier: 'Plena Saúde',
    modalidade: 'PME',
    parcelas: [100, 50, 40, 20, 20],
    totalPercentual: 230,
    semVitalicio: true,
  },
}

export interface CalculatedInstallment {
  numero_parcela: number
  percentual: number
  valor_previsto: number
  repasse_vendedor: number
  is_vitalicio?: boolean
}

export interface CommissionCalculationResult {
  carrier: string
  modalidade: string
  mensalidade: number
  totalFaturamentoPrevisto: number
  parcelas: CalculatedInstallment[]
  vitalicioInfo?: string
  observacoes: string
  isSpecialRule: boolean
}

export const commissionEngine = {
  /**
   * Calcula o cronograma de comissões conforme operadora, modalidade e mensalidade
   */
  calculate(params: {
    carrierName: string
    modalidade?: string
    mensalidade: number
    leadOrigin?: 'kkj' | 'vendedor' // Para repasse do vendedor
    impostoAliquota?: number // Default 15%; aceita decimal ou percentual
  }): CommissionCalculationResult {
    const {
      carrierName,
      modalidade = 'PME',
      mensalidade,
      leadOrigin = 'kkj',
      impostoAliquota = 0.15, // Padrão 15% KKJ
    } = params

    // Normaliza para decimal (se vier 11, converte para 0.11)
    if (!Number.isFinite(mensalidade) || mensalidade <= 0) throw new Error('Mensalidade inválida')
    if (!Number.isFinite(impostoAliquota) || impostoAliquota < 0 || impostoAliquota > 100) throw new Error('Alíquota inválida')
    const taxaDecimal = impostoAliquota > 1 ? impostoAliquota / 100 : impostoAliquota

    const normCarrier = carrierName.trim().toLowerCase()
    const normMod = modalidade.trim().toUpperCase()

    // Caso especial Adesão: Primeira mensalidade é 100% KKJ via boleto próprio!
    if (normMod === 'ADESÃO' || normMod === 'ADESAO') {
      const primeiroBoletoIntegral = mensalidade
      const imposto = primeiroBoletoIntegral * taxaDecimal
      const receitaLiquida = primeiroBoletoIntegral - imposto
      const comissaoVendedor = receitaLiquida * 0.3 // 30% da receita líquida na 1ª

      return {
        carrier: carrierName,
        modalidade: 'Adesão',
        mensalidade,
        totalFaturamentoPrevisto: primeiroBoletoIntegral,
        parcelas: [
          {
            numero_parcela: 1,
            percentual: 100,
            valor_previsto: primeiroBoletoIntegral,
            repasse_vendedor: comissaoVendedor,
            is_vitalicio: false,
          },
        ],
        observacoes:
          'Adesão: 1ª mensalidade 100% KKJ via boleto próprio. Comissões posteriores aguardam planilha oficial.',
        isSpecialRule: true,
      }
    }

    // Regras Especiais Saúde PME
    if (normMod.includes('PME') && SPECIAL_PME_RULES[normCarrier]) {
      const rule = SPECIAL_PME_RULES[normCarrier]
      const parcelas: CalculatedInstallment[] = []

      rule.parcelas.forEach((pct, idx) => {
        const num = idx + 1
        const valorPrevisto = mensalidade * (pct / 100)

        // Repasse vendedor na 1ª parcela:
        // PME lead KKJ -> 50% da líquida; Lead vendedor -> 100% da líquida
        let repasse = 0
        if (num === 1) {
          const liq = valorPrevisto * (1 - taxaDecimal)
          repasse = leadOrigin === 'vendedor' ? liq : liq * 0.5
        }

        parcelas.push({
          numero_parcela: num,
          percentual: pct,
          valor_previsto: valorPrevisto,
          repasse_vendedor: repasse,
          is_vitalicio: false,
        })
      })

      let vitalicioInfo: string | undefined
      if (rule.vitalicioPercentual && rule.vitalicioAPartirDe) {
        vitalicioInfo = `${rule.vitalicioPercentual}% vitalício a partir da ${rule.vitalicioAPartirDe}ª mensalidade`
      }

      const totalPrevisto = parcelas.reduce((acc, p) => acc + p.valor_previsto, 0)

      return {
        carrier: rule.carrier,
        modalidade: 'PME',
        mensalidade,
        totalFaturamentoPrevisto: totalPrevisto,
        parcelas,
        vitalicioInfo,
        observacoes: `Regra Especial PME: ${rule.parcelas.join('/')}%${rule.vitalicioPercentual ? ` + ${rule.vitalicioPercentual}% vitalício` : ''}`,
        isSpecialRule: true,
      }
    }

    // Modalidade Pessoa Física (PF)
    if (normMod === 'PF' || normMod.includes('FÍSICA') || normMod.includes('FISICA')) {
      const valor1a = mensalidade * 1.0 // Padrão 100% na 1ª
      const liq = valor1a * (1 - taxaDecimal)
      const repasse = liq * 0.3 // 30% da 1ª parcela para o vendedor

      return {
        carrier: carrierName,
        modalidade: 'Pessoa Física',
        mensalidade,
        totalFaturamentoPrevisto: valor1a,
        parcelas: [
          {
            numero_parcela: 1,
            percentual: 100,
            valor_previsto: valor1a,
            repasse_vendedor: repasse,
          },
        ],
        observacoes:
          'Pessoa Física: 1ª parcela padrão; parcelas posteriores aguardam importação da planilha.',
        isSpecialRule: false,
      }
    }

    // Demais operadoras sem regra especial PME: pendente de importação da planilha
    return {
      carrier: carrierName,
      modalidade,
      mensalidade,
      totalFaturamentoPrevisto: 0,
      parcelas: [],
      observacoes:
        'Grade de comissão oficial pendente de envio/importação da planilha "Grade de comissão - Saúde Bliss.xlsx".',
      isSpecialRule: false,
    }
  },
}
