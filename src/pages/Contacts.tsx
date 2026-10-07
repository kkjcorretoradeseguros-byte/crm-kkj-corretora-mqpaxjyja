import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Building2,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { contactService } from '@/services/contactService'
import { companyService } from '@/services/companyService'
import type { Contact, Company } from '@/types/crm'

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [cpf, setCpf] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [contRes, compRes] = await Promise.all([
        contactService.getContacts({ search }),
        companyService.getAllCompanies(),
      ])
      setContacts(contRes.items)
      setCompanies(compRes)
    } catch (err) {
      console.error('Failed to load contacts:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const openCreateModal = () => {
    setEditingContact(null)
    setName('')
    setPhone('')
    setEmail('')
    setPosition('')
    setCpf('')
    setCompanyId(companies[0]?.id || '')
    setNotes('')
    setError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact)
    setName(contact.name)
    setPhone(contact.phone)
    setEmail(contact.email || '')
    setPosition(contact.position || '')
    setCpf(contact.cpf || '')
    setCompanyId(contact.company_id || '')
    setNotes(contact.notes || '')
    setError(null)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !phone.trim()) {
      setError('Nome e celular/WhatsApp são obrigatórios.')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<Contact> = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        position: position.trim() || undefined,
        cpf: cpf.trim() || undefined,
        company_id: companyId || undefined,
        notes: notes.trim() || undefined,
      }

      if (editingContact) {
        await contactService.updateContact(editingContact.id, payload)
      } else {
        await contactService.createContact(payload)
      }
      setIsModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Erro ao salvar contato.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este contato?')) {
      try {
        await contactService.deleteContact(id)
        loadData()
      } catch (err) {
        console.error(err)
      }
    }
  }

  const exportCSV = () => {
    const headers = ['Nome', 'Celular/WhatsApp', 'E-mail', 'Cargo', 'Empresa', 'CPF']
    const rows = contacts.map((c) => [
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${c.email || ''}"`,
      `"${c.position || ''}"`,
      `"${c.expand?.company_id?.trade_name || ''}"`,
      `"${c.cpf || ''}"`,
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `contatos_kkj_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#101828]">Gestão de Contatos</h2>
          <p className="text-xs text-[#667085]">
            Cadastro de pessoas físicas, decisores de RH, sócios e titulares
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="text-xs border-[#E4E7EC] text-[#667085]"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B]"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Novo Contato
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-md relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
        <Input
          placeholder="Buscar por nome, telefone, e-mail ou cargo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs bg-white border-[#E4E7EC]"
        />
      </div>

      {/* Contacts Table */}
      <div className="bg-white dark:bg-card border border-[#E4E7EC] dark:border-border rounded-xl overflow-x-auto shadow-sm">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-100 dark:bg-muted" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#667085] dark:text-muted-foreground">
            Nenhum contato encontrado.
          </div>
        ) : (
          <Table className="min-w-[650px]">
            <TableHeader className="bg-[#F5F7FA]">
              <TableRow>
                <TableHead className="text-xs font-bold text-[#101828]">Nome</TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">
                  Telefone / WhatsApp
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">E-mail</TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">Cargo</TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">
                  Empresa Vinculada
                </TableHead>
                <TableHead className="text-xs font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className="text-xs">
                  <TableCell className="font-bold text-[#101828]">{contact.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-[#1B2A4A] font-medium">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      {contact.phone}
                    </span>
                  </TableCell>
                  <TableCell className="text-[#667085]">
                    {contact.email ? (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {contact.email}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-[#667085]">{contact.position || '—'}</TableCell>
                  <TableCell>
                    {contact.expand?.company_id ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px]">
                        <Building2 className="h-3 w-3 mr-1" />
                        {contact.expand.company_id.trade_name}
                      </Badge>
                    ) : (
                      <span className="text-[#667085]">Pessoa Física / Sem Empresa</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(contact)}
                        className="h-7 w-7 text-[#667085] hover:text-[#101828]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(contact.id)}
                        className="h-7 w-7 text-[#667085] hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              {editingContact ? 'Editar Contato' : 'Novo Contato'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Preencha as informações do contato
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3 py-2 text-xs">
            {error && (
              <div className="p-2 rounded bg-red-50 text-red-900 border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Nome Completo *</Label>
              <Input
                placeholder="Ex: Juliana Marques"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Celular / WhatsApp *</Label>
                <Input
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cargo / Função</Label>
                <Input
                  placeholder="Ex: Diretora de RH"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  placeholder="contato@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CPF (quando necessário)</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Empresa Vinculada</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione a empresa ou deixe vazio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Pessoa Física)</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                placeholder="Detalhes adicionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="bg-[#1B2A4A] text-white text-xs"
              >
                {saving ? 'Salvando...' : 'Salvar Contato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
