import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Building2,
  LayoutDashboard,
  Users,
  MessageSquare,
  KanbanSquare,
  Settings,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  Home,
  CheckCircle2,
  Calendar,
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
import { propertyService } from '@/services/propertyService'
import { clientService } from '@/services/clientService'
import type { Property, Client } from '@/types/crm'

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Imóveis', href: '/imoveis', icon: Building2 },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Interações', href: '/interacoes', icon: MessageSquare },
  { name: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{
    properties: Property[]
    clients: Client[]
  }>({ properties: [], clients: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Current page title
  const currentTitle = (() => {
    const path = location.pathname
    if (path === '/') return 'Dashboard'
    if (path.startsWith('/imoveis')) return 'Imóveis'
    if (path.startsWith('/clientes')) return 'Clientes'
    if (path.startsWith('/interacoes')) return 'Interações'
    if (path.startsWith('/pipeline')) return 'Pipeline de Vendas'
    if (path.startsWith('/configuracoes')) return 'Configurações'
    return 'KKJ Corretora'
  })()

  // Global search effect
  useEffect(() => {
    if (!globalSearch.trim() || globalSearch.length < 2) {
      setSearchResults({ properties: [], clients: [] })
      setShowSearchDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const [propsRes, clientsRes] = await Promise.all([
          propertyService.getProperties({ search: globalSearch, perPage: 4 }),
          clientService.getClients({ search: globalSearch, perPage: 4 }),
        ])
        setSearchResults({
          properties: propsRes.items,
          clients: clientsRes.items,
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
      title: 'Visita Agendada',
      desc: 'Rodrigo Mendonça na Casa na Granja Viana amanhã às 10h',
      time: 'Há 25 minutos',
      unread: true,
    },
    {
      id: 2,
      title: 'Proposta Enviada',
      desc: 'Minuta de compra enviada para Maria Clara Oliveira',
      time: 'Há 2 horas',
      unread: true,
    },
    {
      id: 3,
      title: 'Novo Lead',
      desc: 'Fernando Augusto cadastrado via portal',
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
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-[#1B2A4A]">
              KKJ Corretora
            </span>
            <span className="text-[11px] font-medium text-[#667085]">Gestão Imobiliária</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-[#667085] uppercase">
            Menu Principal
          </div>
          {navigationItems.map((item) => {
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
                      ? 'bg-[#1B2A4A] text-white shadow-sm'
                      : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#101828]'
                  }`
                }}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-[#667085]'}`} />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </div>

        {/* User profile footer */}
        <div className="border-t border-[#E4E7EC] p-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#F5F7FA] border border-[#E4E7EC]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B2A4A] text-white font-semibold text-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'KC'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#101828] truncate">
                  {user?.name || 'Corretor'}
                </span>
                <span className="text-[11px] text-[#667085] truncate">
                  {user?.email || 'admin@kkj.com.br'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sair"
              className="h-8 w-8 text-[#667085] hover:text-[#D92D20] hover:bg-white"
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
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="font-bold text-base text-[#1B2A4A]">KKJ Corretora</span>
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
              {navigationItems.map((item) => {
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
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium ${
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
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#101828]">
              {currentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Search */}
            <div className="relative w-44 sm:w-64 md:w-80" ref={searchContainerRef}>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
              <Input
                type="text"
                placeholder="Buscar imóveis ou clientes..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => {
                  if (searchResults.properties.length || searchResults.clients.length) {
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
                  ) : searchResults.properties.length === 0 &&
                    searchResults.clients.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#667085]">
                      Nenhum resultado encontrado para &ldquo;{globalSearch}&rdquo;
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {searchResults.properties.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                            Imóveis
                          </div>
                          {searchResults.properties.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setShowSearchDropdown(false)
                                setGlobalSearch('')
                                navigate('/imoveis')
                              }}
                              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-[#F5F7FA]"
                            >
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-[#1B2A4A]" />
                                <div className="text-xs">
                                  <p className="font-semibold text-[#101828] truncate">{p.title}</p>
                                  <p className="text-[11px] text-[#667085]">
                                    {p.address_neighborhood || p.address_city} • R${' '}
                                    {p.price.toLocaleString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-3 w-3 text-[#667085]" />
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.clients.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                            Clientes
                          </div>
                          {searchResults.clients.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setShowSearchDropdown(false)
                                setGlobalSearch('')
                                navigate('/clientes')
                              }}
                              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-[#F5F7FA]"
                            >
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-[#12B76A]" />
                                <div className="text-xs">
                                  <p className="font-semibold text-[#101828] truncate">
                                    {c.full_name}
                                  </p>
                                  <p className="text-[11px] text-[#667085]">
                                    {c.phone} {c.email ? `• ${c.email}` : ''}
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
                          {n.title === 'Visita Agendada' ? (
                            <Calendar className="h-3 w-3 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-[#12B76A]" />
                          )}
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
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'KC'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold text-[#101828]">
                      {user?.name || 'Corretor'}
                    </p>
                    <p className="text-[11px] text-[#667085] truncate">{user?.email}</p>
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E4E7EC] bg-white py-4 px-6 text-center text-xs text-[#667085]">
          <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              © {new Date().getFullYear()} KKJ Corretora — Sistema de Gestão Imobiliária & CRM.
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">Versão 1.0 • FASE 1</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
