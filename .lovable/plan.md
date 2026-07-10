# APMO — Auditoria de Preservação da Memória Operacional v1.0

## Objetivo

Produzir um documento único e evidence-based — `OPERA_APMO_v1.0.pdf` — que audite o ecossistema OPERA (com foco no Atlas, único módulo hoje existente no repositório) segundo as 12 etapas do protocolo APMO e conclua com o Índice de Preservação da Memória Operacional (IPMO).

O documento não substitui a Constituição, a Governança de Maturidade, o Diagnóstico Objetivo nem o Modelo Empresarial. Ele os **cruza sob uma lente nova**: a memória operacional da obra como ativo preservável.

## Escopo

- Auditar o que existe **hoje** no repositório (Atlas). Control e Copiloto de Obras entram apenas como "dependência futura" nos itens em que o Atlas sozinho não fecha o requisito.
- Nenhuma alteração de código, schema, RLS, edge functions ou tokens de design.
- Nenhum novo documento paralelo (Diagnóstico, Roadmap, Constituição permanecem intocados).
- Saída única: PDF empresarial em A4, paleta e tipografia coerentes com os PDFs anteriores da série.

## Fontes de evidência (somente leitura)

- `.lovable/OPERA_CORE.md` (invariantes I1–I11, modelo temporal, causalidade).
- `.lovable/memory/architecture/*` (period-reopening, causal-observability, multi-tenancy, workforce).
- Funções de banco já existentes (nenhuma nova): `folha_pagamento`, `validar_fechamento`, `reabrir_periodo`, `refechar_periodo`, `listar_historico_periodo`, `verificar_hash_periodo`, `fn_audit_log_changes`, `fn_check_periodo_fechado`, `fn_set_status_contabil`, `log_system_event`, `set_correlation_context`.
- Tabelas existentes: `periodos_fechados`, `periodos_reaberturas`, `audit_logs`, `audit_logs_db`, `system_events`, `registro_presencas`, `apontamento_diarias`, `obras`, `colaboradores`, storage `obra-fotos`.
- Código: `src/lib/observability.ts`, `src/lib/auditLog.ts`, `src/components/admin/AuditLogTab.tsx`, `supabase/functions/_shared/observability.ts`.

## Estrutura do PDF (≈ 16–18 páginas)

1. **Capa + Sumário Executivo** — IPMO global consolidado (0–100), veredito de nível (Registro / Gestão / Memória / Arquitetura verificável) e 3 principais bloqueios.
2. **Premissa e método** — memória operacional como ativo; regras de classificação (Implementado / Parcial / Não implementado / Implementado com limitações / Necessita revisão conceitual).
3. **Etapa 1 — Inventário da Informação** — tabela de ~25 objetos (obras, atividades, presenças, apontamentos, fechamentos, evidências foto, audit_logs, system_events, etc.) × 6 colunas (ID único / versão / histórico / exclusão física / exclusão lógica / trilha).
4. **Etapa 2 — Estado Operacional Verificável** — reconstrução por domínio (produção, planejamento, custos, equipes, estoque, evidências, clima, responsáveis, decisões, IA). Cita `folha_pagamento` (determinismo I9), `snapshot_json` em `periodos_fechados`, ausência de snapshot para cronograma/estoque/clima.
5. **Etapa 3 — Cadeia de Integridade** — SHA-256 (`extensions.digest`) sobre `folha_pagamento`; cobertura: snapshot financeiro sim, arquivos e cronograma não; sem timestamp externo (RFC 3161), sem prova independente do banco.
6. **Etapa 4 — Versionamento** — `periodos_fechados.versao` + `periodos_reaberturas` como único subsistema versionado; obras/atividades/colaboradores fazem UPDATE destrutivo (apenas rastro em `audit_logs_db`).
7. **Etapa 5 — Cadeia de Custódia (evidências)** — `obra-fotos` público, sem hash por arquivo, sem EXIF preservado, sem assinatura, sem lineage server-side além do path. Classificação: **Necessita revisão conceitual**.
8. **Etapa 6 — Preservação do Contexto** — foto vinculada a obra/registro; sem vínculo com atividade Gantt, ECO, REO, indicador. Contexto parcial.
9. **Etapa 7 — Preservação Semântica** — foto sem descrição, sem classificação, sem responsável explícito além do uploader. Risco de "arquivo sem memória" em 5 anos.
10. **Etapa 8 — Delta Operacional (ΔO)** — inexistente como conceito. Só há diff implícito via `audit_logs_db` old_data/new_data. Sem ΔO por domínio.
11. **Etapa 9 — Retificação Operacional** — implementada apenas para fechamentos (I11, `reabrir_periodo`/`refechar_periodo` com motivo ≥20 chars, snapshot anterior imortal). Fora disso: UPDATE direto.
12. **Etapa 10 — Inteligência Temporal** — parcial: fechamento reconstrói folha do mês; nada reconstrói "estado da obra em 12/03". Sem "time travel" sobre atividades, riscos, dashboards.
13. **Etapa 11 — Robustez** — depende inteiramente do Supabase gerenciado (§8 do OPERA_CORE). Sem teste de restore documentado; sem CRDT/offline; concorrência controlada por RLS+triggers.
14. **Etapa 12 — IPMO por domínio** — barra visual 0–100 para os 10 domínios listados no protocolo, com justificativa curta e evidência (ID → arquivo/função).
15. **Matriz de não-conformidades** — para cada item Parcial / Não implementado / Necessita revisão, os 12 campos exigidos pelo protocolo (diagnóstico → prioridade). Formato compacto em tabela + fichas.
16. **Dependências cruzadas Atlas / Control / Copiloto** — coluna dedicada em cada não-conformidade: o que só o Atlas resolve, o que exige Control (execução em campo), o que exige Copiloto (captação semântica).
17. **Veredito final e encaminhamento** — IPMO global, nível atingido, e ligação com a Constituição (§7 contratos, §9 snapshots, §13 observabilidade) sem propor mudança nela.

## Notas técnicas de geração

- Script Python `/tmp/gen_apmo.py` usando `reportlab` Platypus (mesmo padrão dos PDFs anteriores: `SimpleDocTemplate` A4, paleta laranja/grafite, `Table` com `rowHeights` explícitos para evitar overflow).
- Reaproveitar helpers de barra de progresso (IPMO) e chips de status (Implementado / Parcial / etc.) usados no PDF de Governança de Maturidade.
- Renderizar amostras com `pdftoppm` antes de finalizar; corrigir overflow/glifos como nos PDFs anteriores.
- Saída: `/mnt/documents/OPERA_APMO_v1.0.pdf`.

## Fora de escopo

- Nenhuma migração, RPC nova, mudança em RLS, mudança em storage, mudança em UI.
- Nenhuma alteração em `.lovable/OPERA_CORE.md`, `.lovable/plan.md` (exceto uma linha de registro), ou nos PDFs já emitidos.
- Nenhuma criação de `.lovable/rfcs/`.
- Nenhuma proposta de "próximo módulo" — o PDF diagnostica, não planeja implementação.

## Entregável

- `OPERA_APMO_v1.0.pdf` em `/mnt/documents/`.
- Uma linha de atualização em `.lovable/plan.md` registrando a emissão do documento.
