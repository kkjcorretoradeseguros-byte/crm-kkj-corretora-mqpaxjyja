import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Eye,
  SlidersHorizontal,
  Home,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  UploadCloud,
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { propertyService } from '@/services/propertyService'
import { clientService } from '@/services/clientService'
import { useRealtime } from '@/hooks/use-realtime'
import type { Property, PropertyType, PropertyStatus, TransactionType, Client } from '@/types/crm'

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PropertyType | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'ALL'>('ALL')
  const [transactionFilter, setTransactionFilter] = useState<TransactionType | 'ALL'>('ALL')
  const [bedroomsFilter, setBedroomsFilter] = useState<string>('ALL')

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Link client interest modal
  const [isLinkClientOpen, setIsLinkClientOpen] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [isLinking, setIsLinking] = useState(false)

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Apartamento' as PropertyType,
    transaction_type: 'Venda' as TransactionType,
    price: '',
    condominium_fee: '',
    iptu: '',
    area_m2: '',
    bedrooms: '',
    bathrooms: '',
    parking_spots: '',
    address_street: '',
    address_number: '',
    address_neighborhood: '',
    address_city: 'São Paulo',
    address_state: 'SP',
    address_cep: '',
    status: 'Disponível' as PropertyStatus,
  })
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null)

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await propertyService.getProperties({
        type: typeFilter,
        status: statusFilter,
        transactionType: transactionFilter,
        search,
        bedrooms: bedroomsFilter !== 'ALL' ? parseInt(bedroomsFilter, 10) : undefined,
        page,
        perPage: 12,
      })
      setProperties(res.items)
      setTotalPages(res.totalPages || 1)
      setTotalItems(res.totalItems)
    } catch (err) {
      console.error('Error fetching properties:', err)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, transactionFilter, search, bedroomsFilter, page])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  // Realtime updates
  useRealtime('properties', () => fetchProperties())

  const openCreateModal = () => {
    setIsEditing(false)
    setSelectedProperty(null)
    setFormData({
      title: '',
      description: '',
      type: 'Apartamento',
      transaction_type: 'Venda',
      price: '',
      condominium_fee: '',
      iptu: '',
      area_m2: '',
      bedrooms: '',
      bathrooms: '',
      parking_spots: '',
      address_street: '',
      address_number: '',
      address_neighborhood: '',
      address_city: 'São Paulo',
      address_state: 'SP',
      address_cep: '',
      status: 'Disponível',
    })
    setPhotoFiles(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  const openEditModal = (prop: Property) => {
    setIsEditing(true)
    setSelectedProperty(prop)
    setFormData({
      title: prop.title,
      description: prop.description || '',
      type: prop.type,
      transaction_type: prop.transaction_type,
      price: prop.price.toString(),
      condominium_fee: prop.condominium_fee?.toString() || '',
      iptu: prop.iptu?.toString() || '',
      area_m2: prop.area_m2?.toString() || '',
      bedrooms: prop.bedrooms?.toString() || '',
      bathrooms: prop.bathrooms?.toString() || '',
      parking_spots: prop.parking_spots?.toString() || '',
      address_street: prop.address_street || '',
      address_number: prop.address_number || '',
      address_neighborhood: prop.address_neighborhood || '',
      address_city: prop.address_city || '',
      address_state: prop.address_state || '',
      address_cep: prop.address_cep || '',
      status: prop.status,
    })
    setPhotoFiles(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  const openDetailModal = (prop: Property) => {
    setSelectedProperty(prop)
    setIsDetailOpen(true)
  }

  const openDeleteModal = (prop: Property) => {
    setSelectedProperty(prop)
    setIsDeleteOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.title.trim()) {
      setFormError('O título do imóvel é obrigatório.')
      return
    }

    const priceNum = parseFloat(formData.price)
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Informe um valor de preço válido.')
      return
    }

    setIsSaving(true)
    try {
      const data = new FormData()
      data.append('title', formData.title)
      data.append('description', formData.description)
      data.append('type', formData.type)
      data.append('transaction_type', formData.transaction_type)
      data.append('price', priceNum.toString())
      if (formData.condominium_fee) data.append('condominium_fee', formData.condominium_fee)
      if (formData.iptu) data.append('iptu', formData.iptu)
      if (formData.area_m2) data.append('area_m2', formData.area_m2)
      if (formData.bedrooms) data.append('bedrooms', formData.bedrooms)
      if (formData.bathrooms) data.append('bathrooms', formData.bathrooms)
      if (formData.parking_spots) data.append('parking_spots', formData.parking_spots)
      data.append('address_street', formData.address_street)
      data.append('address_number', formData.address_number)
      data.append('address_neighborhood', formData.address_neighborhood)
      data.append('address_city', formData.address_city)
      data.append('address_state', formData.address_state)
      data.append('address_cep', formData.address_cep)
      data.append('status', formData.status)

      if (photoFiles) {
        for (let i = 0; i < photoFiles.length; i++) {
          data.append('photos', photoFiles[i])
        }
      }

      if (isEditing && selectedProperty) {
        await propertyService.updateProperty(selectedProperty.id, data)
      } else {
        await propertyService.createProperty(data)
      }

      setIsFormOpen(false)
      fetchProperties()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setFormError(errObj.message || 'Falha ao salvar imóvel.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProperty) return
    setIsSaving(true)
    try {
      await propertyService.deleteProperty(selectedProperty.id)
      setIsDeleteOpen(false)
      fetchProperties()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      alert(errObj.message || 'Erro ao excluir imóvel.')
    } finally {
      setIsSaving(false)
    }
  }

  const openLinkClientModal = async () => {
    try {
      const allClients = await clientService.getAllClients()
      setClients(allClients)
      if (allClients.length > 0) {
        setSelectedClientId(allClients[0].id)
      }
      setIsLinkClientOpen(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleLinkClient = async () => {
    if (!selectedClientId || !selectedProperty) return
    setIsLinking(true)
    try {
      const client = clients.find((c) => c.id === selectedClientId)
      if (client) {
        const currentProps = client.interested_properties || []
        if (!currentProps.includes(selectedProperty.id)) {
          await clientService.updateClient(client.id, {
            interested_properties: [...currentProps, selectedProperty.id],
          })
        }
      }
      setIsLinkClientOpen(false)
      alert('Interesse do cliente associado com sucesso!')
    } catch (err) {
      console.error(err)
      alert('Falha ao associar interesse do cliente.')
    } finally {
      setIsLinking(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Disponível':
        return (
          <Badge className="bg-[#12B76A]/10 text-[#12B76A] hover:bg-[#12B76A]/20 border-[#12B76A]/30">
            Disponível
          </Badge>
        )
      case 'Vendido':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
            Vendido
          </Badge>
        )
      case 'Alugado':
        return (
          <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">
            Alugado
          </Badge>
        )
      case 'Reservado':
        return (
          <Badge className="bg-[#F79009]/10 text-[#F79009] hover:bg-[#F79009]/20 border-[#F79009]/30">
            Reservado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#101828]">
            Catálogo de Imóveis
          </h2>
          <p className="text-xs sm:text-sm text-[#667085]">
            Gerencie o inventário de vendas e locações da corretora ({totalItems} imóveis)
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo Imóvel
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="border-[#E4E7EC] shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
              <Input
                type="text"
                placeholder="Buscar por título, bairro, cidade..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-xs border-[#E4E7EC]"
              />
            </div>

            {/* Type */}
            <div>
              <Select
                value={typeFilter}
                onValueChange={(val) => {
                  setTypeFilter(val as PropertyType | 'ALL')
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 text-xs border-[#E4E7EC]">
                  <SelectValue placeholder="Tipo de Imóvel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Tipos</SelectItem>
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Terreno">Terreno</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Cobertura">Cobertura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val as PropertyStatus | 'ALL')
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 text-xs border-[#E4E7EC]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="Disponível">Disponível</SelectItem>
                  <SelectItem value="Reservado">Reservado</SelectItem>
                  <SelectItem value="Vendido">Vendido</SelectItem>
                  <SelectItem value="Alugado">Alugado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Type */}
            <div>
              <Select
                value={transactionFilter}
                onValueChange={(val) => {
                  setTransactionFilter(val as TransactionType | 'ALL')
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 text-xs border-[#E4E7EC]">
                  <SelectValue placeholder="Finalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Venda ou Aluguel</SelectItem>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Properties Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-80 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <Card className="border-dashed border-2 border-[#E4E7EC] p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <Home className="h-12 w-12 text-[#667085]/60" />
            <h3 className="text-base font-semibold text-[#101828]">Nenhum imóvel encontrado</h3>
            <p className="text-xs text-[#667085] max-w-sm">
              Tente ajustar os filtros ou adicione um novo imóvel para começar.
            </p>
            <Button onClick={openCreateModal} className="bg-[#1B2A4A] text-white text-xs mt-2">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Primeiro Imóvel
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => {
            const photoUrl =
              prop.photos && prop.photos.length > 0
                ? propertyService.getFileUrl(prop, prop.photos[0])
                : `https://img.usecurling.com/p/600/400?q=${encodeURIComponent(
                    prop.type === 'Casa' ? 'luxury house' : 'modern apartment',
                  )}`

            return (
              <div
                key={prop.id}
                className="group rounded-xl border border-[#E4E7EC] bg-white overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
              >
                {/* Image Banner */}
                <div
                  className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer"
                  onClick={() => openDetailModal(prop)}
                >
                  <img
                    src={photoUrl}
                    alt={prop.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute top-2.5 left-2.5">{getStatusBadge(prop.status)}</div>
                  <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {prop.transaction_type} • {prop.type}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="cursor-pointer" onClick={() => openDetailModal(prop)}>
                    <h3 className="font-bold text-base text-[#101828] line-clamp-1 hover:text-[#1B2A4A]">
                      {prop.title}
                    </h3>
                    <p className="text-xs text-[#667085] mt-1 line-clamp-1">
                      {prop.address_neighborhood
                        ? `${prop.address_neighborhood}, ${prop.address_city} - ${prop.address_state}`
                        : prop.address_city}
                    </p>

                    <div className="flex items-center gap-3 mt-3 text-xs text-[#667085]">
                      {prop.bedrooms !== undefined && <span>{prop.bedrooms} quartos</span>}
                      {prop.bathrooms !== undefined && <span>• {prop.bathrooms} banheiros</span>}
                      {prop.area_m2 !== undefined && <span>• {prop.area_m2} m²</span>}
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="mt-4 pt-3 border-t border-[#E4E7EC] flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-[#667085]">Valor</div>
                      <div className="text-base font-extrabold text-[#1B2A4A]">
                        R$ {prop.price.toLocaleString('pt-BR')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDetailModal(prop)}
                        title="Ver Detalhes"
                        className="h-8 w-8 text-[#667085] hover:text-[#1B2A4A]"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(prop)}
                        title="Editar"
                        className="h-8 w-8 text-[#667085] hover:text-[#1B2A4A]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteModal(prop)}
                        title="Excluir"
                        className="h-8 w-8 text-[#667085] hover:text-[#D92D20]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#E4E7EC]">
          <span className="text-xs text-[#667085]">
            Página {page} de {totalPages} ({totalItems} itens)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs border-[#E4E7EC]"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs border-[#E4E7EC]"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#101828]">
              {isEditing ? 'Editar Imóvel' : 'Cadastrar Novo Imóvel'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Preencha os dados técnicos e comerciais do imóvel
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-900 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="title" className="text-xs font-medium">
                  Título do Imóvel *
                </Label>
                <Input
                  id="title"
                  placeholder="Ex: Apartamento com 3 quartos nos Jardins"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="type" className="text-xs font-medium">
                  Tipo de Imóvel
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val as PropertyType })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apartamento">Apartamento</SelectItem>
                    <SelectItem value="Casa">Casa</SelectItem>
                    <SelectItem value="Terreno">Terreno</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Cobertura">Cobertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="transaction_type" className="text-xs font-medium">
                  Finalidade
                </Label>
                <Select
                  value={formData.transaction_type}
                  onValueChange={(val) =>
                    setFormData({ ...formData, transaction_type: val as TransactionType })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Aluguel">Aluguel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="price" className="text-xs font-medium">
                  Preço (R$) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="750000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs font-medium">
                  Status Comercial
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) =>
                    setFormData({ ...formData, status: val as PropertyStatus })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Reservado">Reservado</SelectItem>
                    <SelectItem value="Vendido">Vendido</SelectItem>
                    <SelectItem value="Alugado">Alugado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="condominium_fee" className="text-xs font-medium">
                  Condomínio (R$/mês)
                </Label>
                <Input
                  id="condominium_fee"
                  type="number"
                  step="0.01"
                  placeholder="850"
                  value={formData.condominium_fee}
                  onChange={(e) => setFormData({ ...formData, condominium_fee: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="iptu" className="text-xs font-medium">
                  IPTU (R$/ano)
                </Label>
                <Input
                  id="iptu"
                  type="number"
                  step="0.01"
                  placeholder="1200"
                  value={formData.iptu}
                  onChange={(e) => setFormData({ ...formData, iptu: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="area_m2" className="text-xs font-medium">
                  Área Útil (m²)
                </Label>
                <Input
                  id="area_m2"
                  type="number"
                  step="0.1"
                  placeholder="95"
                  value={formData.area_m2}
                  onChange={(e) => setFormData({ ...formData, area_m2: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bedrooms" className="text-xs font-medium">
                  Dormitórios
                </Label>
                <Input
                  id="bedrooms"
                  type="number"
                  placeholder="3"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bathrooms" className="text-xs font-medium">
                  Banheiros
                </Label>
                <Input
                  id="bathrooms"
                  type="number"
                  placeholder="2"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="parking_spots" className="text-xs font-medium">
                  Vagas de Garagem
                </Label>
                <Input
                  id="parking_spots"
                  type="number"
                  placeholder="2"
                  value={formData.parking_spots}
                  onChange={(e) => setFormData({ ...formData, parking_spots: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="description" className="text-xs font-medium">
                  Descrição Detalhada
                </Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Descreva pontos fortes, comodidades do condomínio, acabamentos..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-xs"
                />
              </div>

              {/* Endereço */}
              <div className="sm:col-span-2 pt-2 border-t border-[#E4E7EC]">
                <h4 className="text-xs font-bold text-[#101828] mb-2 uppercase tracking-wider">
                  Localização do Imóvel
                </h4>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address_street" className="text-xs font-medium">
                  Logradouro / Rua
                </Label>
                <Input
                  id="address_street"
                  placeholder="Rua Oscar Freire"
                  value={formData.address_street}
                  onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="address_number" className="text-xs font-medium">
                  Número
                </Label>
                <Input
                  id="address_number"
                  placeholder="1420"
                  value={formData.address_number}
                  onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="address_neighborhood" className="text-xs font-medium">
                  Bairro
                </Label>
                <Input
                  id="address_neighborhood"
                  placeholder="Cerqueira César"
                  value={formData.address_neighborhood}
                  onChange={(e) =>
                    setFormData({ ...formData, address_neighborhood: e.target.value })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="address_city" className="text-xs font-medium">
                  Cidade
                </Label>
                <Input
                  id="address_city"
                  placeholder="São Paulo"
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="address_state" className="text-xs font-medium">
                  Estado (UF)
                </Label>
                <Input
                  id="address_state"
                  placeholder="SP"
                  maxLength={2}
                  value={formData.address_state}
                  onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="address_cep" className="text-xs font-medium">
                  CEP
                </Label>
                <Input
                  id="address_cep"
                  placeholder="01426-001"
                  value={formData.address_cep}
                  onChange={(e) => setFormData({ ...formData, address_cep: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              {/* Foto Upload */}
              <div className="sm:col-span-2 space-y-1 pt-2">
                <Label htmlFor="photos" className="text-xs font-medium">
                  Fotos do Imóvel
                </Label>
                <Input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setPhotoFiles(e.target.files)}
                  className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-[#1B2A4A] file:text-white"
                />
                <p className="text-[11px] text-[#667085]">
                  Formatos aceitos: JPG, PNG, WEBP (máx. 5MB por foto).
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="text-xs border-[#E4E7EC]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white text-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Salvando...
                  </>
                ) : isEditing ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Imóvel'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PROPERTY DETAIL MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProperty && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedProperty.status)}
                  <Badge variant="outline" className="text-[10px]">
                    {selectedProperty.transaction_type}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedProperty.type}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-bold text-[#101828] mt-2">
                  {selectedProperty.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#667085]">
                  {selectedProperty.address_street
                    ? `${selectedProperty.address_street}, ${selectedProperty.address_number} - ${selectedProperty.address_neighborhood}, ${selectedProperty.address_city} - ${selectedProperty.address_state}`
                    : selectedProperty.address_city}
                </DialogDescription>
              </DialogHeader>

              {/* Image banner */}
              <div className="h-64 rounded-xl bg-slate-100 overflow-hidden relative">
                <img
                  src={
                    selectedProperty.photos && selectedProperty.photos.length > 0
                      ? propertyService.getFileUrl(selectedProperty, selectedProperty.photos[0])
                      : `https://img.usecurling.com/p/800/500?q=${encodeURIComponent(
                          selectedProperty.type === 'Casa'
                            ? 'luxury villa'
                            : 'modern apartment interior',
                        )}`
                  }
                  alt={selectedProperty.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Key Features */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#F5F7FA] border border-[#E4E7EC]">
                <div>
                  <span className="text-[11px] text-[#667085]">Preço</span>
                  <p className="text-base font-bold text-[#1B2A4A]">
                    R$ {selectedProperty.price.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#667085]">Área Útil</span>
                  <p className="text-sm font-semibold text-[#101828]">
                    {selectedProperty.area_m2 ? `${selectedProperty.area_m2} m²` : 'Não informada'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#667085]">Dormitórios / Banheiros</span>
                  <p className="text-sm font-semibold text-[#101828]">
                    {selectedProperty.bedrooms || 0} qts • {selectedProperty.bathrooms || 0} banhs
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#667085]">Vagas</span>
                  <p className="text-sm font-semibold text-[#101828]">
                    {selectedProperty.parking_spots || 0} vagas
                  </p>
                </div>
              </div>

              {/* Costs */}
              {(selectedProperty.condominium_fee || selectedProperty.iptu) && (
                <div className="flex items-center gap-6 text-xs text-[#667085]">
                  {selectedProperty.condominium_fee && (
                    <span>
                      Condomínio:{' '}
                      <strong>R$ {selectedProperty.condominium_fee.toLocaleString('pt-BR')}</strong>
                      /mês
                    </span>
                  )}
                  {selectedProperty.iptu && (
                    <span>
                      IPTU: <strong>R$ {selectedProperty.iptu.toLocaleString('pt-BR')}</strong>/ano
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedProperty.description && (
                <div>
                  <h4 className="text-xs font-bold text-[#101828] uppercase tracking-wider mb-1.5">
                    Descrição
                  </h4>
                  <p className="text-xs text-[#667085] leading-relaxed whitespace-pre-line">
                    {selectedProperty.description}
                  </p>
                </div>
              )}

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-[#E4E7EC]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openLinkClientModal}
                  className="text-xs border-[#1B2A4A] text-[#1B2A4A] hover:bg-blue-50"
                >
                  Associar ao Interesse de um Cliente
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailOpen(false)
                      openEditModal(selectedProperty)
                    }}
                    className="text-xs border-[#E4E7EC]"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDetailOpen(false)}
                    className="text-xs"
                  >
                    Fechar
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ASSOCIATE CLIENT INTEREST MODAL */}
      <Dialog open={isLinkClientOpen} onOpenChange={setIsLinkClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Vincular Interesse de Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Selecione qual cliente tem interesse neste imóvel ({selectedProperty?.title})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} ({c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLinkClientOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isLinking || !selectedClientId}
              onClick={handleLinkClient}
              className="bg-[#1B2A4A] text-white text-xs"
            >
              {isLinking ? 'Salvando...' : 'Confirmar Associação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#D92D20] flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Tem certeza que deseja remover o imóvel{' '}
              <strong className="text-[#101828]">{selectedProperty?.title}</strong>? Esta ação não
              poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleDelete}
              className="bg-[#D92D20] hover:bg-red-700 text-white text-xs"
            >
              {isSaving ? 'Excluindo...' : 'Sim, Excluir Imóvel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
