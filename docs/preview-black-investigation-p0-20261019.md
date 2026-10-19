# OPERA Atlas — investigação P0 do preview (19/10/2026)

Estado: **preview ainda BLOCKED neste ambiente; causa da tela preta UNKNOWN.**  
PR relacionado: https://github.com/HorusHypnotic/opera-atlas/pull/4  
PR de integração existente: https://github.com/HorusHypnotic/opera-atlas/pull/5 (Draft; contém alterações de banco e não deve ser mesclado como correção do preview).

## URLs e navegador

| URL | Estado observado nesta rodada |
|---|---|
| `https://preview--opera-atlas.lovable.app` | Redireciona para login da Lovable com retorno ao preview |
| `https://id-preview--5198af1a-2d9b-4863-aced-2ac8cd06e9a9.lovable.app` | Redireciona para login da Lovable com retorno ao preview |
| `https://opera-atlas.lovable.app` | Landing carregou e renderizou no Chrome remoto |

Ambas as URLs de preview abriram a tela de login da Lovable. A sessão do Chrome remoto está separada da sessão já autenticada do usuário no PC. Não houve nova tentativa de autenticação depois da recusa anterior de login nessa sessão automatizada. O acesso à aplicação preview, ao Console e à Network permanece bloqueado por essa barreira neste ambiente; isso não demonstra falha da conta ou do navegador local do usuário.

Na produção, a landing foi inspecionada visualmente e o botão “Entrar” navegou para `/login`. A página exibiu “Entrar com Google” e “Entrar como Convidado (Demo)”. Não foi feito login, não foi aberto o fluxo de dados autenticado e nenhum dado foi gravado. Esta verificação de navegação não altera produção.

## Estado atual do projeto Lovable

A conexão Lovable autorizada do Work retornou o projeto exato `5198af1a-2d9b-4863-aced-2ac8cd06e9a9`, `status=ready`, SHA `3301911686b576ebbc096c6eda0a12bcdfab48a8`, visibilidade `workspace_edit` e audiência publicada `public`. A última edição informada é 19/08/2026. A captura fornecida pelo conector tem data de agosto e mostra uma tela escura vazia; por ser histórica, não prova a aparência atual. `ready` também não comprova renderização funcional.

## Build e regressão local

- Main `3301911686b576ebbc096c6eda0a12bcdfab48a8`: `npm ci`, `npm run build` PASS; `npm test` PASS (1 arquivo, 1 teste), execução anterior registrada.
- PR #4 `4664a094c5d667463b822bfbb1ac72693781e801`: `npm run build` PASS; `npm test` PASS (1 arquivo, 1 teste), execução anterior registrada.
- Não foi executado novo build nesta rodada porque o checkout local anterior não está disponível neste ambiente.
- Os builds anteriores avisaram sobre bundle acima de 500 kB e base caniuse desatualizada, sem falhar.
- No checkout anterior, `.env` e `.env.local` não existiam; `.env.example` declara os nomes `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Valores do ambiente Lovable não foram consultados.
- A busca anterior no código não encontrou registro de Service Worker.

A leitura da fonte em `3301911686b576ebbc096c6eda0a12bcdfab48a8` mostrou que `src/main.tsx` importa `App` e monta React sem ErrorBoundary externo; `src/integrations/supabase/client.ts` chama `createClient` diretamente com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, sem validação explícita. Se uma variável estiver ausente, isso pode interromper a inicialização antes da montagem React e deixar o fundo escuro visível. **Hipótese CANDIDATE, não causa comprovada:** o acesso autorizado disponível não revela presença das variáveis e os valores não foram lidos.

O build PASS não prova autenticação, carregamento de assets no hosting, montagem React nem navegação autenticada.

## Decisão

- O preview não foi validado visualmente porque ambas as URLs exigiram a sessão Lovable que não está disponível neste Chrome remoto.
- O estado anterior de tela escura continua sendo evidência histórica; a causa segue UNKNOWN. Não há base técnica suficiente para escolher ou aplicar uma correção de código.
- PR #4 adiciona ErrorBoundary e fallback pré-React. O build anterior passou, mas isso não explica nem resolve a barreira atual de autenticação do preview.
- Não mesclar PR #4/#5, não alterar produção, não publicar e não executar migrations.
- Nenhuma alteração em Supabase hospedado foi feita; nenhuma tentativa de usar Lovable AI foi feita.
- Main consultada: `3301911686b576ebbc096c6eda0a12bcdfab48a8`. PR #2: `5ea5e59e70f28126d2014e8121a5b04d6a6d3a86`; PR #3: `70eedcfdf1b808b746999d84630036819cad924f`; PR #4: `4664a094c5d667463b822bfbb1ac72693781e801`; PR #5 no início desta rodada: `eddbe18be04bab090a7d9724f56228c8692963fb`.

Próximo gate: obter uma sessão de preview autenticada neste navegador Work pelo fluxo Google autorizado; então comparar Console/Network, conferir apenas a presença das variáveis sem revelar valores, reproduzir o build no SHA exato e aplicar somente uma correção reversível se a causa for reproduzida. Revalidar a produção sem autenticar nem gravar dados. Nenhum merge, publicação ou deploy sem aprovação.
