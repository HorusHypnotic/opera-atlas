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
