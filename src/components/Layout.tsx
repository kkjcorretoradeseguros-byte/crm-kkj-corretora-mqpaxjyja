import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Shield,
  LayoutDashboard,
  KanbanSquare,
  Users,
  Building2,
  CheckSquare,
  MessageSquare,
  DollarSign,
  Settings,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { companyService } from '@/services/companyService'
import { contactService } from '@/services/contactService'
import { opportunityService } from '@/services/opportunityService'
import type { Company, Contact, Opportunity } from '@/types/crm'

const mainNavigationItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { name: 'Contatos', href: '/contatos', icon: Users },
  { name: 'Empresas / Clientes', href: '/empresas', icon: Building2 },
  { name: 'Tarefas', href: '/tarefas', icon: CheckSquare },
  { name: 'Conversas', href: '/conversas', icon: MessageSquare },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{
    opportunities: Opportunity[]
    companies: Company[]
    contacts: Contact[]
  }>({ opportunities: [], companies: [], contacts: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Current page title and context info
  const currentTitle = (() => {
    const path = location.pathname
    if (path === '/') return 'Dashboard Comercial'
    if (path.startsWith('/pipeline')) return 'Pipeline de Vendas & Pós-Venda'
    if (path.startsWith('/contatos')) return 'Contatos'
    if (path.startsWith('/empresas')) return 'Empresas & Clientes'
    if (path.startsWith('/tarefas')) return 'Gestão de Tarefas'
    if (path.startsWith('/conversas')) return 'Conversas & WhatsApp'
    if (path.startsWith('/financeiro')) return 'Financeiro & Produção'
    if (path.startsWith('/configuracoes')) return 'Configurações do Sistema'
    return 'CRM KKJ Corretora'
  })()

  // Global search effect across opportunities, companies and contacts
  useEffect(() => {
    if (!globalSearch.trim() || globalSearch.length < 2) {
      setSearchResults({ opportunities: [], companies: [], contacts: [] })
      setShowSearchDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const [oppsRes, compRes, contRes] = await Promise.all([
          opportunityService.getOpportunities({ search: globalSearch, perPage: 3 }),
          companyService.getCompanies({ search: globalSearch, perPage: 3 }),
          contactService.getContacts({ search: globalSearch, perPage: 3 }),
        ])
        setSearchResults({
          opportunities: oppsRes.items,
          companies: compRes.items,
          contacts: contRes.items,
        })
        setShowSearchDropdown(true)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [globalSearch])

  // Click outside search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
    setShowSearchDropdown(false)
  }, [location.pathname])

  const notifications = [
    {
      id: 1,
      title: 'Cotação Pronta',
      desc: 'Cotação Bradesco vs Amil pronta para envio para Lumina Tech',
      time: 'Há 25 minutos',
      unread: true,
    },
    {
      id: 2,
      title: 'Pós-Venda em Andamento',
      desc: 'Fichas cadastrais recebidas para implantação na Bella Vita',
      time: 'Há 1 hora',
      unread: true,
    },
    {
      id: 3,
      title: 'Tarefa Pendente',
      desc: 'Cobrar relação de vidas com Carlos Eduardo da Andrade Log',
      time: 'Ontem',
      unread: false,
    },
  ]

  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <div className="flex min-h-screen bg-[#F5F7FA] text-[#101828] font-sans">
      {/* Desktop Sidebar (Fixed 260px) */}
      <aside className="hidden lg:flex w-[260px] flex-col fixed inset-y-0 z-30 border-r border-[#E4E7EC] bg-white">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-[#E4E7EC]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B2A4A] text-white shadow-sm">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-[#1B2A4A]">
              KKJ Corretora
            </span>
            <span className="text-[11px] font-medium text-[#667085]">Seguros & Benefícios</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-[#667085] uppercase">
            Operação do Corretor
          </div>
          {mainNavigationItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.href)

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive: isLinkActive }) => {
                  const active = item.href === '/' ? location.pathname === '/' : isLinkActive
                  return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#1B2A4A] text-white shadow-sm font-semibold'
                      : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#101828]'
                  }`
                }}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-[#667085]'}`} />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </div>

        {/* Visual separator for admin / settings */}
        <div className="px-3 py-2 border-t border-[#E4E7EC]">
          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#1B2A4A] text-white font-semibold'
                  : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#101828]'
              }`
            }
          >
            <Settings className="h-4.5 w-4.5 text-[#667085]" />
            <span>Configurações</span>
          </NavLink>
        </div>

        {/* User profile footer */}
        <div className="border-t border-[#E4E7EC] p-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#F5F7FA] border border-[#E4E7EC]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B2A4A] text-white font-semibold text-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'KJ'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#101828] truncate">
                  {user?.name || 'Corretor KKJ'}
                </span>
                <span className="text-[10px] text-[#667085] truncate">
                  {user?.role || 'ADMINISTRADOR'} • {user?.email || 'admin@kkj.com.br'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sair"
              className="h-8 w-8 text-[#667085] hover:text-[#D92D20] hover:bg-white shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white border-r border-[#E4E7EC]">
            <div className="flex h-16 items-center justify-between px-6 border-b border-[#E4E7EC]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B2A4A] text-white">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-base text-[#1B2A4A]">KKJ Corretora</span>
                  <span className="text-[10px] text-[#667085]">Seguros & Benefícios</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-8 w-8 text-[#667085]"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {mainNavigationItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.href)

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#1B2A4A] text-white'
                        : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#101828]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </NavLink>
                )
              })}

              <div className="pt-2 border-t border-[#E4E7EC]">
                <NavLink
                  to="/configuracoes"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#1B2A4A] text-white'
                        : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#101828]'
                    }`
                  }
                >
                  <Settings className="h-5 w-5" />
                  <span>Configurações</span>
                </NavLink>
              </div>
            </div>

            <div className="border-t border-[#E4E7EC] p-4">
              <Button
                variant="outline"
                onClick={logout}
                className="w-full justify-center gap-2 border-[#E4E7EC] text-[#D92D20] hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da conta</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-[260px]">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E4E7EC] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-[#667085]"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#101828]">
                {currentTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Search across Oportunidades, Empresas, Contatos */}
            <div className="relative w-44 sm:w-64 md:w-80" ref={searchContainerRef}>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
              <Input
                type="text"
                placeholder="Buscar oportunidades, empresas, contatos..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => {
                  if (
                    searchResults.opportunities.length ||
                    searchResults.companies.length ||
                    searchResults.contacts.length
                  ) {
                    setShowSearchDropdown(true)
                  }
                }}
                className="h-9 pl-9 pr-3 text-xs bg-[#F5F7FA] border-[#E4E7EC] focus-visible:ring-[#1B2A4A] rounded-lg"
              />

              {/* Global search result dropdown */}
              {showSearchDropdown && (
                <div className="absolute left-0 right-0 top-11 z-50 rounded-xl border border-[#E4E7EC] bg-white p-2 shadow-lg">
                  {isSearching ? (
                    <div className="p-3 text-center text-xs text-[#667085]">Buscando...</div>
                  ) : searchResults.opportunities.length === 0 &&
                    searchResults.companies.length === 0 &&
                    searchResults.contacts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#667085]">
                      Nenhum resultado encontrado para &ldquo;{globalSearch}&rdquo;
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {searchResults.opportunities.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                            Oportunidades
                          </div>
                          {searchResults.opportunities.map((op) => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => {
                                setShowSearchDropdown(false)
                                setGlobalSearch('')
                                navigate('/pipeline')
                              }}
                              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-[#F5F7FA]"
                            >
                              <div className="flex items-center gap-2">
                                <KanbanSquare className="h-4 w-4 text-[#1B2A4A]" />
                                <div className="text-xs">
                                  <p className="font-semibold text-[#101828] truncate">
                                    {op.title}
                                  </p>
                                  <p className="text-[10px] text-[#667085]">
                                    {op.stage} • R$ {(op.sale_value || 0).toLocaleString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-3 w-3 text-[#667085]" />
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.companies.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                            Empresas / Clientes
                          </div>
                          {searchResults.companies.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setShowSearchDropdown(false)
                                setGlobalSearch('')
                                navigate('/empresas')
                              }}
                              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-[#F5F7FA]"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-600" />
                                <div className="text-xs">
                                  <p className="font-semibold text-[#101828] truncate">
                                    {c.trade_name}
                                  </p>
                                  <p className="text-[10px] text-[#667085]">
                                    {c.city} - {c.state} {c.cnpj ? `• CNPJ ${c.cnpj}` : ''}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-3 w-3 text-[#667085]" />
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.contacts.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                            Contatos
                          </div>
                          {searchResults.contacts.map((ct) => (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() => {
                                setShowSearchDropdown(false)
                                setGlobalSearch('')
                                navigate('/contatos')
                              }}
                              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-[#F5F7FA]"
                            >
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-emerald-600" />
                                <div className="text-xs">
                                  <p className="font-semibold text-[#101828] truncate">{ct.name}</p>
                                  <p className="text-[10px] text-[#667085]">
                                    {ct.phone} {ct.position ? `• ${ct.position}` : ''}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-3 w-3 text-[#667085]" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notifications Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-lg border border-[#E4E7EC] text-[#667085] hover:bg-[#F5F7FA]"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#D92D20] text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="flex items-center justify-between py-1.5">
                  <span className="font-bold text-xs text-[#101828]">Notificações</span>
                  <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                    {unreadCount} novas
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-1.5 py-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-lg text-xs transition-colors ${
                        n.unread ? 'bg-[#F5F7FA]' : 'hover:bg-[#F5F7FA]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#101828] flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[#667085]">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-[#667085] leading-relaxed">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B2A4A] text-xs font-semibold text-white shadow-sm ring-2 ring-[#E4E7EC] hover:ring-[#1B2A4A] transition"
                >
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'KJ'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold text-[#101828]">
                      {user?.name || 'Corretor KKJ'}
                    </p>
                    <p className="text-[11px] text-[#667085] truncate">{user?.email}</p>
                    <Badge variant="outline" className="w-fit text-[10px] mt-1 font-mono">
                      {user?.role || 'ADMINISTRADOR'}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                  <Settings className="mr-2 h-4 w-4 text-[#667085]" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-[#D92D20] focus:text-[#D92D20]">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E4E7EC] bg-white py-4 px-6 text-center text-xs text-[#667085]">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-emerald-600 inline" />
              <span>
                © {new Date().getFullYear()} KK JEKABSON Corretora de Seguros (KKJ) — CRM de Seguros
                & Benefícios.
              </span>
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Ambiente Seguro • Seguros & Benefícios
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
