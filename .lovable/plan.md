# Exportação Universal CSV — Plano de Implementação

## Objetivo
Entregar exportação completa de dados do tenant em CSV (zip), respeitando RLS, rastreável via `system_events`, sem lock-in. Conforme pedido E1–E7 / OPERA_CORE v1.3.

## Arquitetura

```text
[Admin UI] → invoke('export-csv', {scope}) → [Edge Function]
                                                  ├─ valida JWT + role (admin)
                                                  ├─ deriva tenant_id server-side (I2)
                                                  ├─ usa userClient (RLS ativo) p/ ler tabelas
                                                  ├─ monta CSVs (UTF-8 BOM, vírgula, aspas)
                                                  ├─ zipa em memória
                                                  ├─ upload em Storage (bucket privado, signed URL 15min)
                                                  ├─ log_system_event('exportacao_csv.*')
                                                  └─ retorna { url, expires_at, manifest }
```

Storage: novo bucket privado `exports` (signed URLs, sem leitura pública).

## Escopos suportados (E1–E3)
- **`tenant_full`**: todas tabelas do tenant.
- **`periodo`**: `{obra_id, mes}` — exporta `periodos_fechados` (versão ativa), `periodos_reaberturas`, `registro_presencas`, `apontamento_diarias`, `audit_logs`, `audit_logs_db`, `system_events` filtrados.
- **`obra`**: todos dados de uma obra.

## Tabelas incluídas
Todas as 39 tabelas públicas onde o usuário tem visibilidade via RLS. Lista pré-definida server-side (allowlist) — exclui `mobile_debug_logs` e dados sensíveis (`invites.token`, `session_transfers.token`, `profiles.account_status` mantido mas sem PII extra). LGPD: nenhuma senha/token exportado.

## Componentes a entregar

### 1. Backend
- **Edge Function `export-csv`** (`supabase/functions/export-csv/index.ts`)
  - Auth: exige JWT válido + `has_role(uid, 'admin')`.
  - Usa `userClient` (com Authorization header) → RLS aplicada automaticamente (E5).
  - Para cada tabela na allowlist:
    - `SELECT * FROM <t> WHERE tenant_id = $1 ORDER BY id` (ordenação determinística — E7).
    - Para folha: chama RPC `folha_pagamento` e serializa com mesma ordem do hash.
    - Pagina em chunks de 5k linhas (evita memória estourar).
  - Serializa CSV: UTF-8 BOM, `,` delimiter, escape `"` duplicando, CRLF.
  - Adiciona colunas finais `exportado_em`, `exportado_por` em cada linha (E4).
  - Compacta com `JSZip` (npm em Deno).
  - Upload em `exports/{tenant_id}/{timestamp}-{scope}.zip`.
  - Signed URL 15min.
  - `obs.log({ event_type: 'exportacao_csv.completed', payload: { scope, tables, rows_total, file_bytes } })` com correlation_id (E6).
  - Em falha parcial: `exportacao_csv.failed` + erro.

- **Migration**: criar bucket `exports` privado + policy "admins do tenant podem ler signed URL próprio caminho".

### 2. Frontend
- **Nova aba `Admin → Dados`** (`PeriodosFechadosTab` vizinha) — `src/components/admin/ExportarDadosTab.tsx`:
  - 3 cards: "Exportar tenant inteiro" / "Exportar obra" / "Exportar período fechado".
  - Seletor de obra/mês quando aplicável.
  - Aviso destacado quando período está aberto: "dados podem mudar — para prova jurídica, exporte um período fechado".
  - Botão → spinner → link de download (abre em nova aba).
  - Usa `traced()` de `src/lib/observability.ts` para propagar `correlation_id` via `causalHeaders`.
- Registrar tab em `src/pages/AdminPage.tsx` (`<Database/>` icon, `value="exportar"`).

### 3. Documentação
- `MANUAL_SISTEMA.md`: seção "Exportação CSV" com escopos, formato, limites, aviso de hash.
- `.lovable/memory/features/csv-export.md`: nova memory file.
- Atualizar `.lovable/memory/index.md`.

## Conformidade com invariantes
- **I1/I2**: tenant derivado server-side; RLS via userClient.
- **I5/I6**: log em `system_events` com correlation_id; cada CSV carrega `exportado_em/por`.
- **I9**: folha usa ordenação do hash; documentado que CSV evidencia mas não substitui hash.
- **I11**: `periodos_reaberturas` incluído por padrão.

## Critérios de aceitação (espelham seção 6)
- Admin exporta tenant em ≤3 cliques.
- ZIP contém 1 CSV por tabela visível.
- FKs exportadas como UUIDs literais.
- Dois admins do mesmo tenant geram conteúdo idêntico para o mesmo instante (ordenação determinística + mesma allowlist).
- Evento `exportacao_csv.completed` aparece em `system_events` com correlation_id da ação UI.
- Performance: 100k linhas < 30s (pagination + stream zip).

## Fora de escopo (desta sprint)
- Reimportação CSV → banco.
- Agendamento periódico para storage externo (S3/GCS) — fica para v2.
- Exportação Parquet/JSON.

## Riscos
- **Memória edge function**: zipar em memória pode estourar com tenants grandes. Mitigação: chunk + `JSZip` streaming; se necessário, escrever direto em Storage por arquivo e zipar via segunda função.
- **Timeout edge (150s)**: cobre 100k linhas, mas tenants futuros podem precisar de job assíncrono — ficar atento.
