import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

/**
 * Confirmação individual de recebimento de parcelas previstas de comissão.
 * A confirmação é feita exclusivamente pela função transacional do Supabase
 * `confirm_commission_installment_receipt(p_installment_id, p_receipt_date)`,
 * que valida permissões (RLS/admin), idempotência e integridade no banco.
 * Nenhum repasse de vendedora é alterado por esta operação.
 */
export const installmentReceiptService = {
  async confirmReceipt(installmentId: string, receiptDate: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    if (!installmentId?.trim()) throw new Error('Parcela inválida')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
      throw new Error('Informe uma data de recebimento válida (AAAA-MM-DD).')
    }

    const { error } = await supabase.rpc('confirm_commission_installment_receipt', {
      p_installment_id: installmentId,
      p_receipt_date: receiptDate,
    })

    if (error) {
      const raw = error.message || String(error)
      // Função ausente no banco: sinalizar ao usuário em vez de improvisar.
      if (/PGRST202|Could not find the function|does not exist|schema cache/i.test(raw)) {
        throw new Error(
          'A função confirm_commission_installment_receipt não foi encontrada no Supabase. ' +
            'Solicite ao administrador a criação dela no banco antes de confirmar recebimentos.',
        )
      }
      // Parcela já confirmada: bloquear duplicidade com mensagem clara.
      if (/already|já foi|ja foi|dupl/i.test(raw)) {
        throw new Error('Esta parcela já foi confirmada como recebida.')
      }
      throw new Error('Falha ao confirmar o recebimento da parcela: ' + raw)
    }
  },
}
