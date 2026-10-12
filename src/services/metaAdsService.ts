// Serviço de integração Meta Ads (Facebook / Instagram)
// Preserva estrutura para webhook, persistência de capturas e classificação automática de tags
// NÃO declara que a integração está ativa sem recebimento real testado!

export interface MetaLeadPayload {
  platform: 'Facebook' | 'Instagram' | 'Meta'
  lead_id: string
  created_time: string
  campaign_name?: string
  campaign_id?: string
  adset_name?: string
  adset_id?: string
  ad_name?: string
  ad_id?: string
  form_name?: string
  form_id?: string
  field_data: Record<string, string | number>
}

export interface MetaIntegrationStatus {
  webhookConfigured: boolean
  accessTokenConfigured: boolean
  lastLeadReceivedAt?: string
  statusMessage: string
  pendingItems: string[]
}

export const metaAdsService = {
  /**
   * Status real da integração Meta Ads
   */
  getStatus(): MetaIntegrationStatus {
    return {
      webhookConfigured: false,
      accessTokenConfigured: false,
      statusMessage:
        'Integração Meta Ads pendente de configuração de Token de Acesso permanente e URL de Webhook no Gerenciador de Negócios da Meta.',
      pendingItems: [
        'Cadastrar App no Meta for Developers',
        'Configurar Webhook leads/leadgen',
        'Gerar Token de Acesso de Página com escopo leads_retrieval',
        'Validar recebimento de lead de teste pela ferramenta de Lead Ads da Meta',
      ],
    }
  },

  /**
   * Classifica tags e mapeia campos automaticamente para oportunidade do CRM
   */
  classifyLead(payload: MetaLeadPayload): {
    tags: string[]
    contactData: {
      name: string
      phone: string
      email?: string
    }
    oppData: {
      title: string
      modalidade?: string
      notes?: string
    }
  } {
    const fields = payload.field_data || {}
    const tags: string[] = ['Tráfego pago']

    // Mapeamento de nome, telefone e email
    const name = String(fields.full_name || fields.name || fields.nome || 'Lead Meta Ads')
    const phone = String(
      fields.phone_number || fields.phone || fields.celular || fields.whatsapp || '',
    )
    const email = fields.email ? String(fields.email) : undefined

    // Regra 7: classificar automaticamente interesse em plano de saúde
    const allText = JSON.stringify(fields).toLowerCase()
    if (
      allText.includes('saúde') ||
      allText.includes('saude') ||
      allText.includes('plano') ||
      allText.includes('médico') ||
      allText.includes('medico')
    ) {
      tags.push('Saúde')
    }

    // Modalidade confirmada no formulário (PME, PF ou Adesão) - NÃO presumir!
    if (
      allText.includes('pme') ||
      allText.includes('cnpj') ||
      allText.includes('empresa') ||
      allText.includes('empresarial')
    ) {
      tags.push('PME')
    } else if (
      allText.includes('adesão') ||
      allText.includes('adesao') ||
      allText.includes('entidade') ||
      allText.includes('sindicato')
    ) {
      tags.push('Adesão')
    } else if (
      allText.includes('individual') ||
      allText.includes('familiar') ||
      allText.includes('pf') ||
      allText.includes('pessoa física')
    ) {
      tags.push('PF')
    }

    return {
      tags,
      contactData: {
        name,
        phone,
        email,
      },
      oppData: {
        title: `Lead Meta - ${name}`,
        notes: `Origem: ${payload.platform} | Campanha: ${payload.campaign_name || 'N/A'} | Anúncio: ${payload.ad_name || 'N/A'} | Formulário: ${payload.form_name || 'N/A'}`,
      },
    }
  },
}
