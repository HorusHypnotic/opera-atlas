# OPERA Atlas — investigação P0 do preview (19/10/2026)

Estado: **preview BLOCKED por acesso; causa da tela preta UNKNOWN.**
PR relacionado: https://github.com/HorusHypnotic/opera-atlas/pull/4
PR de integração existente: https://github.com/HorusHypnotic/opera-atlas/pull/5 (permanece Draft; contém alterações de banco e não deve ser mesclado como correção do preview).

## URLs e navegador

| URL | HTTP / estado observado |
|---|---|
| `https://preview--opera-atlas.lovable.app` | HTTP 401; o navegador redirecionou para a tela de login da Lovable |
| `https://id-preview--5198af1a-2d9b-4863-aced-2ac8cd06e9a9.lovable.app` | HTTP 401; mesma barreira de login |
| `https://opera-atlas.lovable.app` | HTTP 200; landing do Atlas renderizada visualmente |

Na landing de produção, clicar em “Entrar” navegou para `/login`; a tela exibiu os campos de e-mail/senha e as opções Google e convidado Demo. Não foi feito login nem acessado o fluxo de escrita da produção.

Os dois previews não expuseram o app, Console ou Network da aplicação: ambos pararam na autenticação Lovable. O redirecionamento exibiu um identificador interno `lovp_…`, diferente do UUID usado no URL informado para o projeto; isso é uma observação, não prova de associação incorreta. É necessário acesso autenticado para comparar o projeto e o preview efetivamente servido.

## Build e regressão local

- Main `3301911686b576ebbc096c6eda0a12bcdfab48a8`: `npm ci`, `npm run build` PASS; `npm test` PASS (1 arquivo, 1 teste).
- PR #4 `4664a094c5d667463b822bfbb1ac72693781e801`: `npm run build` PASS; `npm test` PASS (1 arquivo, 1 teste).
- O build apresenta avisos de bundle acima de 500 kB e base caniuse desatualizada; não falha.
- No checkout, `.env` e `.env.local` não existem; `.env.example` declara os nomes `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Valores configurados no ambiente Lovable não foram consultados.
- A busca no código por registro de Service Worker não encontrou `serviceWorker`, `registerSW` ou `navigator.serviceWorker`.

O erro de inicialização não foi reproduzido porque as URLs do preview não entregaram a aplicação. O build PASS não prova autenticação, carregamento de assets no hosting, montagem React nem navegação autenticada.

## Decisão

- PR #4 adiciona ErrorBoundary e fallback pré-React. O build passou, mas essa mudança não explica nem resolve o HTTP 401 do preview e não pode ser declarada correção da tela preta.
- Não foi feita correção de código nesta rodada: falta Console/Network e acesso ao conteúdo do preview para identificar a falha. Não mesclar PR #4/#5 nem alterar produção.
- Nenhuma migration foi executada; nenhum Supabase hospedado foi alterado; nenhuma publicação/deploy foi iniciado por esta investigação.
- Main consultada: `3301911686b576ebbc096c6eda0a12bcdfab48a8`. PR #2: `5ea5e59e70f28126d2014e8121a5b04d6a6d3a86`; PR #3: `70eedcfdf1b808b746999d84630036819cad924f`; PR #4: `4664a094c5d667463b822bfbb1ac72693781e801`; PR #5: `8ed08d3dfb3ebd7dadbd776abda7f34cb8cc4b4f`.

Próximo gate: entrar na Lovable pela conta e método escolhidos pelo usuário, conferir o ID real do projeto, abrir os previews, coletar erros de Console e falhas de Network sem mostrar valores das variáveis, então reproduzir em build local e aplicar a menor correção reversível. Revalidar produção após qualquer candidato; nenhum merge/deploy sem nova aprovação.
