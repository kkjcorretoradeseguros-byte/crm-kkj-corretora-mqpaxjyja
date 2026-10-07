# Guia de Migração Supabase — CRM KK JEKABSON Corretora de Seguros (KKJ)

Este guia orienta o administrador da **KK JEKABSON Corretora de Seguros e Benefícios (KKJ)** no processo de execução e validação da migration SQL consolidada (`supabase/migrations/0001_kkj_initial_schema.sql`) no painel Supabase do cliente.

---

## 1. Visão Geral e Arquitetura Consolidada V1

O schema foi projetado especificamente para as operações da **KKJ Corretora de Seguros e Benefícios**, especializada em planos de saúde (PME, PF, Adesão, Odonto) e seguros em geral (Vida, Auto, Consórcio e Riscos Diversos).

### Destaques da Estrutura e Ordem Linear de Instalação Limpa (Clean Install):

1. **Extensões**: `uuid-ossp` e `pgcrypto`.
2. **Enums do Domínio**: 17 tipos enumerados (`user_role`, `funnel_type`, `temperature`, `task_status`, `task_type`, `opp_status`, `doc_status`, `contract_status`, `timeline_action_type`, `message_direction`, `message_delivery_status`, `assignment_origin`, `post_sale_type`, `post_sale_status`, `calc_type`, `custom_field_type`, `custom_field_target`).
3. **Tabela 1: `public.profiles`**: criada antes das funções helper para evitar qualquer erro de relação inexistente (`relation public.profiles does not exist`).
4. **Tabelas 2 e 3: Permissões Granulares**: `permissions` e `user_permissions`.
5. **Funções Helper SECURITY DEFINER**: (`current_role`, `is_admin`, `is_gestor`, `is_vendedor`, `is_manager_or_admin`, `has_permission`) compiladas com `SET search_path = ''` e objetos schema-qualified.
6. **Tabelas do Domínio KKJ (29 tabelas seguintes, totalizando EXATAMENTE 32 TABELAS)** na ordem rigorosa de dependências de chaves estrangeiras:
   - `carriers`, `products`, `carrier_products`, `companies`, `contacts`, `pipeline_stages`, `loss_reasons`, `task_types`
   - `opportunities`, `tasks`, FK circular de `proxima_tarefa_id` via `ALTER TABLE` posterior
   - `opportunity_timeline`, `opportunity_assignments`, `opportunity_stage_history`
   - `contracts`, `commission_rules`, `bonus_campaigns`, `contract_financials`, `commission_installments`
   - `document_checklist_templates`, `document_checklist_items`, `post_sale_requests`
   - `custom_field_definitions`, `custom_field_values`, `user_preferences`, `audit_log`
   - `whatsapp_channels`, `message_templates`, `conversations`, `messages`
7. **Índices de Performance, Integridade e Busca Indexada**: GIN para `health_data` e `attribution`; índices únicos parciais para evitar concorrência (`uq_stage_history_active`, `uq_cfv_definition_opportunity`, etc.).
8. **Triggers Operacionais e de Negócio**:
   - `handle_updated_at`: atualização automática do carimbo de data/hora.
   - `handle_new_user`: signup cria profile que nasce SEMPRE como vendedor (`'vendedor'`).
   - `check_profile_role_update`: impede alteração de `role` por não-administrador.
   - `validate_opportunity_rules`: integridade de stage/funnel, exigência de `loss_reason_id` em status 'perdida' e bloqueio real no banco de autotransferência de leads por corretores.
   - `validate_custom_field_target`: garantia de coerência entre o alvo da definição e a FK informada.
   - `handle_opportunity_changes` e `handle_opportunity_creation`: registro automático na timeline e no histórico estruturado de etapas/atribuições.
9. **Políticas de Row Level Security (RLS)**: habilitadas e ativas em TODAS as 32 tabelas com `USING` e `WITH CHECK` explícitos.
10. **Funções RPC Financeiras Seguras (SECURITY DEFINER)**:
    - `get_meu_financeiro()`: extrato consolidado de contratos do corretor responsável com JOIN exclusivo em `carriers` (sem coluna textual legada).
    - `get_minhas_parcelas()`: extrato detalhado de repasses de parcelas do vendedor sem conceder SELECT direto em `commission_installments`.
11. **Triggers de Auditoria Append-Only**: `handle_audit_trigger` em tabelas críticas, sem DELETE/UPDATE e sem permissão direta de INSERT por usuários comuns.
12. **Seeds Idempotentes**: 8 Operadoras, 8 Produtos com descrição neutra em PME, 7 Etapas de Vendas, 5 Etapas de Pós-Venda (sem etapa 'Proposta na operadora'), 9 Motivos de Perda, 9 Tipos de Tarefa, 6 Permissões e 3 Templates WhatsApp. O canal `whatsapp_channels` inicia VAZIO, sem nenhum número de telefone fictício.

---

## 2. Inventário Completo das 32 Tabelas do Banco de Dados

| #   | Tabela                         | Descrição e Finalidade                                                                                                                              |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `profiles`                     | Perfil estendido vinculado a `auth.users`. RLS sem recursão e proteção de papel (`role`) por trigger e policy.                                      |
| 2   | `permissions`                  | Catálogo de permissões granulares (`visualizar_todos_leads`, `redistribuir_leads`, etc.).                                                           |
| 3   | `user_permissions`             | Associação de permissões adicionais a gestores/vendedores sem alteração de código.                                                                  |
| 4   | `carriers`                     | Operadoras de saúde e seguradoras parceiras (Amil, Bradesco Saúde, SulAmérica, Porto Seguro, Alice, Seguros Unimed, MedSênior, UniHosp).            |
| 5   | `products`                     | Modalidades de seguros e benefícios (Saúde PME, PF, Adesão, Odonto, Vida, Auto, Consórcio, Outros).                                                 |
| 6   | `carrier_products`             | Associação configurável entre operadoras e produtos comercializados.                                                                                |
| 7   | `companies`                    | Empresas clientes estipulantes de planos de saúde PJ / PME e apólices coletivas. `created_by` restrito a `auth.uid()`.                              |
| 8   | `contacts`                     | Pessoas físicas, titulares ou interlocutores corporativos de empresas. `created_by` restrito a `auth.uid()`.                                        |
| 9   | `pipeline_stages`              | Etapas operacionais dos dois funis (Vendas: 7 etapas; Pós-Venda: 5 etapas).                                                                         |
| 10  | `loss_reasons`                 | Motivos padronizados de encerramento sem fechamento no funil de vendas (9 motivos).                                                                 |
| 11  | `task_types`                   | Tipos parametrizáveis de tarefas comerciais e operacionais (9 tipos).                                                                               |
| 12  | `opportunities`                | Entidade central dos negócios. Possui `carrier_id` (cotada), `current_carrier_id` (anterior), `attribution` e dados de saúde (`health_data`).       |
| 13  | `tasks`                        | Tarefas e follow-ups operacionais vinculados a oportunidades e corretores.                                                                          |
| 14  | `opportunity_timeline`         | Timeline append-only para acompanhamento cronológico de ações e notas. Sem UPDATE/DELETE para usuários.                                             |
| 15  | `opportunity_assignments`      | Histórico estruturado de mudanças de responsável (manual, round-robin, redistribuição).                                                             |
| 16  | `opportunity_stage_history`    | Histórico estruturado de transições de etapa com índice parcial `uq_stage_history_active` garantindo uma única etapa aberta por oportunidade.       |
| 17  | `contracts`                    | Contratos e apólices vigentes. Nome da operadora obtido EXCLUSIVAMENTE via FK `carrier_id` (coluna legado `operadora TEXT` removida).               |
| 18  | `commission_rules`             | Regras configuráveis de comissionamento por operadora/produto/modalidade (percentual, valor fixo, múltiplos, parcelamento).                         |
| 19  | `bonus_campaigns`              | Campanhas de bonificação independentes da comissão comercial com metas e faixas.                                                                    |
| 20  | `contract_financials`          | **Tabela ultrassensível de faturamento e margens da KKJ**. Restrita EXCLUSIVAMENTE ao Administrador ativo via RLS.                                  |
| 21  | `commission_installments`      | Cronograma de parcelas com integridade referencial composta ao contrato. Restrita a Admin via RLS (vendedor consulta via RPC).                      |
| 22  | `document_checklist_templates` | Templates de documentos exigidos configuráveis por tipo de produto comercializado.                                                                  |
| 23  | `document_checklist_items`     | Controle de documentação com links externos e constraint `chk_checklist_item_target` impedindo itens órfãos.                                        |
| 24  | `post_sale_requests`           | Solicitações operacionais de pós-venda (inclusão, exclusão, 2ª via, faturamento, reembolso, etc.) com constraint de prioridade.                     |
| 25  | `custom_field_definitions`     | Definição dinâmica de campos personalizados por produto e alvo (`oportunidade` ou `contrato`).                                                      |
| 26  | `custom_field_values`          | Valores dinâmicos com integridade referencial: FKs `opportunity_id` e `contract_id` com CHECK garantindo exatamente um alvo preenchido.             |
| 27  | `user_preferences`             | Preferências do usuário: tema Claro/Escuro/Sistema com CHECK, densidade visual e preferências de notificação.                                       |
| 28  | `audit_log`                    | Auditoria append-only de alterações críticas no CRM acessível exclusivamente por administradores; gravação exclusiva por triggers SECURITY DEFINER. |
| 29  | `whatsapp_channels`            | Canais de WhatsApp cadastrados no CRM. Inicia vazio sem números de telefone fictícios.                                                              |
| 30  | `message_templates`            | Templates de mensagem WhatsApp com substituição de tags e CHECK em `modo_disparo`.                                                                  |
| 31  | `conversations`                | Sessões de atendimento de WhatsApp com CHECK em `status`. Sessões sem responsável visíveis apenas para gestor/admin ou com permissão expressa.      |
| 32  | `messages`                     | Mensagens individuais enviadas e recebidas com metadados de entrega.                                                                                |

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
8. Verifique as 32 tabelas criadas clicando em **Table Editor** no menu lateral.

> **Nota de Idempotência e Limpeza:** Este script foi desenhado primariamente para **instalação limpa (clean install)** em um banco Supabase recém-criado. Instruções `CREATE TABLE IF NOT EXISTS` garantem não duplicar tabelas, mas não alteram nem migram colunas de tabelas existentes. Em caso de reexecução corretiva em bancos que já possuam schemas antigos, recomenda-se executar em banco limpo.

---

## 4. Regras de Segurança e Proteção Financeira Invioláveis

### 4.1 Separação Física e RLS Estrita em `contract_financials` e `commission_installments`:

- As tabelas `contract_financials` e `commission_installments` são **fisicamente separadas** de `contracts`.
- As políticas de Row Level Security concedem acesso direto (SELECT, INSERT, UPDATE, DELETE) **exclusivamente a usuários administradores ativos (`public.is_admin()`)**.
- Nem corretores (vendedores) nem gestores comerciais têm permissão de `SELECT` direto em `contract_financials` ou `commission_installments` via API PostgREST.

### 4.2 Como o Vendedor Consulta o Próprio Financeiro de Forma Segura:

O corretor/vendedor consulta o seu extrato de repasses e parcelas exclusivamente chamando as funções RPC seguras:

1. **Extrato Consolidado por Contrato:**

```sql
SELECT contract_id, numero_contrato, vendedor_id, operadora, plano, valor_venda, repasse_vendedor, bonificacao_vendedor, total_a_receber, status_contrato, data_inicio_vigencia, data_pagamento
FROM public.get_meu_financeiro();
```

2. **Cronograma de Parcelas do Vendedor:**

```sql
SELECT contract_id, numero_contrato, numero_parcela, total_parcelas, data_vencimento, repasse_previsto_vendedor, repasse_pago_vendedor, data_repasse, status, bonificacao_vendedor
FROM public.get_minhas_parcelas();
```

- Ambas as funções foram compiladas com `SECURITY DEFINER` e `SET search_path = ''`.
- Filtram internamente por `c.responsavel_id = auth.uid()` (ou retornam todos caso quem a chame seja um administrador).
- **NUNCA** expõem `faturamento_bruto`, `comissao_prevista`, `comissao_recebida`, `impostos_descontos`, `comissao_liquida`, `resultado_kkj` ou snapshots de comissão da corretora.
- O privilégio de execução foi revogado de `PUBLIC` e concedido estritamente a usuários autenticados (`TO authenticated`).

### 4.3 Criação de Usuários e Proteção de Perfil (Role):

- Todo novo signup no Supabase Auth dispara a trigger `on_auth_user_created`, criando a linha em `public.profiles` com papel padrão `'vendedor'`.
- Não existe promoção automática do primeiro usuário nem auto-promoção por API.
- A trigger `trg_protect_profile_role` e a policy de `UPDATE` em `public.profiles` impedem que qualquer usuário altere sua própria coluna `role`. Somente administradores ativos têm permissão de alterar o perfil de um usuário.

---

## 5. Procedimento de Bootstrap Inicial do Primeiro Administrador

Como todo usuário nasce como vendedor e não existe backdoor nem auto-promoção, realize o cadastro do seu usuário no Supabase Auth (via Dashboard ou pela tela de Signup do sistema).

Em seguida, execute no **SQL Editor** do Supabase o comando manual abaixo, substituindo pelo e-mail exato cadastrado:

```sql
-- ==============================================================================
-- BOOTSTRAP: PROMOVER O PRIMEIRO USUÁRIO PARA ADMINISTRADOR
-- (Execute manualmente no SQL Editor do Supabase após o primeiro signup)
-- Funciona mesmo quando NÃO existe nenhum administrador no banco ainda.
-- ==============================================================================
UPDATE public.profiles
SET role = 'administrador',
    updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim('admin@kkjekabson.com.br'))
  LIMIT 1
);

-- Verificar se a promoção foi aplicada com sucesso:
SELECT id, nome, email, role, ativo
FROM public.profiles
WHERE lower(trim(email)) = lower(trim('admin@kkjekabson.com.br'));
```

Caso deseje criar um Gestor Comercial diretamente:

```sql
UPDATE public.profiles
SET role = 'gestor',
    updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim('gestor@kkjekabson.com.br'))
  LIMIT 1
);
```

---

## 6. Integridade de Dados, Normalização e Decisões de Arquitetura

### 6.1 Autenticação Baseada em E-mail (V1):

A versão 1 do CRM KKJ adota autenticação estritamente baseada em e-mail (`profiles.email NOT NULL`, vinculado a `auth.users(email)`). Qualquer suporte futuro a signup por telefone celular ou WhatsApp exigirá adaptações no fluxo de credenciais do Supabase Auth.

### 6.2 Normalização de CNPJ, CPF e Telefones:

A coluna `companies.cnpj` possui constraint de unicidade (`UNIQUE`), enquanto `contacts.cpf` não possui unicidade absoluta para comportar interlocutores compartilhados ou dependentes.
**Regra obrigatória de aplicação:** Os serviços de frontend e integrações devem sempre persistir CNPJs, CPFs e números de telefone no formato **normalizado (somente dígitos numéricos)**, evitando divergências causadas por máscaras de formatação como pontos, barras ou traços.

### 6.3 Estratégia de Deleção e Preservação de Histórico (Append-Only):

- A deleção física (`DELETE`) de oportunidades e contratos é estritamente restrita a administradores (`public.is_admin()`).
- Tabelas de auditoria e linha do tempo (`audit_log`, `opportunity_timeline`, `opportunity_stage_history`, `opportunity_assignments`) são **append-only reais**: não possuem políticas de UPDATE ou DELETE para corretores ou gestores, assegurando a rastreabilidade integral da carteira.

---

## 7. Como Validar e Testar o Row Level Security (RLS)

No **SQL Editor** do Supabase, teste a segurança simulando sessões reais:

### Teste 1: Vendedor Tentando Acessar o Financeiro Sensível Direto (DEVE FALHAR)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_VENDEDOR", "role": "authenticated"}';

-- Vendedor tenta ler a tabela ultrassensível de comissões da corretora:
SELECT * FROM public.contract_financials;
-- Resultado esperado: 0 linhas.

-- Vendedor tenta ler as parcelas financeiras diretamente:
SELECT * FROM public.commission_installments;
-- Resultado esperado: 0 linhas.

-- Vendedor consulta seu próprio extrato via RPC autorizada:
SELECT * FROM public.get_meu_financeiro();
-- Resultado esperado: Apenas contratos dos quais ele é responsável, sem margens KKJ.

-- Vendedor consulta suas parcelas via RPC autorizada:
SELECT * FROM public.get_minhas_parcelas();
-- Resultado esperado: Apenas parcelas de seus próprios contratos.
```

### Teste 2: Vendedor Tentando Autotransferir Lead (DEVE FALHAR)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_VENDEDOR", "role": "authenticated"}';

-- Vendedor tenta transferir o lead para outro corretor:
UPDATE public.opportunities
SET owner_id = 'OUTRO_UUID'
WHERE owner_id = 'UUID_DO_VENDEDOR';
-- Resultado esperado: Erro - "Vendedor não possui permissão para transferir ou remover o responsável do lead."
```
