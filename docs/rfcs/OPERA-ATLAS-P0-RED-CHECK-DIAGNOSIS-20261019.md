# OPERA Atlas — diagnóstico do vermelho P0 (2026-10-19)

## Evidência observada
- PR #2, SHA `b2da8d36e2051ee3d92a9c6f1317e54661f955be`.
- GitHub Actions existente em `.github/workflows/database-tests.yml` foi disparado automaticamente pelo evento `pull_request`; **não foi solicitado nem executado manualmente pela Control Tower**.
- Job `tenant-isolation` falhou no passo `Start local Supabase`. O passo `Run database tests` foi **SKIPPED**; não há resultado de isolamento de tenants.
- Log: `ERROR: UNION types text and integer cannot be matched (SQLSTATE 42804)`, statement 43 da migration `20260803223000_create_portfolio_commercial_domain.sql`.
- No `INSERT INTO public.portfolio_offers ... SELECT ... UNION ALL`, as primeiras linhas usam `NULL` para `performance_percent` e a última usa `20`. O tipo exato em conflito deve ser verificado localmente antes de propor correção; o log não identifica sozinho qual coluna do UNION está divergente.
- O log também mostra avisos `toomanyrequests: Rate exceeded` do Docker; são sinais adicionais, mas a parada final foi SQLSTATE 42804.

## Contrato de segurança
- O Supabase de produção pertence ao Lovable. **Não editar migrations históricas, RLS, policies, secrets ou edge functions e não executar SQL no projeto Lovable**.
- Não criar ou disparar GitHub Actions. O workflow pré-existente ainda está configurado para PR e push na main; decidir sua substituição por QA externo antes de qualquer desativação para não eliminar gate de segurança.
- Sem merge/publicação sem aprovação; não declarar PASS sem build, Vitest e QA.

## Próximo lote
1. Reproduzir o erro numa cópia local isolada do esquema, sem credenciais de produção.
2. Inspecionar os tipos de cada posição no `UNION ALL`, documentar a correção mínima e o efeito sobre migrações históricas.
3. Preservar a migration canônica até revisão e autorização separadas.
4. Testar isoladamente a página Organização, os filtros por obra/período e o tratamento de métricas ausentes.
5. Executar QA externo ao GitHub Actions; registrar comando, SHA e resultados.

**Estado:** FAIL do ambiente de teste local; tenant isolation = NOT RUN; main/preview/produção = inalterados.
