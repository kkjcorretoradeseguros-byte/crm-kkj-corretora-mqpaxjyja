import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Conversation, Message, WhatsappChannel } from '@/types/crm'

export interface ConversationFilterOptions {
  search?: string
  status?: string
  responsibleUserId?: string
  channelId?: string
}

export const whatsappService = {
  /**
   * Lista os canais de WhatsApp cadastrados no CRM KKJ.
   * Na migration 0001 / RLS, channels_select_auth permite SELECT para autenticados.
   */
  async getChannels(): Promise<WhatsappChannel[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .order('nome', { ascending: true })

      if (error) {
        console.warn('Erro ao carregar whatsapp_channels:', error.message)
        return []
      }

      return (data || []).map((c: any) => ({
        id: c.id,
        nome: c.nome,
        numero_telefone: c.numero_telefone,
        provedor: c.provedor || 'oficial',
        ativo: c.ativo ?? true,
        metadata: c.metadata || {},
        created_at: c.created_at,
        updated_at: c.updated_at,
      }))
    } catch (err: any) {
      console.warn('Exceção ao buscar whatsapp_channels:', err?.message)
      return []
    }
  },

  /**
   * Lista as conversas do WhatsApp com suporte a filtros e dados relacionados.
   * Respeita integralmente o RLS do Supabase (conversations_select_policy):
   * Admin visualiza todas; Gestor visualiza próprias e de sua equipe; Vendedor visualiza suas.
   */
  async getConversations(filters?: ConversationFilterOptions): Promise<Conversation[]> {
    if (!isSupabaseConfigured) return []

    try {
      let query = supabase
        .from('conversations')
        .select(
          `
          id,
          channel_id,
          phone_number_id,
          remote_jid,
          contact_id,
          opportunity_id,
          responsible_user_id,
          status,
          nao_lidas,
          created_at,
          updated_at,
          contact:contact_id (id, nome, celular, email),
          opportunity:opportunity_id (id, title, status, stage_id),
          responsible_user:responsible_user_id (id, nome, email, role),
          channel:channel_id (id, nome, numero_telefone)
        `,
        )
        .order('updated_at', { ascending: false })

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status)
      }

      if (filters?.responsibleUserId) {
        query = query.eq('responsible_user_id', filters.responsibleUserId)
      }

      if (filters?.channelId) {
        query = query.eq('channel_id', filters.channelId)
      }

      const { data, error } = await query

      if (error) {
        console.warn('Erro ao buscar conversas no Supabase:', error.message)
        return []
      }

      const conversations: Conversation[] = (data || []).map((item: any) => ({
        id: item.id,
        channel_id: item.channel_id,
        phone_number_id: item.phone_number_id,
        remote_jid: item.remote_jid,
        contact_id: item.contact_id,
        opportunity_id: item.opportunity_id,
        responsible_user_id: item.responsible_user_id,
        status: item.status,
        nao_lidas: item.nao_lidas ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        contact: Array.isArray(item.contact) ? item.contact[0] : item.contact,
        opportunity: Array.isArray(item.opportunity) ? item.opportunity[0] : item.opportunity,
        responsible_user: Array.isArray(item.responsible_user)
          ? item.responsible_user[0]
          : item.responsible_user,
        channel: Array.isArray(item.channel) ? item.channel[0] : item.channel,
      }))

      // Buscar última mensagem de cada conversa para prévia na listagem
      if (conversations.length > 0) {
        const conversationIds = conversations.map((c) => c.id)
        const { data: messagesData } = await supabase
          .from('messages')
          .select('id, conversation_id, direction, conteudo, status_entrega, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })

        if (messagesData) {
          const lastMsgMap = new Map<string, any>()
          for (const msg of messagesData) {
            if (!lastMsgMap.has(msg.conversation_id)) {
              lastMsgMap.set(msg.conversation_id, msg)
            }
          }
          for (const conv of conversations) {
            conv.last_message = lastMsgMap.get(conv.id)
          }
        }
      }

      // Filtro local de busca por texto (nome do contato, telefone ou jid)
      if (filters?.search && filters.search.trim()) {
        const searchLower = filters.search.toLowerCase().trim()
        return conversations.filter(
          (c) =>
            c.remote_jid?.toLowerCase().includes(searchLower) ||
            c.contact?.nome?.toLowerCase().includes(searchLower) ||
            c.contact?.celular?.toLowerCase().includes(searchLower) ||
            c.opportunity?.title?.toLowerCase().includes(searchLower),
        )
      }

      return conversations
    } catch (err: any) {
      console.warn('Exceção ao buscar conversas:', err?.message)
      return []
    }
  },

  /**
   * Obtém histórico completo e cronológico de mensagens de uma conversa específica.
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    if (!isSupabaseConfigured || !conversationId) return []

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('Erro ao carregar mensagens da conversa:', error.message)
        return []
      }

      return (data || []).map((m: any) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        external_message_id: m.external_message_id,
        direction: m.direction,
        conteudo: m.conteudo,
        status_entrega: m.status_entrega,
        user_id: m.user_id,
        metadata: m.metadata || {},
        created_at: m.created_at,
      }))
    } catch (err: any) {
      console.warn('Exceção ao buscar mensagens:', err?.message)
      return []
    }
  },

  /**
   * Transfere uma conversa para outro usuário responsável.
   * Regra do trigger de segurança (trg_check_conversation_links):
   * Apenas gestores e administradores podem transferir responsabilidade.
   * Vendedor comum recebe erro se tentar.
   */
  async transferConversation(
    conversationId: string,
    newResponsibleUserId: string,
  ): Promise<boolean> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }

    const { error } = await supabase
      .from('conversations')
      .update({
        responsible_user_id: newResponsibleUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (error) {
      throw new Error(error.message || 'Falha ao transferir conversa')
    }

    return true
  },

  /**
   * Atualiza o status da conversa (aberta, aguardando, resolvida, fechada).
   */
  async updateConversationStatus(
    conversationId: string,
    status: 'aberta' | 'aguardando' | 'resolvida' | 'fechada',
  ): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { error } = await supabase
      .from('conversations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (error) {
      throw new Error(error.message || 'Falha ao atualizar status da conversa')
    }

    return true
  },

  /**
   * Marca mensagens como lidas (zera contador nao_lidas).
   */
  async markAsRead(conversationId: string): Promise<void> {
    if (!isSupabaseConfigured) return

    try {
      await supabase
        .from('conversations')
        .update({
          nao_lidas: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    } catch (err) {
      console.warn('Erro ao zerar não lidas:', err)
    }
  },
}
