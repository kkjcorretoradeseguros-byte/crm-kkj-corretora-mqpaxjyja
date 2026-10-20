const parseBRL = (input: string): number => {
  const normalized = input.trim().replace(/\s/g, '').replace(/^R\$/, '')
  if (!normalized) return NaN
  const lastComma = normalized.lastIndexOf(',')
  const lastDot = normalized.lastIndexOf('.')
  const decimal = lastComma > lastDot ? ',' : '.'
  const numberText =
    decimal === ',' ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '')
  return Number(numberText)
}

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Opportunity, Carrier, Company, Contact } from '@/types/crm'

interface VendaGanhaModalProps {
  open: boolean
  onClose: () => void
  opportunity: Opportunity | null
  carriers: Carrier[]
  companies: Company[]
  contacts: Contact[]
  canConfirmPayment?: boolean
  onConfirm: (data: {
    origem_comercial_lead: 'kkj' | 'vendedor'
    contractedCarrierId: string
    contractedCarrierName: string
    contractedPlan: string
    contractedValue: number
    modalidade: string
    livesCount: number
    hiringDate: string
    firstInstallmentRef: string
    firstPaymentDueDate: string
    paymentConfirmedDate?: string
    isPaymentConfirmed?: boolean
    companyName: string
    cnpj: string
    contactName: string
    phone: string
    email: string
  }) => Promise<void>
}

export function VendaGanhaModal({
  open,
  onClose,
  opportunity,
  carriers,
  companies,
  contacts,
  onConfirm,
  canConfirmPayment = false,
}: VendaGanhaModalProps) {
  const [origemComercialLead, setOrigemComercialLead] = useState<'kkj' | 'vendedor' | ''>('')
  const [carrierId, setCarrierId] = useState('')
  const [contractedPlan, setContractedPlan] = useState('')
  const [contractedValue, setContractedValue] = useState('')
  const [modalidade, setModalidade] = useState('PME')
  const [livesCount, setLivesCount] = useState('1')
  const [hiringDate, setHiringDate] = useState(new Date().toISOString().slice(0, 10))
  const [firstInstallmentRef, setFirstInstallmentRef] = useState(
    new Date().toISOString().slice(0, 7),
  )
  // Marco 3: Vencimento do Primeiro Pagamento (editável)
  const [firstPaymentDueDate, setFirstPaymentDueDate] = useState(
    new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  )
  // Marco 4: Confirmação efetiva do pagamento
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false)
  const [paymentConfirmedDate, setPaymentConfirmedDate] = useState(
    new Date().toISOString().slice(0, 10),
  )

  // Dados cadastrais obrigatórios
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preenche dados existentes quando a oportunidade for aberta
  useEffect(() => {
    if (opportunity) {
      const comp =
        opportunity.expand?.company_id || companies.find((c) => c.id === opportunity.company_id)
      const cont =
        opportunity.expand?.contact_id || contacts.find((c) => c.id === opportunity.contact_id)

      setCompanyName(comp?.legal_name || comp?.trade_name || '')
      setCnpj(comp?.cnpj || '')
      setContactName(cont?.name || '')
      setPhone(cont?.phone || '')
      setEmail(cont?.email || '')

      setOrigemComercialLead('')
      setCarrierId(opportunity.carrier_id || carriers[0]?.id || '')
      setContractedPlan(opportunity.suggested_plan || '')
      setContractedValue(opportunity.sale_value ? String(opportunity.sale_value) : '')
      setLivesCount(
        opportunity.health_data?.lives_count ? String(opportunity.health_data.lives_count) : '1',
      )
      setFirstPaymentDueDate(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10))
      setIsPaymentConfirmed(false)
      setPaymentConfirmedDate(new Date().toISOString().slice(0, 10))
      setErrorMsg(null)
    }
  }, [opportunity, companies, contacts, carriers])

  // Validações
  const validateForm = () => {
    if (!origemComercialLead) return 'Informe se o lead foi gerado pela KKJ ou pelo vendedor.'
    if (!contactName.trim()) return 'Nome do cliente / titular é obrigatório.'
    if (modalidade !== 'PF' && !companyName.trim()) {
      return 'Razão Social / Nome da Empresa é obrigatório para esta modalidade.'
    }

    // CNPJ obrigatório para PME
    const cleanCnpj = cnpj.replace(/\D/g, '')
    if (modalidade === 'PME' && cleanCnpj.length !== 14) {
      return 'CNPJ válido com 14 dígitos é obrigatório para modalidade PME.'
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      return 'Telefone / WhatsApp válido com DDD é obrigatório.'
    }

    if (!email.trim() || !email.includes('@')) {
      return 'E-mail corporativo válido é obrigatório.'
    }

    if (!carrierId) {
      return 'Companhia / Operadora contratada é obrigatória.'
    }

    const numVal = parseBRL(contractedValue)
    if (!numVal || numVal <= 0) {
      return 'Valor real da mensalidade contratada deve ser maior que zero.'
    }

    if (!contractedPlan.trim()) {
      return 'Nome do plano contratado é obrigatório.'
    }

    if (!firstPaymentDueDate) {
      return 'Vencimento do primeiro pagamento é obrigatório.'
    }

    if (isPaymentConfirmed && !paymentConfirmedDate) {
      return 'Data de confirmação do pagamento é obrigatória quando marcada como confirmada.'
    }

    return null
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateForm()
    if (validation) {
      setErrorMsg(validation)
      return
    }

    setErrorMsg(null)
    setIsSubmitting(true)

    const selectedCarrier = carriers.find((c) => c.id === carrierId)
    const carrierName = selectedCarrier?.nome || 'Operadora Contratada'

    try {
      await onConfirm({
        origem_comercial_lead: origemComercialLead as 'kkj' | 'vendedor',
        contractedCarrierId: carrierId,
        contractedCarrierName: carrierName,
        contractedPlan: contractedPlan.trim(),
        contractedValue: parseBRL(contractedValue),
        modalidade,
        livesCount: parseInt(livesCount, 10) || 1,
        hiringDate,
        firstInstallmentRef,
        firstPaymentDueDate,
        paymentConfirmedDate: isPaymentConfirmed ? paymentConfirmedDate : undefined,
        isPaymentConfirmed,
        companyName: companyName.trim(),
        cnpj: cnpj.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao consolidar Venda Ganha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold text-[#101828] flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Conferência e Fechamento: Venda Ganha
          </DialogTitle>
          <DialogDescription className="text-xs text-[#667085]">
            Para concluir a venda, o cadastro completo e a confirmação das condições contratadas são
            obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4 py-2 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-900 border border-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <Label htmlFor="origem-comercial-lead" className="text-xs">
              Origem comercial do lead *
            </Label>
            <select
              id="origem-comercial-lead"
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
              value={origemComercialLead}
              onChange={(e) => setOrigemComercialLead(e.target.value as 'kkj' | 'vendedor' | '')}
              required
            >
              <option value="">Selecione a origem comercial</option>
              <option value="kkj">Lead fornecido pela KKJ</option>
              <option value="vendedor">Lead próprio / indicação do vendedor</option>
            </select>
          </div>

          {/* Dados Cadastrais Obrigatórios */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              1. Dados Cadastrais do Cliente (Obrigatórios)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Razão Social / Nome da Empresa {modalidade === 'PF' ? '(Opcional em PF)' : '*'}
                </Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={
                    modalidade === 'PF' ? 'Opcional para PF' : 'Ex: Jekabson Benefícios LTDA'
                  }
                  className="h-8 text-xs bg-white"
                  required={modalidade !== 'PF'}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  CNPJ {modalidade === 'PME' ? '* (Obrigatório em PME)' : '(Opcional em PF/Adesão)'}
                </Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="h-8 text-xs bg-white"
                  required={modalidade === 'PME'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Titular / Interlocutor *</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp *</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-mail *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com.br"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Condições Contratuais Efetivas */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
            <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
              2. Condições Contratadas Efetivas (Base de Comissões e Contrato)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Operadora Contratada *</Label>
                <Select value={carrierId} onValueChange={setCarrierId}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((car) => (
                      <SelectItem key={car.id} value={car.id}>
                        {car.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Plano Contratado *</Label>
                <Input
                  value={contractedPlan}
                  onChange={(e) => setContractedPlan(e.target.value)}
                  placeholder="Ex: Top Nacional Plus"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Modalidade *</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PME">Saúde PME</SelectItem>
                    <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                    <SelectItem value="Adesão">Adesão</SelectItem>
                    <SelectItem value="Odonto">Odontológico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mensalidade Real (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={contractedValue}
                  onChange={(e) => setContractedValue(e.target.value)}
                  placeholder="Ex: 1.816,00"
                  className="h-8 text-xs bg-white font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Qtd. de Vidas *</Label>
                <Input
                  type="number"
                  value={livesCount}
                  onChange={(e) => setLivesCount(e.target.value)}
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Contratação *</Label>
                <Input
                  type="date"
                  value={hiringDate}
                  onChange={(e) => setHiringDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Ref. 1ª Mensalidade *</Label>
                <Input
                  type="month"
                  value={firstInstallmentRef}
                  onChange={(e) => setFirstInstallmentRef(e.target.value)}
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>
            </div>

            {/* 4 Marcos Independentes: Vencimento e Confirmação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-emerald-950 flex items-center justify-between">
                  <span>Vencimento do 1º Pagamento *</span>
                  <span className="text-[10px] font-normal text-emerald-700">
                    (Boleto / Mensalidade)
                  </span>
                </Label>
                <Input
                  type="date"
                  value={firstPaymentDueDate}
                  onChange={(e) => setFirstPaymentDueDate(e.target.value)}
                  className="h-8 text-xs bg-white font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5 p-2 rounded-lg bg-white/70 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={canConfirmPayment && isPaymentConfirmed}
                      disabled={!canConfirmPayment}
                      onChange={(e) => setIsPaymentConfirmed(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>1º Pagamento Já Confirmado?</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {isPaymentConfirmed ? 'Confirmado' : 'Pendente'}
                  </span>
                </div>
                {isPaymentConfirmed && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] text-slate-700">
                      Data Efetiva da Confirmação:
                    </Label>
                    <Input
                      type="date"
                      value={paymentConfirmedDate}
                      onChange={(e) => setPaymentConfirmedDate(e.target.value)}
                      className="h-7 text-xs bg-white"
                      required={isPaymentConfirmed}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
              <strong>Atenção às regras financeiras:</strong> A simples vitória da oportunidade{' '}
              <em>NÃO</em> marca a comissão como recebida e nem antecipa repasses. Apenas registra
              os lançamentos previstos.
            </div>

            {modalidade === 'Adesão' && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                <strong>Regra KKJ para Adesão:</strong> A 1ª mensalidade de R${' '}
                {parseBRL(contractedValue || '0').toLocaleString('pt-BR')} será gerada como boleto
                integral KKJ (100% receita bruta da corretora). Nenhum repasse será feito à
                operadora referente a esta 1ª mensalidade.
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {isSubmitting ? 'Gerando Contrato...' : 'Concluir Venda Ganha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
