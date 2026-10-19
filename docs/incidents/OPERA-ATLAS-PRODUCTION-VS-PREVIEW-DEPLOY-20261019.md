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
