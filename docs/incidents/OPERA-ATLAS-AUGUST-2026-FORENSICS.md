# Investigação forense | Agosto de 2026 | OPERA Atlas

Estado: **evidência parcial forte; causa raiz do preview não comprovada**. Nenhuma chave histórica deve ser copiada, restaurada, exibida ou reutilizada.

## Cobertura
Busca dos **100 commits mais recentes** retornou **36 commits datados de agosto** (02, 03, 08, 12 e 19/08). A amostra é limitada aos 100 mais recentes; não afirmar inventário exaustivo do mês sem paginação/validação da história completa. A inspeção aprofundada até aqui priorizou commits de risco e diffs de 12 e 19/08.

## Linha do tempo e impacto
- **02/08**: testes multi-tenant; relatórios PDF, WhatsApp e responsividade. Não há prova de relação com bootstrap do preview.
- **03/08**: domínio comercial do portfólio; não inspecionado integralmente.
- **08/08** `6484ddde`: restaura reprodutibilidade, acrescenta `gantt-task-react` ao lockfile; diff observado não contém configuração Supabase.
- **12/08**: auditorias de identidade, retenção, control plane e domínio de prazo. `fc410413` implementa baseline versionado: migration `20260812170000_schedule_baseline_v1.sql`, RPCs `aprovar_baseline_cronograma` e `listar_baselines_cronograma`, UI e tipos gerados com campos de hash/lineage. **Conexão crítica com outubro**: o commit `73fd63a` removeu declarações desses campos/RPCs do arquivo gerado de tipos; `13ef2cf` compensou com `as any`. Divergência de tipos versus banco real **não comprovada**.
- **19/08** `3301911686b576ebbc096c6eda0a12bcdfab48a8`: diff exato versus `37b2d93` = **4 arquivos**: `.env` removido do tracking, `.env.example` criado, `.gitignore` passa a ignorar `.env`, README alterado. O `.env` anterior tinha ID, URL e chave pública Supabase. **Não consultar nem recuperar valor da chave**.
- **19/08, contexto prévio**: `vite.config.ts` não tinha fallback de variáveis e `src/main.tsx` apenas renderizava `App`; o diagnóstico `ATLAS-CONFIG-KEY` foi adicionado posteriormente. Isso impede atribuir diretamente a criação do texto do erro ao commit de agosto. `src/lib/supabase.ts` reexportava o cliente gerado e documentava o motivo para `localStorage` síncrono.
- **19/10**: Lovable confirmou internamente a presença das três variáveis, mas preview externo permanece com `ATLAS-CONFIG-KEY`. **Hipótese prioritária:** diferença de injeção/configuração de build após a remoção do `.env` rastreado. **Correlação não prova causalidade**: a plataforma pode injetar variáveis de outra forma.
- **19/10, desvio de escopo Lovable**: mudanças de broker de autenticação e tipos gerados no commit `73fd63a` contrastam com decisão histórica de agosto sobre storage síncrono; avaliar regressão de refresh/login e compatibilidade RPC. Ver `docs/incidents/OPERA-ATLAS-UNREQUESTED-LOVABLE-CHANGES-20261019.md`.

## Hipóteses testáveis
H1. Build externo usa somente arquivos versionados, não recebe `VITE_SUPABASE_PUBLISHABLE_KEY` do ambiente Lovable. Evidência: interno possui, externo falha; **ainda sem prova do mecanismo de build**.
H2. Build externo serve bundle antigo ou cache distinto do SHA Lovable/GitHub. Precisa identificar asset/manifest/hash do build e comparar com preview interno.
H3. A chave existe na plataforma mas não é propagada para `import.meta.env` no Vite do preview externo. Requer inspeção oficial de build environment, somente presença/ausência.
H4. Outubro removeu declarações de RPC/colunas introduzidas em agosto, provocando falha em cronograma ou auth. **Problema separado** do erro de bootstrap; verificar schema real e testes.

## Próximo lote seguro
1. Completar inventário de commits de agosto com paginação, categorizar todos os diffs, conferir primeiro/último commit e qualquer mudança em `vite.config.ts`, `src/main.tsx`, `src/integrations/supabase/client.ts`, `.env`, `.gitignore` e pipeline.
2. Comparar bundle externo e interno sem imprimir segredos. Se ambos compartilham SHA, isolar injeção de env; se divergem, resolver sincronização.
3. Auditar divergência `types.ts` versus migration/RPCs do baseline de 12/08, sem migrations ou alterações no banco.
4. Não remover `.env` do `.gitignore`; não introduzir chave em GitHub. Correção somente por mecanismo oficial de build do Lovable.
5. Testar sessão `localStorage` versus `brokeredPreviewStorage` antes de aceitar alterações de outubro; preparar PR de reversão **somente após testes**.

## Segurança e gates
Sem Lovable AI adicional (turno único já consumiu 2,7 créditos), sem merge, deploy, publicação, GitHub Actions, alteração de cliente gerado, migrations ou chaves em logs/GitHub. **Status**: arqueologia agosto parcial; hipótese de agosto consistente; preview externo FAIL; segurança broker UNKNOWN.
