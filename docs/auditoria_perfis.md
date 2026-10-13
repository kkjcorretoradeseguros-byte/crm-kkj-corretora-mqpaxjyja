# Auditoria e Matriz de Permissões por Perfil — CRM KKJ Corretora

**Projeto:** CRM KKJ Corretora de Seguros & Benefícios  
**Versão Base:** v0.0.51 (commit `7c14775`)  
**Banco de Dados:** Supabase Produção (`https://bqlltqqnoexyhbtjrhzq.supabase.co`)  
**Migrations Aplicadas:** 0001, 0002, 0002_1, 0003, 0004 e 0005 (nenhuma migration adicional criada ou executada).  
**Data da Auditoria:** Fevereiro/2025

---

## 1. Identificação dos Perfis Auditados

| Papel             | Nome              | E-mail Oficial                            | Regra Hierárquica e Escopo                                                                                                                                                                                                                                                                                      |
| ----------------- | ----------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrador** | Administrador KKJ | `kkjcorretoradeseguros@gmail.com`         | Acesso global e irrestrito a todas as oportunidades, contratos, comissões, configurações, regras e exclusões.                                                                                                                                                                                                   |
| **Gestora**       | Nathany Jekabson  | `nathanyjekabson@gmail.com`               | Gestão de equipe comercial (inicialmente sem subordinados vinculados; comissão de gestão a 0%). Vê carteira própria e subordinados autorizados via `is_manager_of_seller()`. Não vê dados de vendedores vinculados diretamente ao Admin (ex.: Eliana). Não acessa Configurações nem confirma boletos de adesão. |
| **Vendedora**     | Eliana            | `elianacorretoradesegurossaude@gmail.com` | Vendedora vinculada diretamente ao Administrador. Vê estritamente seus próprios leads, contatos, empresas, oportunidades e contratos. RLS e UI blindam contra acesso a dados alheios.                                                                                                                           |

---

## 2. As 3 Correções Implementadas (Frontend)

Durante a auditoria estática dos fluxos de frontend e correspondência com as políticas RLS das migrations 0001–0005, foram sanados 3 problemas pontuais:

### Correção 1 — Normalização de Perfil Case-Insensitive (Uppercase / Lowercase)

- **Problema:** O Supabase armazena o perfil em minúsculas (`'administrador'`, `'gestor'`, `'vendedor'`), mas em `Financial.tsx` (`linhas ~45-47`), `Companies.tsx` (`linha ~153`) e `Contacts.tsx` (`linha ~154`), as verificações comparavam diretamente contra strings em maiúsculas (`user?.role === 'ADMINISTRADOR'`). Caso o profile viesse em minúsculas (como em sessões diretas do Supabase), a tela financeira não identificava o perfil e caía em fallback incorreto, e as páginas de contatos/empresas bloqueavam exclusões administrativas válidas.
- **Solução:** Aplicada a normalização `user?.role?.toUpperCase() === 'ADMINISTRADOR'` (e `'GESTOR'` / `'VENDEDOR'`), assegurando compatibilidade universal com o padrão já utilizado em `Index.tsx`.
- **Arquivos modificados:**
  - `src/pages/Financial.tsx`
  - `src/pages/Companies.tsx`
  - `src/pages/Contacts.tsx`

### Correção 2 — Restrição do Botão "Confirmar Pgto" de Boletos de Adesão (Exclusivo Administrador)

- **Problema:** Em `src/pages/Financial.tsx` (`linha ~589`), a condição `{b.status === 'pendente' && !isSeller && (` exibia o botão de confirmação de pagamento para gestores (Nathany). Porém, a política RLS `adesao_boletos_admin_write` (migration 0003) restringe `UPDATE/INSERT/DELETE` estritamente a administradores (`USING (public.is_admin())`). Se a gestora clicasse, receberia erro 403 Forbidden do Supabase.
- **Solução:** Alterado o gate de UI para `{b.status === 'pendente' && isAdmin && (`, alinhando a interface com a RLS do banco.
- **Arquivo modificado:**
  - `src/pages/Financial.tsx`

### Correção 3 — Blindagem de Rota e Menus de Configurações para Não-Administradores

- **Problema:**
  1. No menu lateral (`src/components/Layout.tsx`), o link "Configurações" estava visível para qualquer usuário autenticado (incluindo vendedora e gestora).
  2. No roteador (`src/App.tsx`), a rota `/configuracoes` estava protegida apenas por `ProtectedRoute` (autenticação), permitindo acesso direto à URL por não-administradores (embora o Supabase RLS bloqueasse as gravações).
- **Solução:**
  1. Em `src/components/ProtectedRoute.tsx`, criado o componente `AdminRoute`, que valida se `user?.role?.toUpperCase() === 'ADMINISTRADOR'` e redireciona não-administradores para `/`.
  2. Em `src/App.tsx`, a rota `configuracoes` foi envolvida em `<AdminRoute><SettingsPage /></AdminRoute>`.
  3. Em `src/components/Layout.tsx`, os links desktop, gaveta mobile e dropdown de perfil para `/configuracoes` foram condicionados a `user?.role?.toUpperCase() === 'ADMINISTRADOR'`.
- **Arquivos modificados:**
  - `src/components/ProtectedRoute.tsx`
  - `src/App.tsx`
  - `src/components/Layout.tsx`

---

## 3. Matriz de Auditoria das 10 Verificações + Isolamento Cruzado

**Legenda das classificações:**

- **APROVADO:** Auditado estaticamente com gate de UI presente E política RLS correspondente ativa nas migrations 0001–0005.
- **RESSALVA:** Identificada inconformidade que foi integralmente corrigida nesta intervenção.
- **NÃO TESTADO:** Depende de execução em runtime com logins reais das três contas (ambiente pendente de criação das credenciais reais no Supabase).

| #      | Verificação / Funcionalidade                      | Administrador (`kkjcorretoradeseguros@gmail.com`) | Gestora Nathany (`nathanyjekabson@gmail.com`) | Vendedora Eliana (`elianacorretoradesegurossaude@gmail.com`) | Fundamentação RLS e Frontend                                                                                                                                                                                                             |
| ------ | ------------------------------------------------- | ------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **Login & Navegação Geral**                       | APROVADO                                          | APROVADO                                      | APROVADO                                                     | Supabase Auth + `Layout.tsx` com navegação condicional.                                                                                                                                                                                  |
| **2**  | **Dashboard & Indicadores (5 dimensões)**         | APROVADO                                          | APROVADO                                      | APROVADO                                                     | `Index.tsx` possui visões segregadas: Admin vê global; Gestor possui seletor quadruplo (`minhas_vendas`, `minha_equipe`, `geral_gestao`, `por_vendedor`); Vendedora restrita a `assigned_to === user.id`.                                |
| **3**  | **Pipeline & Pós-Venda (Kanban/Lista)**           | APROVADO                                          | APROVADO                                      | APROVADO                                                     | RLS `opportunities_owner_all` e `opportunities_gestor_select/write` (migration 0004); Eliana vê só os próprios cards; Nathany vê próprios e subordinados (zero de Eliana).                                                               |
| **4**  | **Criação / Edição de Contatos e Empresas**       | RESSALVA (Corrigido)                              | RESSALVA (Corrigido)                          | RESSALVA (Corrigido)                                         | Criação e edição permitidas a todos. Exclusão de empresas e contatos restrita ao Admin (Corrigida normalização case-insensitive em `Companies.tsx` e `Contacts.tsx`).                                                                    |
| **5**  | **Conclusão de Vendas & Contratos (Venda Ganha)** | APROVADO                                          | APROVADO                                      | APROVADO                                                     | `VendaGanhaModal.tsx` e `contractService.createContractFromWonOpportunity`. RLS `contracts_owner_all` e `contracts_gestor_select`.                                                                                                       |
| **6**  | **Visualização e Confirmação do 1º Pagamento**    | RESSALVA (Corrigido)                              | RESSALVA (Corrigido)                          | APROVADO                                                     | RLS `adesao_boletos_admin_write` (migration 0003) restringe confirmação ao Admin. Botão "Confirmar Pgto" em `Financial.tsx` ajustado para exibir apenas para Admin. Gestora e vendedora apenas visualizam seus respectivos boletos.      |
| **7**  | **Implantação com e sem requisitos**              | APROVADO                                          | APROVADO                                      | APROVADO                                                     | Fluxo de checklist e pós-venda em `OpportunityDetailModal.tsx` e `Pipeline.tsx`. RLS `document_checklist_items` e `post_sale_requests`.                                                                                                  |
| **8**  | **Histórico & Tarefas Operacionais**              | APROVADO                                          | APROVADO                                      | APROVADO                                                     | `Tasks.tsx` e `taskService`. RLS `tasks_owner_all` e `tasks_gestor_select/write`. Histórico preservado na timeline.                                                                                                                      |
| **9**  | **Permissões Administrativas & Configurações**    | RESSALVA (Corrigido)                              | RESSALVA (Corrigido)                          | RESSALVA (Corrigido)                                         | Rota `/configuracoes` e menus protegidos por `AdminRoute` e `isAdmin` no frontend. RLS protege tabelas `commission_rules`, `system_settings`, `carriers`, `teams`.                                                                       |
| **10** | **Isolamento de Carteira e Financeiro Pessoal**   | RESSALVA (Corrigido)                              | RESSALVA (Corrigido)                          | RESSALVA (Corrigido)                                         | Normalização case-insensitive corrigida em `Financial.tsx`. RLS `get_meu_financeiro()` e `get_minhas_parcelas()` (SECURITY DEFINER, migration 0004).                                                                                     |
| **X**  | **Isolamento Cruzado Nathany vs Eliana**          | APROVADO                                          | APROVADO                                      | APROVADO                                                     | Como Eliana está vinculada diretamente ao Administrador (`team_members` não contém vínculo entre Eliana e equipe de Nathany), `public.is_manager_of_seller(eliana_id)` retorna FALSE para Nathany. Isolamento completo no banco e na UI. |

---

## 4. Roteiro Manual Passo a Passo por Perfil (Validação em Runtime)

Quando as credenciais reais das usuárias forem fornecidas/criadas no Supabase Auth, execute este roteiro:

### Roteiro 1: Administrador (`kkjcorretoradeseguros@gmail.com`)

1. Efetue login com as credenciais de Administrador.
2. Acesse o **Dashboard (`/`)**: confirme o banner "CRM Comercial" e verifique se o filtro de usuário permite selecionar "Toda a Corretora", Nathany ou Eliana.
3. Acesse o **Pipeline (`/pipeline`)**: verifique se oportunidades de todos os corretores são listadas no Kanban de Vendas e Pós-Venda.
4. Acesse **Empresas (`/empresas`)** e **Contatos (`/contatos`)**:
   - Confirme a presença do ícone de lixeira vermelha (Exclusão Administrativa).
   - Tente excluir um registro de teste informando o motivo quando solicitado.
5. Acesse o **Financeiro (`/financeiro`)**:
   - Verifique o badge **"Visão Global Administrador"**.
   - Na tabela de boletos de adesão pendentes, confirme a presença e funcionamento do botão **"Confirmar Pgto"**.
6. Acesse **Configurações (`/configuracoes`)**:
   - Verifique que o link está visível no menu lateral e que a página carrega todas as abas (Operadoras, Regras de Comissão, Equipes, Usuários).

---

### Roteiro 2: Gestora Nathany (`nathanyjekabson@gmail.com`)

1. Efetue login com o e-mail da Nathany.
2. Acesse o **Dashboard (`/`)**:
   - Confirme a presença do seletor **"Visão Gestão:"** com as 4 opções: "Geral sob minha gestão", "Minhas vendas (próprias)", "Minha equipe (subordinados)" e "Por vendedor específico".
   - Verifique que as opções de equipe retornam vazio ou apenas dados da própria Nathany (já que a vendedora Eliana não é sua subordinada).
3. Acesse o **Pipeline (`/pipeline`)**:
   - **Resultado Esperado de Isolamento Cruzado:** Nathany **NÃO** deve ver nenhum lead, oportunidade ou contrato pertencente a Eliana.
   - Nathany pode criar suas próprias oportunidades.
4. Acesse **Empresas (`/empresas`)** e **Contatos (`/contatos`)**:
   - Pode cadastrar e editar empresas e contatos.
   - O botão de exclusão (lixeira) **NÃO** deve ser exibido.
5. Acesse o **Financeiro (`/financeiro`)**:
   - Confirme o badge **"Visão da Equipe"**.
   - Na tabela de boletos de adesão pendentes, confirme que o botão **"Confirmar Pgto" NÃO é exibido**.
   - O card "Comissão de Gestão" deve indicar R$ 0,00 ("Comissão de gestão desativada 0%").
6. Tente acessar **Configurações**:
   - O link "Configurações" **NÃO** deve existir no menu lateral desktop, na gaveta mobile nem no menu de avatar.
   - Se digitar `/configuracoes` na barra do navegador, deve ser automaticamente redirecionada para a página inicial (`/`).

---

### Roteiro 3: Vendedora Eliana (`elianacorretoradesegurossaude@gmail.com`)

1. Efetue login com o e-mail da Eliana.
2. Acesse o **Dashboard (`/`)**:
   - O filtro de usuários e o seletor de gestão não devem estar disponíveis.
   - Os números refletem exclusivamente as oportunidades e contratos atribuídos a Eliana.
3. Acesse o **Pipeline (`/pipeline`)**:
   - Eliana só visualiza os seus próprios cards. Não vê leads de Nathany nem de outros corretores.
   - Ao mover oportunidade para "Venda ganha", pode preencher dados contratuais.
4. Acesse **Empresas (`/empresas`)** e **Contatos (`/contatos`)**:
   - Pode criar e editar.
   - O botão de exclusão (lixeira) **NÃO** é exibido.
5. Acesse o **Financeiro (`/financeiro`)**:
   - Confirme o badge **"Carteira Pessoal"**.
   - Exibe cards: "Meu Valor Vendido", "Comissão Pessoal Prevista", "Comissão Recebida / Liberada", "Pendente de Repasse".
   - Na tabela de boletos de adesão, o botão de confirmação **NÃO** é exibido.
6. Tente acessar **Configurações**:
   - Nenhum link visível no menu.
   - Navegação direta para `/configuracoes` redireciona para `/`.

---

## 5. Status de Verificação Técnica e QA

- **Análise Estática de Código (Oxlint):** Verde / sem erros.
- **Verificação de Tipos TypeScript (`tsc`):** Verde / zero erros de tipagem.
- **Build de Produção (Vite):** Compilação concluída com sucesso sem warnings de sintaxe.
- **Migrations:** Nenhuma migration foi criada ou alterada no diretório `supabase/migrations/` nem executada no banco. O schema e as RLS permanecem intactos.
- **Limitação Conhecida:** Conforme registrado na memória do projeto, os logins reais de Nathany e Eliana ainda não foram criados no Supabase Auth em produção. A validação funcional em runtime deve seguir o Roteiro Manual (Seção 4) assim que os acessos forem liberados pelo cliente.
