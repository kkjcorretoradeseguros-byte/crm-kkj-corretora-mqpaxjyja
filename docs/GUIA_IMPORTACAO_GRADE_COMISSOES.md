# Guia Oficial de Importação da Grade de Comissões — KKJ Corretora

Este documento fornece instruções completas para que o cliente importe diretamente as linhas da planilha de comissões (ex: "Grade de comissão - Saúde Bliss.xlsx") no Supabase de produção, de forma 100% segura, idempotente e sem embutir arquivos binários ou tabelas fixas no código-fonte do CRM.

---

## 1. Regras Críticas e Diretrizes KKJ

1. **PROIBIDO CADASTRAR GO CARE SAÚDE**: Todas as linhas referentes à operadora `Go Care Saúde` (ou `Go Care`) devem ser descartadas e nunca inseridas.
2. **PLENA SAÚDE PME**: Utilizar EXCLUSIVAMENTE a Opção 1 aprovada pela KKJ: `100%, 50%, 40%, 20%, 20%` (Total = 230%). Qualquer opção divergente da grade não deve ser importada como regra ativa.
3. **CRONOGRAMAS CONFIRMADOS PME**: Os 8 cronogramas confirmados pela diretoria KKJ já possuem seeds pré-definidos na migration `0003_kkj_comercial_financeiro.sql` com códigos comerciais próprios (`BRADESCO_PME`, `AMIL_PME`, `SULAMERICA_PME`, `PORTO_PME`, `ALICE_PME`, `MEDSENIOR_PME`, `HAPVIDA_PME`, `PLENA_OP1`). A importação nunca deve sobrescrever silenciosamente esses cronogramas.
4. **NÃO CONFUNDIR TOTAL COM POR PARCELA**:
   - A coluna `Total` da planilha indica a somatória ou multiplicador total (ex: `1.25` = 125%, `3.0` = 300%).
   - As colunas `1` a `14` indicam o percentual de cada parcela (ex: `1` = 100%, `0.25` = 25%).
5. **NENHUMA IMPORTAÇÃO GERA RECEBIMENTOS OU PAGAMENTOS REAIS**: Inserir regras em `commission_rules` cadastra apenas os parâmetros futuros de cálculo; não movimenta o caixa, não cria lançamentos retroativos e não altera contratos históricos com snapshots gravados.

---

## 2. Mapeamento de Colunas (Planilha -> Tabela `commission_rules`)

| Coluna na Planilha   | Tipo / Exemplo                                                            | Campo em `public.commission_rules` | Transformação / Observação                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operadora**        | `Bradesco Seguros`                                                        | `carrier_id` / `nome`              | Relaciona via `carriers.id` pelo nome da operadora. Se nova, cadastra em `carriers`.                                                                                                                                                                                                                                                                                                                                                                          |
| **Modalidade**       | `PME Saúde`, `PF Saúde`, `Adesão Saúde`, `PME odonto`, `PF odonto`, `Pet` | `contract_type` e `modalidade`     | Mapear: <br>- `PME Saúde` -> `contract_type = 'pme'`, `modalidade = 'PME Saúde'`<br>- `PF Saúde` -> `contract_type = 'pf'`, `modalidade = 'PF Saúde'`<br>- `Adesão Saúde` -> `contract_type = 'adesao'`, `modalidade = 'Adesão Saúde'`<br>- `PME odonto` -> `contract_type = 'odonto'`, `modalidade = 'PME Odonto'`<br>- `PF odonto` -> `contract_type = 'odonto'`, `modalidade = 'PF Odonto'`<br>- `Pet` -> `contract_type = 'outros'`, `modalidade = 'Pet'` |
| **Total**            | `3` (300%) ou `1.25` (125%)                                               | `total_comissao_pct`               | Multiplicar por 100 se vier em decimal (ex: `1.25` -> `125.00`, `3.0` -> `300.00`).                                                                                                                                                                                                                                                                                                                                                                           |
| **Parcelas 1 a 14**  | `1`, `0.5`, `0.3`, `0`                                                    | `cronograma_parcelas` (JSONB)      | Gerar array JSONB: `[{"month": 1, "pct": 100}, {"month": 2, "pct": 50}, ...]` contendo apenas parcelas com percentual > 0.                                                                                                                                                                                                                                                                                                                                    |
| **Total Parcelas**   | Inteiro                                                                   | `total_parcelas`                   | Contagem de parcelas com percentual > 0 (ex: 5 parcelas).                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Repasse Vendedor** | Regra KKJ                                                                 | `repasse_vendedor_pct`             | Padrão: 50% (PME/Adesão fornecido KKJ), 30% (PF fornecido KKJ), 100% (lead próprio vendedor).                                                                                                                                                                                                                                                                                                                                                                 |
| **Alíquota Imposto** | Config KKJ                                                                | `aliquota_imposto_pct`             | Padrão KKJ: `11.00%`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Ativo**            | Booleano                                                                  | `ativo`                            | `true` para regras aprovadas; `false` se total for 0.                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 3. Passo a Passo para Importação no Supabase

### Opção A: Via Painel do CRM (Recomendado para o Administrador)

1. Acesse o CRM KKJ como Administrador.
2. Navegue até **Configurações** -> **Comissões**.
3. Na aba **Comissões das Operadoras**, utilize o botão **Nova Regra** para cadastrar ou ajustar regras individualmente.
4. Para importação em lote de CSV, use a área de upload no painel (o sistema descarta automaticamente Go Care e opções inválidas de Plena Saúde).

### Opção B: Via Supabase Table Editor (CSV direto)

1. Converta a planilha XLSX para CSV (separador vírgula ou ponto-e-vírgula).
2. Abra o Supabase Dashboard -> **Table Editor** -> `commission_rules` -> **Insert** -> **Import data from CSV**.
3. Associe as colunas conforme a tabela de mapeamento acima.

---

## 4. Consultas SQL de Conferência e Diagnóstico (Somente Leitura)

Execute as seguintes consultas no **SQL Editor** do Supabase para auditar os dados após a importação:

### 4.1. Contagem de regras por modalidade e status

```sql
SELECT
  contract_type,
  modalidade,
  ativo,
  COUNT(*) AS total_regras
FROM public.commission_rules
GROUP BY contract_type, modalidade, ativo
ORDER BY contract_type, modalidade;
```

### 4.2. Total de comissão e quantidade de regras por operadora

```sql
SELECT
  c.nome AS operadora,
  COUNT(cr.id) AS qtd_regras,
  ROUND(AVG(cr.total_comissao_pct), 2) AS media_comissao_total,
  ROUND(AVG(cr.repasse_vendedor_pct), 2) AS media_repasse_vendedor
FROM public.commission_rules cr
LEFT JOIN public.carriers c ON c.id = cr.carrier_id
GROUP BY c.nome
ORDER BY c.nome;
```

### 4.3. Verificação de exclusão obrigatória (Go Care Saúde NÃO deve existir)

```sql
SELECT
  cr.id,
  cr.nome,
  cr.code,
  c.nome AS operadora
FROM public.commission_rules cr
LEFT JOIN public.carriers c ON c.id = cr.carrier_id
WHERE LOWER(cr.nome) LIKE '%go care%'
   OR LOWER(cr.nome) LIKE '%gocare%'
   OR (c.nome IS NOT NULL AND (LOWER(c.nome) LIKE '%go care%' OR LOWER(c.nome) LIKE '%gocare%'));
-- Resultado esperado: 0 linhas retornadas.
```

### 4.4. Comparação com os 8 Cronogramas Confirmados KKJ (Sinalização de Divergências)

```sql
WITH confirmados AS (
  SELECT 'BRADESCO_PME' AS code, 'Bradesco Saúde' AS operadora, 400.00 AS total_esperado, 5 AS parcelas_esperadas UNION ALL
  SELECT 'AMIL_PME', 'Amil', 300.00, 3 UNION ALL
  SELECT 'SULAMERICA_PME', 'SulAmérica', 300.00, 3 UNION ALL
  SELECT 'PORTO_PME', 'Porto Seguro', 300.00, 3 UNION ALL
  SELECT 'ALICE_PME', 'Alice', 300.00, 3 UNION ALL
  SELECT 'MEDSENIOR_PME', 'MedSênior', 200.00, 3 UNION ALL
  SELECT 'HAPVIDA_PME', 'Hapvida', 350.00, 4 UNION ALL
  SELECT 'PLENA_OP1', 'Plena Saúde (Opção 1)', 230.00, 5
)
SELECT
  conf.code,
  conf.operadora,
  conf.total_esperado,
  cr.total_comissao_pct AS total_cadastrado,
  conf.parcelas_esperadas,
  cr.total_parcelas AS parcelas_cadastradas,
  cr.has_recurring AS recorrencia_ativa,
  cr.recurring_percentage AS pct_recorrencia,
  CASE
    WHEN cr.id IS NULL THEN 'NÃO ENCONTRADO (Execute a migration 0003)'
    WHEN cr.total_comissao_pct <> conf.total_esperado THEN 'DIVERGÊNCIA NO TOTAL'
    WHEN cr.total_parcelas <> conf.parcelas_esperadas THEN 'DIVERGÊNCIA NA QTD DE PARCELAS'
    ELSE 'CONFIRMADO E ÍNTEGRO'
  END AS status_conferencia
FROM confirmados conf
LEFT JOIN public.commission_rules cr ON cr.code = conf.code;
```

---

## 5. Ordem Exata de Execução das Migrations no Supabase

1. `0001_kkj_initial_schema.sql` (JÁ EXECUTADA EM PRODUÇÃO — NÃO REPETIR)
2. `0002_kkj_security_fixes.sql` (JÁ EXECUTADA EM PRODUÇÃO — NÃO REPETIR)
3. `0002_1_kkj_security_complement.sql` (PENDENTE — Executar via SQL Editor)
4. `0003_kkj_comercial_financeiro.sql` (PENDENTE — Executar via SQL Editor)
5. `0004_kkj_teams_hierarchy_and_rls.sql` (PENDENTE — Executar via SQL Editor)
