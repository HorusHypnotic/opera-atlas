# Plano: PDF "Roadmap de Maturidade Empresarial — OPERA Atlas"

Gerar um novo PDF empresarial (`/mnt/documents/OPERA_Atlas_Roadmap_Maturidade.pdf`) que substitui o cronograma anterior por marcos de maturidade, mantendo o mesmo padrão visual do Diagnóstico Objetivo. **Escopo restrito ao Atlas** (não ao ecossistema Copiloto/Compass/etc.). Sem alteração de código da aplicação.

## Fonte da verdade (verificável no repo)

- `.lovable/OPERA_CORE.md` v1.3 — invariantes I1–I11, §8 Soberania Atual, §9 Critérios de Aceitação
- `.lovable/memory/architecture/*` — período, causalidade, multi-tenancy
- `.lovable/memory/security/rls-access-validation.md` — estado atual RLS
- `.lovable/memory/features/csv-export.md`, `supabase/functions/export-csv/index.ts`
- Migrations existentes: `periodos_fechados`, `periodos_reaberturas`, `cronograma_baseline`, `system_events`, `audit_logs_db`
- Diagnóstico Objetivo (`/mnt/documents/OPERA_Atlas_Diagnostico_Objetivo.pdf`) como baseline de status

## Estrutura do PDF (8–10 páginas)

### 1. Capa
Título "Roadmap de Maturidade Empresarial — OPERA Atlas", data 06/07/2026, versão OPERA_CORE v1.3, tag "Cronograma por marcos, não por features".

### 2. Sumário executivo (½ página)
Uma frase por marco + posição atual (seta visual apontando entre M0 e M1).

### 3. Modelo de maturidade — 5 marcos
```text
M0 Fundação Técnica ──► M1 Pré-piloto Pago ──► M2 Cliente Enterprise ──► M3 Due Diligence Investidor ──► M4 Certificações (LGPD / ISO 27001)
```
Cada marco = uma seção de 1 página com quatro blocos fixos:
- **Definição** (o que significa esse marco em uma frase)
- **Critérios objetivos de prontidão** (checklist verificável)
- **Evidência atual** (o que já existe no repo)
- **Gaps para atingir o marco** (o que falta, com referência a arquivo/tabela)

### 4. Conteúdo de cada marco

**M0 — Fundação Técnica (atual)**
Critérios: OPERA_CORE v1.3 codificado; RLS ativo em todas as tabelas públicas; append-only para eventos; fechamento com hash SHA-256 estruturado; observabilidade causal (system_events, correlation_id).
Status: ✅ Atingido estruturalmente (evidência: migrations + `.lovable/memory/architecture/*`).
Gap residual: fechamento nunca rodou em obra real, hash não reproduzido por terceiro.

**M1 — Pré-piloto Pago**
Critérios: 1 fechamento mensal real com hash reproduzido; CSV exportado e conferido por cliente; 1 obra piloto em produção com dados reais por 30+ dias; contrato de piloto assinado; SLA mínimo (uptime, RPO/RTO declarados); domínio próprio; onboarding documentado.
Evidência atual: edge `export-csv` funcional, estrutura `periodos_fechados` pronta, domínio ainda em `.lovable.app`.
Gap: rodar fechamento real, migrar domínio, escrever contrato + SLA + runbook onboarding.

**M2 — Cliente Enterprise**
Critérios: teste automatizado de isolamento cross-tenant; monitoramento de erros (Sentry ou equivalente); backup com restore testado trimestralmente; segregação de funções (admin ≠ operador ≠ auditor) validada; export CSV incremental/delta; trilha de auditoria consultável por role auditor; SLA formal com penalidade; DPA (Data Processing Agreement) padrão.
Gap: sem testes automatizados de RLS, sem monitoramento, sem restore validado, sem role auditor dedicada.

**M3 — Due Diligence para Investidor**
Critérios: code review externo; teste de penetração (pentest) com relatório; documentação de arquitetura completa e versionada; roadmap de produto público; métricas de negócio auditáveis (MRR, churn, NPS) rastreáveis ao sistema; contratos com fornecedores críticos (Supabase, Lovable) formalizados; plano de contingência de lock-in (§8 do OPERA_CORE).
Gap: nenhum pentest, sem métricas de negócio, sem plano formal de exit de lock-in.

**M4 — Certificações (LGPD / ISO 27001)**
Critérios LGPD: RIPD (Relatório de Impacto), DPO nomeado, base legal por tratamento documentada, canal do titular funcional, política de retenção implementada e auditada (edge `data-retention` existe → precisa ser exercitada e certificada), termo de uso + política de privacidade revisados por jurídico.
Critérios ISO 27001: SGSI implantado, análise de riscos formal, controles Anexo A mapeados, auditoria interna, auditoria externa de certificação.
Gap: LGPD operacional inexistente hoje (PDF v2 apenas conceitual); ISO 27001 exige 6–12 meses de operação com evidências.

### 5. Cronograma temporal (tabela consolidada)
Colunas: Marco | Status atual | Pré-requisitos | Estimativa (semanas) | Riscos bloqueantes.
Linhas: M0 (✅ concluído) · M1 (4–6 sem) · M2 (8–12 sem após M1) · M3 (12–16 sem após M2) · M4 (24–36 sem após M2, paralelo a M3).

### 6. Matriz de riscos e débitos técnicos (revisada)
Formato: Risco | Severidade | Marco impactado | Mitigação | Evidência.
Ex.: hash não testado (ALTO, M1), sem testes RLS (ALTO, M2), 15 queries no dashboard (MÉDIO, M2), LGPD inexistente (ALTO, M4), lock-in Supabase (MÉDIO, M3).

### 7. Próximos passos (7/30/90 dias)
- **7 dias**: rodar 1 fechamento real e reproduzir hash com terceiro; migrar domínio próprio.
- **30 dias**: piloto pago em obra real; contrato + SLA + onboarding documentados → fecha M1.
- **90 dias**: testes automatizados de RLS, monitoramento, role auditor → avança M2.

### 8. Anexo A — Rastreabilidade
Tabela: cada critério de prontidão → arquivo/tabela/migration que comprova (ou lacuna explícita "não implementado").

### 9. Anexo B — Diferença vs. Diagnóstico Objetivo
Uma tabela curta mostrando o que mudou de "status por feature" para "status por marco de maturidade" e por que essa reorganização é fiel ao OPERA_CORE.

## Detalhes técnicos de geração

- Python + `reportlab` Platypus, `SimpleDocTemplate` A4, margens 2 cm.
- Reaproveitar paleta do Diagnóstico Objetivo: header laranja `#F97316`, corpo Helvetica 10 pt, tabelas com cabeçalho cinza-escuro + `Paragraph` em cada célula (wrap automático).
- Status: ✅ verde `#16A34A`, 🟡 âmbar `#F59E0B`, ❌ vermelho `#DC2626`.
- Diagrama linear dos 5 marcos: `Table` de uma linha com setas ASCII entre cells (sem imagens externas).
- Sem Unicode sub/superscript (usar `<sub>`/`<super>` do Platypus se necessário).
- QA obrigatório: `pdftoppm -jpeg -r 150` → `code--view` de cada página; corrigir overflow/alinhamento antes de finalizar. Reportar issues encontrados e como foram corrigidos.

## Fora de escopo

- Não alterar código da aplicação, migrations ou memórias.
- Não incluir Copiloto/Compass/ecossistema — apenas Atlas.
- Não regenerar o Diagnóstico Objetivo (permanece como está).
- Não gerar versão comercial/pitch — este PDF é para apresentação empresarial e auditoria.

## Entregável

Um arquivo: `/mnt/documents/OPERA_Atlas_Roadmap_Maturidade.pdf` (~8–10 páginas).
