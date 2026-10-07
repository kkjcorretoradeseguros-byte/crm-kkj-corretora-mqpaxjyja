# Guia de Migração Supabase — CRM KK JEKABSON Corretora de Seguros (KKJ)

Este guia orienta o administrador da **KK JEKABSON Corretora de Seguros e Benefícios (KKJ)** no processo de execução e validação da migration SQL consolidada no painel Supabase do cliente.

---

## 1. Visão Geral e Arquitetura Consolidada V1

O schema foi projetado especificamente para as operações da **KKJ Corretora de Seguros e Benefícios**, especializada em planos de saúde (PME, PF, Adesão, Odonto) e seguros em geral (Vida, Auto, Consórcio e Patrimonial).

### Destaques da Estrutura:

- **Ordem de Execução Estrita (Resolução de Dependências para Instalação Clean):**
  1. Extensões (`uuid-ossp`, `pgcrypto`)
  2. Enums do Domínio (15 tipos enumerados)
  3. Tabela `public.profiles`
  4. Tabela de permissões granulares `permissions` e `user_permissions`
  5. Funções Helper de Autenticação/Autorização (`current_role`, `is_admin`, `is_gestor`, `is_vendedor`, `is_manager_or_admin`, `has_permission`)
  6. Demais Tabelas do Domínio KKJ (28 tabelas) na ordem rigorosa de Foreign Keys:
     - `carriers`, `products`, `carrier_products`, `companies`, `contacts`, `pipeline_stages`, `loss_reasons`, `task_types`
     - `opportunities`, `tasks`, FK circular de `proxima_tarefa_id` via ALTER TABLE
     - `opportunity_timeline`, `opportunity_assignments`, `opportunity_stage_history`
     - `contracts`, `commission_rules`, `bonus_campaigns`, `contract_financials`, `commission_installments`
     - `document_checklist_templates`, `document_checklist_items`, `post_sale_requests`
     - `custom_field_definitions`, `custom_field_values`, `user_preferences`, `audit_log`
     - `whatsapp_channels`, `message_templates`, `conversations`, `messages`
  7. Índices de Performance, Integridade e Busca Otimizada (GIN para `health_data` e `attribution`)
  8. Triggers Operacionais e de Negócio (`handle_updated_at`, `handle_new_user`, `check_profile_role_update`, `handle_opportunity_changes`, `handle_opportunity_creation`)
  9. Políticas de Row Level Security (RLS) habilitadas e ativas em TODAS as 28 tabelas
  10. RPC Financeira `get_meu_financeiro()` (SECURITY DEFINER, `SET search_path = ''`, execução revogada de PUBLIC e concedida exclusivamente a `authenticated`)
  11. Triggers de Auditoria Geral (`handle_audit_trigger` em 15 tabelas críticas)
  12. Seeds Idempotentes de Configuração Administrativa (Carriers, Produtos, Etapas, Motivos, Tarefas, Permissões, Templates e Canal)

---

## 2. Inventário Completo das 28 Tabelas do Banco de Dados

| #   | Tabela                         | Descrição e Finalidade                                                                                                                                 |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `profiles`                     | Perfil estendido dos usuários do CRM vinculado a `auth.users`. Possui coluna `recebe_leads_automaticos` para round-robin.                              |
| 2   | `permissions`                  | Catálogo de permissões granulares (`visualizar_todos_leads`, `redistribuir_leads`, etc.).                                                              |
| 3   | `user_permissions`             | Associação direta de permissões adicionais a gestores/vendedores sem alteração de código.                                                              |
| 4   | `carriers`                     | Operadoras de saúde e seguradoras parceiras (Amil, Bradesco, SulAmérica, etc.).                                                                        |
| 5   | `products`                     | Modalidades de seguros e planos de benefícios (Saúde PME, PF, Adesão, Odonto, Vida, Auto, Consórcio, Outros).                                          |
| 6   | `carrier_products`             | Associação configurável entre operadoras e produtos comercializados.                                                                                   |
| 7   | `companies`                    | Empresas clientes estipulantes de planos de saúde PJ / PME e apólices coletivas.                                                                       |
| 8   | `contacts`                     | Pessoas físicas, titulares ou interlocutores corporativos de empresas.                                                                                 |
| 9   | `pipeline_stages`              | Etapas operacionais dos dois funis (Funil de Vendas e Funil de Pós-Venda).                                                                             |
| 10  | `loss_reasons`                 | Motivos padronizados de encerramento sem fechamento no funil de vendas.                                                                                |
| 11  | `task_types`                   | Tipos parametrizáveis de tarefas comerciais e operacionais.                                                                                            |
| 12  | `opportunities`                | Entidade central dos negócios com saúde (`health_data`), atribuição de marketing (`attribution`), operadora (`carrier_id`) e responsável (`owner_id`). |
| 13  | `tasks`                        | Tarefas e compromissos operacionais vinculados a oportunidades e corretores.                                                                           |
| 14  | `opportunity_timeline`         | Timeline append-only para acompanhamento cronológico de ações e notas.                                                                                 |
| 15  | `opportunity_assignments`      | Histórico estruturado de mudanças de responsável (manual, round-robin, redistribuição).                                                                |
| 16  | `opportunity_stage_history`    | Histórico estruturado de transições de etapa com data de entrada, saída e duração para BI de funil sem parsing textual.                                |
| 17  | `contracts`                    | Contratos e apólices vigentes com dados de envio, implantação, vigência, cancelamento e alertas de renovação (90/60/30 dias).                          |
| 18  | `commission_rules`             | Regras configuráveis de comissionamento por operadora/produto/modalidade (percentual, valor fixo, múltiplos, parcelamento).                            |
| 19  | `bonus_campaigns`              | Campanhas de bonificação independentes da comissão comercial com metas e faixas.                                                                       |
| 20  | `contract_financials`          | **Tabela ultrassensível de comissões e margens da KKJ**. Restrita exclusivamente ao Administrador via RLS.                                             |
| 21  | `commission_installments`      | Detalhamento do cronograma de parcelas da comissão (previsto x recebido) da corretora e do vendedor.                                                   |
| 22  | `document_checklist_templates` | Templates de documentos exigidos configuráveis por tipo de produto comercializado.                                                                     |
| 23  | `document_checklist_items`     | Controle de status de documentação do cliente/contrato com links externos (sem binários pesados no PostgreSQL).                                        |
| 24  | `post_sale_requests`           | Solicitações operacionais de pós-venda (inclusão, exclusão, 2ª via, faturamento, reembolso, etc.) separadas do fluxo comercial.                        |
| 25  | `custom_field_definitions`     | Definição dinâmica de campos personalizados por produto (texto, moeda, número, data, seleção, múltipla seleção).                                       |
| 26  | `custom_field_values`          | Armazenamento flexível dos valores dos campos personalizados vinculados a oportunidades e contratos.                                                   |
| 27  | `user_preferences`             | Preferências do usuário: tema Claro/Escuro/Sistema, densidade visual e preferências de notificação.                                                    |
| 28  | `audit_log`                    | Auditoria append-only de alterações críticas no CRM acessível exclusivamente por administradores.                                                      |
| \*  | `whatsapp_channels`            | Canais e números de WhatsApp independentes de fornecedor (Meta, Z-API, Evolution, Baileys).                                                            |
| \*  | `message_templates`            | Templates de mensagem WhatsApp com substituição de tags ({nome}, {empresa}, {vendedor}, {operadora}, {data}).                                          |
| \*  | `conversations`                | Sessões de atendimento de WhatsApp vinculadas a canais, oportunidades e contatos.                                                                      |
| \*  | `messages`                     | Mensagens individuais com direção, status de entrega e metadados.                                                                                      |

---

## 3. Passo a Passo para Execução no Supabase SQL Editor

1. Acesse o console do seu projeto no Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. No menu lateral esquerdo, clique no ícone **SQL Editor**.
3. Clique em **+ New query**.
4. Abra o arquivo localizado no repositório:
   ```
   supabase/migrations/0001_kkj_initial_schema.sql
   ```
5. Copie **todo o conteúdo** do arquivo e cole no editor do Supabase.
6. Clique no botão verde **Run** (ou pressione `Ctrl + Enter` / `Cmd + Enter`).
7. Ao término, a mensagem `Success. No rows returned` será exibida.
8. Verifique as tabelas criadas clicando em **Table Editor** no menu lateral.

> **Nota de Idempotência:** O script foi construído com verificações `IF NOT EXISTS`, blocos `DO $$` condicionais e cláusulas `ON CONFLICT (...) DO UPDATE`. Caso precise reexecutá-lo, nenhuma informação de configuração será duplicada ou perdida.

---

## 4. Regras de Segurança e Proteção Financeira Invioláveis

### 4.1 Separação Física e RLS Estrita em `contract_financials`:

- A tabela `contract_financials` é **fisicamente separada** de `contracts`.
- As políticas de Row Level Security concedem acesso direto (SELECT, INSERT, UPDATE, DELETE) **exclusivamente a usuários administradores ativos (`public.is_admin()`)**.
- Nem corretores (vendedores) nem gestores comerciais têm permissão de `SELECT` direto em `contract_financials` via API PostgREST.

### 4.2 Como o Vendedor Consulta o Próprio Financeiro:

O corretor/vendedor consulta o seu extrato de repasses e bonificações exclusivamente chamando a função RPC segura:

```sql
SELECT contract_id, numero_contrato, valor_venda, repasse_vendedor, bonificacao_vendedor, total_a_receber
FROM public.get_meu_financeiro();
```

- A função foi compilada com `SECURITY DEFINER` e `SET search_path = ''`.
- Ela filtra internamente por `responsavel_id = auth.uid()` (ou retorna todos os contratos caso quem a chame seja um administrador).
- Ela retorna **apenas**: `contract_id`, `numero_contrato`, `vendedor_id`, `operadora`, `plano`, `valor_venda`, `repasse_vendedor`, `bonificacao_vendedor`, `total_a_receber`, `status_contrato`, `data_inicio_vigencia`, `data_pagamento`.
- Ela **jamais** expõe `faturamento_bruto`, `comissao_prevista`, `comissao_recebida`, `impostos_descontos`, `comissao_liquida`, `resultado_kkj` ou snapshots de comissão da corretora.
- O privilégio de execução foi revogado de `PUBLIC` e concedido estritamente a usuários autenticados (`TO authenticated`).

### 4.3 Criação de Usuários e Proteção de Perfil (Role):

- Todo novo signup no Supabase Auth dispara a trigger `on_auth_user_created`, criando a linha em `public.profiles` com papel padrão `'vendedor'`.
- Não existe auto-promoção ao primeiro usuário cadastrado.
- A trigger `trg_protect_profile_role` impede que qualquer usuário altere sua própria coluna `role`. Somente administradores ativos ou a chave de sistema `service_role` têm permissão de alterar o perfil de um usuário.

---

## 5. Procedimento de Bootstrap Inicial do Primeiro Administrador

Como todo usuário nasce como vendedor, após realizar o primeiro cadastro via Supabase Auth ou pela tela de Signup, execute o comando abaixo no **SQL Editor** substituindo pelo seu e-mail:

```sql
-- ==============================================================================
-- BOOTSTRAP: PROMOVER USUÁRIO ESPECÍFICO PARA ADMINISTRADOR
-- (Execute no SQL Editor após realizar o primeiro signup)
-- ==============================================================================
UPDATE public.profiles
SET role = 'administrador',
    updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('admin@kkjekabson.com.br')
  LIMIT 1
);

-- Verificar a promoção:
SELECT id, nome, email, role, ativo
FROM public.profiles
WHERE lower(email) = lower('admin@kkjekabson.com.br');
```

Caso queira promover um usuário para `'gestor'`, execute:

```sql
-- Promover usuário para Gestor Comercial
UPDATE public.profiles
SET role = 'gestor',
    updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('gestor@kkjekabson.com.br')
  LIMIT 1
);
```

---

## 6. Como Validar e Testar o Row Level Security (RLS) para os 3 Perfis

No **SQL Editor** do Supabase, você pode simular a sessão de qualquer usuário usando as instruções de impersonação de sessão do PostgreSQL:

### Teste 1: Administrador Lendo o Financeiro Global

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_ADMINISTRADOR", "role": "authenticated"}';

-- Administrador consulta a tabela sensível diretamente:
SELECT c.numero_contrato, c.valor_venda, f.faturamento_bruto, f.repasse_vendedor, f.resultado_kkj
FROM public.contracts c
JOIN public.contract_financials f ON f.contract_id = c.id;
-- Resultado esperado: Retorna todas as linhas com sucesso.
```

### Teste 2: Vendedor Tentando Acessar o Financeiro Sensível Direto (DEVE FALHAR)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_VENDEDOR", "role": "authenticated"}';

-- Vendedor tenta ler a tabela ultrassensível diretamente:
SELECT * FROM public.contract_financials;
-- Resultado esperado: Retorna 0 linhas (bloqueado pelo RLS, nenhum faturamento ou margem da KKJ vaza).

-- Vendedor consulta seu próprio extrato via RPC autorizada:
SELECT contract_id, numero_contrato, valor_venda, repasse_vendedor, bonificacao_vendedor, total_a_receber
FROM public.get_meu_financeiro();
-- Resultado esperado: Retorna apenas os contratos onde o vendedor é o responsável,
-- trazendo exclusivamente seu repasse, bonificação e total a receber.

-- Vendedor consulta oportunidades:
SELECT id, titulo, owner_id FROM public.opportunities;
-- Resultado esperado: Retorna apenas suas oportunidades (ou oportunidades sem responsável aguardando distribuição).
```

### Teste 3: Gestor Tentando Acessar o Financeiro Sensível Direto (DEVE FALHAR)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_GESTOR", "role": "authenticated"}';

-- Gestor tenta ler a tabela ultrassensível diretamente:
SELECT * FROM public.contract_financials;
-- Resultado esperado: Retorna 0 linhas (gestor não lê margens da corretora a menos que receba permissão especial expressa concedida pelo admin).

-- Gestor consulta oportunidades comerciais da equipe:
SELECT id, titulo, owner_id FROM public.opportunities;
-- Resultado esperado: Visualiza todas as oportunidades da equipe comercial para coordenação.
```

### Teste 4: Tentativa de Adulterar a Timeline (DEVE FALHAR)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_VENDEDOR", "role": "authenticated"}';

UPDATE public.opportunity_timeline
SET conteudo = 'Tentativa de adulteração de histórico'
WHERE id = 'UUID_QUALQUER';
-- Resultado esperado: Erro - "new row violates row-level security policy for table opportunity_timeline".
```

---

## 7. Formatos Estruturados de Dados (`health_data` e `attribution`)

### 7.1 Formato de `health_data` (JSONB indexado com GIN)

```json
{
  "possui_plano_atual": true,
  "operadora_atual": "Bradesco Saúde",
  "operadora_cotada": "Amil S750 / SulAmérica Especial 100",
  "cnpj": "12.345.678/0001-90",
  "razao_social": "Exemplo Serviços e Tecnologia Ltda",
  "qtd_vidas": 14,
  "idades": "0-18: 2, 19-23: 4, 24-28: 5, 29-33: 3",
  "cidade": "São Paulo",
  "estado": "SP",
  "valor_plano_atual": 18450.0,
  "tipo_contratacao": "PME Coparticipativo",
  "acomodacao": "Apartamento",
  "rede_desejada": "Hospital Sírio-Libanês, Albert Einstein e Laboratório Fleury",
  "objetivo": "Reduzir custo mantendo hospitais de ponta",
  "data_contratacao": "2021-04-10",
  "data_renovacao": "2025-04-10"
}
```

### 7.2 Formato de Atribuição de Marketing (`attribution` e colunas-chave)

A tabela `opportunities` possui tanto colunas indexadas diretas quanto o objeto JSONB `attribution` para acomodar Meta Ads, Google Ads, formulários de website e indicações:

```json
{
  "origem": "Meta Ads",
  "midia": "cpc",
  "campanha": "Campanha PME Saúde SP",
  "campaign_id": "meta_cmp_123456",
  "adset": "Decisores RH e Sócios 30-55",
  "adset_id": "meta_adset_78910",
  "anuncio": "Criativo Vídeo Dr. KKJ",
  "ad_id": "meta_ad_45678",
  "external_lead_id": "leadgen_999888777",
  "data_aquisicao": "2025-02-23T14:30:00Z",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "saude_pme_q1",
  "utm_content": "video_depoimento",
  "utm_term": "plano_saude_empresarial"
}
```

Isso viabiliza relatórios completos de ponta a ponta:
**Origem → Leads Recebidos → Qualificados → Cotações Apresentadas → Vendas Ganhas → Valor Vendido (Mensalidade) → Faturamento KKJ**.

---

## 8. Seeds Idempotentes de Configuração

A migration inclui apenas parâmetros de configuração operacional e administrativa:

- **8 Operadoras parceiras:** Amil, Bradesco Saúde, SulAmérica, Porto Seguro, Alice, Seguros Unimed, MedSênior, UniHosp.
- **8 Modalidades de produtos:** Saúde PME, Saúde PF, Adesão, Odontológico, Seguro de Vida, Seguro Auto, Consórcio, Outros.
- **7 Etapas do Funil de Vendas:** Novo Lead, Contato realizado, Qualificado, Cotação, Follow-up, Negociação, Venda ganha.
- **5 Etapas do Funil de Pós-Venda:** Documentação, Implantação, Aguardando pagamento, Implantado, Cliente ativo. _(Proibida a criação de etapa "Proposta na operadora")_.
- **9 Motivos de Perda:** Preço, Sem retorno, Fechou com concorrente, Sem CNPJ elegível, Quantidade de vidas, Carência, Rede inadequada, Desistiu, Outro.
- **9 Tipos de Tarefa:** Ligação, WhatsApp, Follow-up, Reunião, Cotação, Documentação, Implantação, Cobrança/Pagamento, Outro.
- **6 Permissões Granulares:** `visualizar_todos_leads`, `redistribuir_leads`, `visualizar_relatorios`, `visualizar_financeiro_interno`, `editar_configuracoes`, `administrar_usuarios`.
- **3 Templates de WhatsApp** com tags dinâmicas.
- **1 Canal de Atendimento WhatsApp** padrão.

Nenhum dado falso ou fictício de clientes ou negociações foi inserido. O banco estará limpo e pronto para a operação real.
