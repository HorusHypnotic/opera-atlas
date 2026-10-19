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

Os dois previews não expuseram o app, Console ou Network da aplicação no navegador Work: ambos pararam na autenticação. O redirecionamento exibiu um identificador interno `lovp_…`, diferente do UUID do projeto; isso é uma observação, não prova de associação incorreta. A sessão Chrome do usuário é separada da sessão do navegador Work.

Depois disso, a conexão Lovable autorizada do Work conseguiu ler o projeto sem novo login interativo: `get_project` retornou o projeto exato, estado `ready`, `latest_commit_sha` `3301911686b576ebbc096c6eda0a12bcdfab48a8`, visibilidade `workspace_edit` e audiência publicada `public`. A captura fornecida pelo conector aparece como uma tela escura vazia. O projeto informa última edição em 19/08/2026; portanto, essa captura não comprova a aparência atual do preview. O estado `ready` também não comprova renderização funcional.

Uma tentativa de login pelo navegador Work recebeu `Login denied due to suspicious activity`. Isso descreve o bloqueio daquela sessão automatizada, não prova falha na conta ou na sessão local do usuário. Nenhum novo login foi tentado após a recusa. A leitura do projeto e dos arquivos pelo conector foi somente leitura.

## Build e regressão local

- Main `3301911686b576ebbc096c6eda0a12bcdfab48a8`: `npm ci`, `npm run build` PASS; `npm test` PASS (1 arquivo, 1 teste).
- PR #4 `4664a094c5d667463b822bfbb1ac72693781e801`: `npm run build` PASS; `npm test` PASS (1 arquivo, 1 teste).
- O build apresenta avisos de bundle acima de 500 kB e base caniuse desatualizada; não falha.
- No checkout, `.env` e `.env.local` não existem; `.env.example` declara os nomes `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Valores configurados no ambiente Lovable não foram consultados.
- A busca no código por registro de Service Worker não encontrou `serviceWorker`, `registerSW` ou `navigator.serviceWorker`.

O erro de inicialização ainda não foi reproduzido no preview ao vivo. A leitura da fonte em `3301911686b576ebbc096c6eda0a12bcdfab48a8` mostrou que `src/main.tsx` importa `App` e monta React sem ErrorBoundary externo; `src/integrations/supabase/client.ts` chama `createClient` diretamente com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, sem validação explícita. Se uma dessas variáveis estiver ausente, isso pode interromper a inicialização antes da montagem React e deixar o fundo escuro visível. **Hipótese CANDIDATE, não causa comprovada:** a presença no ambiente Lovable não está acessível pelo conector e os valores não foram lidos.

O build PASS não prova autenticação, carregamento de assets no hosting, montagem React nem navegação autenticada.

## Decisão

- PR #4 adiciona ErrorBoundary e fallback pré-React. O build passou, mas essa mudança não explica nem resolve o HTTP 401 do preview e não pode ser declarada correção da tela preta.
- Não foi feita correção de código nesta rodada: falta Console/Network e acesso ao conteúdo do preview para identificar a falha. Não mesclar PR #4/#5 nem alterar produção.
- Nenhuma migration foi executada; nenhum Supabase hospedado foi alterado; nenhuma publicação/deploy foi iniciado por esta investigação.
- Main consultada: `3301911686b576ebbc096c6eda0a12bcdfab48a8`. PR #2: `5ea5e59e70f28126d2014e8121a5b04d6a6d3a86`; PR #3: `70eedcfdf1b808b746999d84630036819cad924f`; PR #4: `4664a094c5d667463b822bfbb1ac72693781e801`; PR #5: `8ed08d3dfb3ebd7dadbd776abda7f34cb8cc4b4f`.

Próximo gate: obter uma captura atual e acesso de diagnóstico ao preview, conferir Console/Network e presença das variáveis sem revelar valores, reproduzir a inicialização em build local e então aplicar a menor correção reversível. O conector atual lê metadados e arquivos, mas a captura disponível está datada de agosto e não expõe configurações do ambiente. Revalidar produção após qualquer candidato; nenhum merge/deploy sem nova aprovação.
