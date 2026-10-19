# OPERA Atlas | Correlação entre produção funcional, último deploy e preview quebrado | 2026-10-19

## Novo fato operacional
Usuário confirma: **a produção está funcionando** e **o preview parou de funcionar depois do último deploy**. Isso é evidência de comportamento observada pelo operador, não comprovação do SHA publicado.

## Fontes cruzadas
- Lovable `get_project`: `is_published=true`, `latest_commit_sha=f312092eccb84adbe59c5546b6ddd4da48e40a79`, `last_edited_at=2026-10-19T21:51:59.683Z`. **Nenhum campo de last_deployed_at nem published_sha** na resposta. `latest_commit_sha` não deve ser tratado como SHA de produção.
- Lovable `list_edits`: em 19/10, `d43d5c7` às 20:02:31 UTC introduziu distinção URL/key; `8845735` às 20:09:39 UTC iniciou fallback de URL; `2b06fc5` às 20:14:36 UTC mergeou PR #11; `f312092` às 21:51:59 UTC última edição. **Edição não é deploy**.
- GitHub: commit `3301911` (19/08) retirou `.env` do tracking, mantendo placeholders em `.env.example`. Isso é possível ponto de bifurcação entre um artefato já publicado com configuração embutida e builds futuros sem configuração injetada. **Hipótese, não fato confirmado**.
- `vite.config.ts` atual recupera URL, mas não a publishable key. Assim, builds que não recebem `VITE_SUPABASE_PUBLISHABLE_KEY` falham no bootstrap. O ambiente interno Lovable relatou presença das variáveis; o preview externo, segundo usuário, apresenta `ATLAS-CONFIG-KEY`.
- Tentativas de leitura pública dos endereços de produção e preview neste ambiente retornaram `DisabledError`; não há inspeção de HTML/bundles nem comparação de hashes.

## Hipóteses ordenadas
1. **Artefato publicado preservado:** produção estática antiga contém a configuração de quando foi construída, mas o preview recompilado após remoção de `.env` não recebeu a variável. Plausível; verificar hash dos JS e timestamp de publicação.
2. **Ambientes diferentes:** Lovable injeta env internamente, mas não no build externo. Plausível; confirmar painel de build.
3. **Preview aponta para build/branch diferente:** confirmar SHA real e cache; Lovable latest SHA não garante correspondência do bundle.
4. **Regressão introduzida em outubro:** diagnósticos tornam falha explícita, mas a ausência de env pode ser anterior; distinguir mudança do erro exibido da falha subjacente.

## Experimento decisivo seguro
- Consultar histórico de **publicações** no painel Lovable e registrar `published_sha`, data/hora e identificador do deploy, **sem republicar**.
- Ler somente headers, HTML e nomes/hashes de assets JS do domínio de produção e preview externo, sem tokens nem valores de configuração; se possível confirmar a presença do marcador `ATLAS-CONFIG-KEY` sem copiar bundle.
- Correlacionar `published_sha` com `3301911` e commits de 19/10. Se produção precede 19/08, hipótese de artefato preservado ganha força; se posterior, examinar mecanismo alternativo de injeção.
- Verificar existência (booleano) de `VITE_SUPABASE_PUBLISHABLE_KEY` no contexto do build externo via suporte/painel oficial, sem expor valor.

## Gates
Produção: **PASS reportado pelo usuário**, SHA/data do último deploy **UNKNOWN**. Preview externo: **FAIL reportado pelo usuário**. Causa raiz: **UNKNOWN**. **Não publicar produção**: ela é a referência funcional. Sem novo crédito Lovable AI, alteração de env em GitHub, migrations, merge ou alteração de autenticação.

## Verificação independente de endpoints e acesso (lote seguinte)
- `https://opera-atlas.lovable.app`: leitura externa retornou **DisabledError**. Isso é restrição da ferramenta, **não** evidência de produção indisponível.
- `https://preview--opera-atlas.lovable.app`: endpoint inacessível pela ferramenta web. **Não** é diagnóstico de HTTP 404/500.
- `https://id-preview--5198af1a-2d9b-4863-aced-2ac8cd06e9a9.lovable.app`: leitura externa retornou **DisabledError**.
- Ferramentas Lovable acessíveis incluem `get_project`, `list_edits`, `deploy_project`, mas **não há leitura de histórico de deploy nem de SHA publicado**. **Não chamar deploy_project** para obter metadados: é operação mutável e não autorizada.
- GitHub disponível neste conector não expõe leitura de deployments/environments. Portanto, **não atribuir SHA de publicação** a partir do commit mais recente.
- Gate objetivo permanece: obter evidência somente leitura do painel Lovable (última publicação com timestamp/versão), ou por mecanismo de inspeção de bundle autorizado. Não republicar a produção que o operador confirmou funcional.

## Evidência visual fornecida pelo operador: publicação em 12/08
Captura do painel Publish do Lovable (19/10/2026, 19:02 no aparelho): texto **"Changes since published Aug 12, 2026"**, domínio `opera-atlas.lovable.app`, botão **"Publish changes"**, e ao fundo preview com diagnóstico **`ATLAS-CONFIG-KEY`**.
**Inferência forte:** publicação atual é datada de **12/08/2026** e existem mudanças posteriores ainda não publicadas. A imagem **não identifica SHA publicado nem hora exata do deploy**. O operador confirma que a produção funciona.
**Correlação temporal importante:** o commit `3301911` que removeu `.env` do tracking ocorreu **19/08**, depois da publicação indicada pelo Lovable. Isso torna a hipótese de produção antiga com configuração preservada versus preview reconstruído sem chave muito mais forte, **sem provar a causa raiz**.
**Gate crítico:** não clicar `Publish changes`, não forçar sincronização nem republish. Preservar produção de 12/08. Próximo teste seguro: identificar último commit anterior à publicação de 12/08 e inspecionar o histórico do preview/build, sem exibir chave.

## Prova de igualdade do bootstrap entre 12/08 e 19/08
Comparados refs `37b2d93b3e7cdf55d1b5ed5a62802ddd11376f7d` (12/08) e `3301911686b576ebbc096c6eda0a12bcdfab48a8` (19/08), via blob SHA GitHub:
- `src/integrations/supabase/client.ts`: blob **`1619b4712ada615cc601cd2e63c889db30091dca`** em ambos; cliente gerado usa `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`, storage `localStorage`.
- `src/main.tsx`: blob **`68176a72f30ae0650f5093c8b6a7b01016acf07a`** em ambos; bootstrap React simples, sem diagnóstico.
- `vite.config.ts`: blob **`303a0ee420c4f0bdc9308912020f5b96aedc5509`** em ambos; sem fallback de env.
- Entre esses refs, a alteração `3301911` foi restrita a `.env`, `.env.example`, `.gitignore`, `README.md`.
**Inferência:** o código consumidor da chave não mudou entre 12 e 19/08. Se um build de 12/08 recebeu a chave e um posterior não, a diferença é de disponibilidade/configuração no momento do build, não de leitura dessa variável pelo cliente nesse intervalo. Não afirmar que o Lovable necessariamente usou o `.env` versionado: mecanismo de injeção não comprovado.
**Segurança:** não copiar chave histórica para repo; não alterar o cliente gerado; preservar deploy de produção.

## Lote de validação cruzada com Lovable (read-only)
- Lovable `get_diff(sha=3301911686b576ebbc096c6eda0a12bcdfab48a8)` confirma **quatro caminhos apenas**: `.env` delete, `.env.example` new, `.gitignore` edit, `README.md` edit. Esta é uma fonte independente do diff GitHub.
- Lovable `list_messages` confirma um turno de IA em 19/10 às 21:51 UTC, distinto das operações de agosto. O histórico não contém comprovação de novo deploy nem correção do preview externo.
- SHA blobs GitHub de `client.ts`, `main.tsx`, `vite.config.ts` entre 12/08 e 19/08 são idênticos (ver seção anterior).
- Hipótese priorizada: build de produção anterior a 19/08 preservou configuração; build posterior não recebeu chave. **Não tratar como causa raiz sem evidência de injeção/artefato**.
- Não consultar valores da chave histórica nem acionar `deploy_project`.

## Gate de leitura do schema remoto (19/10, lote seguinte)
- `mcp__Lovable__get_database_status` respondeu `enabled=true, stack=supabase` para o projeto correto.
- Tentativa de **SELECT somente leitura** no catálogo PostgreSQL `pg_proc`/ `pg_namespace` para verificar presença das RPCs `aprovar_baseline_cronograma` e `listar_baselines_cronograma` foi **bloqueada pela política de segurança da ferramenta**, sem retorno de linhas. Isso **não prova ausência** das funções.
- Não houve escrita SQL, migrations, alterações de credenciais ou publicação. Status do schema remoto: **BLOCKED/UNKNOWN**. Não repetir automaticamente consultas equivalentes para contornar o bloqueio.
- Investigação de env do preview permanece separada: status do banco habilitado não confirma `VITE_SUPABASE_PUBLISHABLE_KEY` no build.

## Lote de fechamento de diagnóstico de build e handoff ao suporte
Verificação direta da `main`:
- `vite.config.ts` usa `loadEnv(mode, process.cwd(), "VITE_")`; define fallback **somente** de `import.meta.env.VITE_SUPABASE_URL` via `supabase/config.toml`. Não define fallback para `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `src/main.tsx` diagnostica ausência da URL antes da chave, e testa chave antes de importar `App.tsx`. Logo `ATLAS-CONFIG-KEY` prova que, no bundle que exibiu o diagnóstico, a chave não estava disponível ao teste de bootstrap. **Não distingue** ausência no ambiente, build antigo, substituição de env ou artefato/caching.
- `.env.example` contém placeholders, não é fonte de valores para Vite por padrão. `package.json` usa `vite build` para produção e `vite build --mode development` para build:dev; ambos requerem chave disponibilizada no ambiente apropriado.
- Contrato anterior `docs/decisoes/OPERA-ATLAS-LOVABLE-MANAGED-SUPABASE-PREVIEW-P0-20261019.md` já indica **chamado Lovable** como próximo gate, evitando novas mudanças experimentais.
Handoff técnico para suporte Lovable, sem valores de credenciais:
**Projeto:** `5198af1a-2d9b-4863-aced-2ac8cd06e9a9`. **Repo:** `HorusHypnotic/opera-atlas`. **SHA Lovable reportado:** `f312092eccb84adbe59c5546b6ddd4da48e40a79`. **Produção:** `https://opera-atlas.lovable.app` (última publicação 12/08/2026 conforme painel). **Preview:** `https://id-preview--5198af1a-2d9b-4863-aced-2ac8cd06e9a9.lovable.app`. **Sintoma:** `ATLAS-CONFIG-KEY` no preview externo, apesar de `VITE_SUPABASE_PUBLISHABLE_KEY` presente no ambiente interno Lovable segundo turno de IA de 19/10 e navegação interna `/` e `/login` bem-sucedida. **Pergunta ao suporte:** qual mecanismo injeta `VITE_SUPABASE_PUBLISHABLE_KEY` no build/preview externo, qual SHA/artefato está servido e como reconstruir apenas preview sem publicar produção? Pedir diagnóstico de presença/ausência, não o valor da chave. Não alterar auth, banco, GitHub .env ou produção.
**Gate:** sem ferramenta de leitura do ambiente/artefato do preview externo e sem acesso de suporte pelo conector, a correção permanece **BLOCKED**. Nenhum ticket de suporte foi enviado por esta operação.

## Revalidação Lovable, somente leitura, após pesquisa externa
- `get_project` confirma projeto `5198af1a-2d9b-4863-aced-2ac8cd06e9a9`, `is_published=true`, `latest_commit_sha=f312092eccb84adbe59c5546b6ddd4da48e40a79`, `last_edited_at=2026-10-19T21:51:59.683Z`, `preview_url=https://id-preview--5198af1a-2d9b-4863-aced-2ac8cd06e9a9.lovable.app`, `agentFinished=true`.
- `list_edits(limit=12)` confirma cronologia do diagnóstico `d43d5c7` (20:02:31Z), URL fallback `2b06fc5` (20:14:36Z) e edição final `f312092` (21:51:59Z). **Nenhuma dessas informações é SHA do artefato externo nem histórico de deploy**.
- `get_project_knowledge` retornou vazio; não há ali informação de configuração de build.
- `is_published=true` indica existência de publicação, não que preview atual tenha sido reconstruído ou esteja funcional.
- Para fechar P0, obter por painel/suporte Lovable: build ID/SHA externo, modo e timestamp, presença da variável na etapa de build (boolean), resultado de rebuild de preview, smoke test. Não usar a URL de screenshot como prova de bootstrap, nem afirmar ausência de chave no ambiente inteiro.
- Sem mutações em app, banco, configuração, credenciais ou produção.

## Chamada Lovable autorizada adicional e auditoria independente
- Uma chamada de IA Lovable autorizada explicitamente, `message_id=umsg_01m5b44r3tev6tkxa1fwgm4va2`, concluída, custo reportado **1,7 crédito**. Não repetir sem autorização.
- Lovable relatou `curl` do preview externo `/` e `/login` com **HTTP 401**. Não conseguiu obter HTML, JS, build ID/SHA nem comprovar presença de chave no bundle. O `ATLAS-CONFIG-KEY` visto na captura anterior e o 401 obtido agora são observações de **contextos de acesso diferentes**. Não confundir 401 com prova de chave ausente.
- Internamente, Lovable reportou `.env` presente com chave, ainda ignorado por Git. Não revelou valor. Não editou nem reconstruiu preview.
- **Auditoria independente pós-chamada:** `get_project` mantém `latest_commit_sha=f312092eccb84adbe59c5546b6ddd4da48e40a79` e `agentFinished=true`; `compare_commits(base=f312092, head=main)` retornou `status=identical`, `ahead_by=0`, `behind_by=0`, `files=[]`. `get_diff(message_id)` retornou `Message has no associated edit`. Portanto **nenhuma alteração rastreável no GitHub/Lovable** nesta chamada. Isso não atesta configurações ocultas, mas não há indício de mudança nelas.
- O agente sugeriu embutir chave publicável em `vite.config.ts` ou retirar `.env` do ignore. **Não aprovado**: essas opções não demonstram a causa nem atendem à regra de menor mudança reversível; não implementar.
- Veredito revisado: duas observações comprovadas por origens diferentes: `ATLAS-CONFIG-KEY` na captura de preview do usuário; `401` em acesso direto automatizado. **Primeiro gate** é diferenciar autenticação do preview Lovable e bundle efetivamente servido em sessão autorizada. Só então diagnosticar variável de build.
- Estados: histórico PASS; ausência de mudanças na chamada PASS; teste externo autorizado BLOCKED (401); build ID/chave no bundle UNKNOWN; preview funcional FAIL na última captura; produção não publicada nem alterada.

## Evidência de alternância no celular (19/10, 19h25–19h28 local) e teste decisivo
O usuário apresentou três capturas **no editor Lovable em Android**, com horário do aparelho:
1. 19h25: rota `/landing` renderiza a landing e menu de rotas do editor.
2. 19h27: dashboard O.P.E.R.A. renderiza filtro `Dirceu Engenharia`, `Últimos 30 dias`, CTA de relatório e wizard 3/6. Evidência **visual**, não prova queries, auth nem exportação.
3. 19h28: tela `ATLAS-CONFIG-KEY` após navegação/recarregamento não caracterizado. É **FAIL real** no contexto observado, não foi resolvido.
A sequência prova **alternância de telas** mas NÃO comprova troca de bundle, intermitência da variável dentro do mesmo bundle ou qual rota/URL exata falhou. Uma variável Vite incorporada ao mesmo bundle não deveria alternar espontaneamente; investigar diferença de contexto/artefato antes de atribuir ao backend.
Releitura de `src/main.tsx`: o teste `!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` antecede `import("./App.tsx")`; logo não é erro de query do dashboard nem do broker de auth.
### Teste mínimo de discriminação (sem código, sem publicação)
Com Lovable editor autenticado e preview visível, registrar **URL efetiva, rota e contexto** de cada tentativa. No MESMO contexto, abrir `/landing` e `/login`, alternar rota, e fazer uma recarga completa uma vez. Observar se falha somente após reload, troca de rota, ou ao abrir nova aba. Guardar horário e, se acessível sem revelar segredos, nome/URL do JS `/assets/index-*.js` em cada execução. Comparar nomes/hash do bundle; se idênticos, investigar se o contexto está realmente executando o mesmo build. Se diferentes, solicitar build ID/SHA por contexto ao suporte. O HTTP 401 obtido por agente sem sessão não substitui teste autenticado.
### Gate
NÃO usar `Publish`; não fazer fallback de chave no Vite; não retirar `.env` do `.gitignore`; não alterar cliente Supabase. Sem evidência de bundle, causa exata **UNKNOWN**; preview **FAIL intermitente/condicional observado**, não PASS estável.
