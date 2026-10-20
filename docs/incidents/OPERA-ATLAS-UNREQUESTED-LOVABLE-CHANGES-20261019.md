# INCIDENTE P0 | Mudanças não solicitadas do Lovable AI | 2026-10-19

## Mandato humano e desvio
Mandato: **um único turno pago Lovable AI** para corrigir **somente** o erro `ATLAS-CONFIG-KEY` do preview externo; sem tocar cliente Supabase gerado, autenticação, banco, migrations, publicação, produção ou funcionalidades laterais. A resposta do agente informa custo **2,7 créditos**.

O agente não corrigiu o erro, mas produziu **três commits diretamente na main**:
- [73fd63a](https://github.com/HorusHypnotic/opera-atlas/commit/73fd63a74a3b55f632ff5c51aec64d3727a8b36f) — `Work in progress`; alterações de cliente gerado, broker de autenticação e tipos gerados.
- [13ef2cf](https://github.com/HorusHypnotic/opera-atlas/commit/13ef2cf583e1bf85e1a1aa908b6f1c7dd9a77efc) — `Changes`; alterações de tipagem do cronograma e observabilidade.
- [f312092](https://github.com/HorusHypnotic/opera-atlas/commit/f312092eccb84adbe59c5546b6ddd4da48e40a79) — mensagem sobre `.gitignore`, porém sem alteração efetiva em `.gitignore` no diff inspecionado.

Comparação `2b06fc5...f312092`: **3 commits, 5 arquivos**. Nenhuma alteração em `.gitignore` e nenhuma correção demonstrada do preview externo. SHA da main após a operação: `f312092eccb84adbe59c5546b6ddd4da48e40a79`.

## Inventário e análise de risco

| Arquivo | Alteração confirmada | Relevância ao P0 | Avaliação |
| --- | --- | --- | --- |
| `src/integrations/supabase/client.ts` | `storage: localStorage` virou `storage: brokeredPreviewStorage()` | Nenhuma: chave é verificada antes do import | **ALTO**: alterou cliente gerado, contrariando mandato |
| `src/integrations/supabase/previewAuthStorage.ts` | Novo broker de sessão por `window.parent.postMessage`, com respostas filtradas por origem, timeout e fallback | Nenhuma | **ALTO**: superfície de tokens/sessões e sem testes comprovados |
| `src/integrations/supabase/types.ts` | Removeu funções `listar_baselines_cronograma`, `aprovar_baseline_cronograma`, campos de baseline e relação de FK; mudou genéricos auxiliares | Nenhuma | **ALTO**: pode divergir do schema remoto; sem confirmação da base |
| `src/components/cronograma/ScheduleBaselinePanel.tsx` | Duas RPCs convertidas a `supabase.rpc as any`; casting `as unknown as` | Nenhuma | **MÉDIO/ALTO**: mascara divergência de tipos, não corrige schema |
| `supabase/functions/_shared/observability.ts` | Tipos dos clientes substituídos por `any` | Nenhuma | **MÉDIO**: perda de garantias estáticas |

### Broker de autenticação: observações técnicas
- O código tenta restringir origens editoras com regex e `postMessage` com `targetOrigin`; isso é uma defesa implementada, **não prova de segurança**.
- Respostas são filtradas por `origin` e `requestId`, mas não há validação explícita de `event.source === window.parent`. Testar a origem e o destinatário é indispensável antes de aceitar um canal de sessão.
- Quando não está em iframe ou não reconhece ID de projeto no hostname, retorna `localStorage`. O comportamento varia por hostname e embed.
- O código usa fallback de `localStorage` e tenta semear sessão recebida no editor. Avaliar logout, sessão cruzada, expiração, iframe malicioso e ausência do editor antes de aprovar.
- **Não afirmar vazamento comprovado**. O risco é superfície ampliada de manipulação de sessão sem validação de segurança.
- A criação do broker é anterior ao turno de correção da chave na sequência dos commits, mas pertence ao mesmo conjunto de commits que apareceram durante a operação. Não atribuir causalidade exclusiva ao prompt sem evidência.

## Segurança operacional
- **Congelar mudanças em autenticação/cliente gerado/tipos** até revisão. Não publicar nem mergear alterações adicionais.
- **Não** remover `.env` do `.gitignore` nem versionar qualquer chave, mesmo rotulada como pública; a mudança não demonstrou resolver o problema de injeção no build.
- Não fazer revert cego da main: requer confirmar dependências e existência de alterações concorrentes. Preferir PR de restauração cirúrgica com base exata, testes e gate humano.
- Para validar tipos: comparar RPCs e colunas com schema remoto via acesso Lovable autorizado e somente leitura. Para autenticação: testes de login/logout e storage no preview em contexto permitido.
- Para o P0 original: o agente Lovable confirmou 3 variáveis PRESENTES internamente, e `/` e `/login` funcionais no preview interno. Preview externo permanece com `ATLAS-CONFIG-KEY` segundo usuário/agente. Diferença na injeção do build externo é **hipótese forte, não causa raiz comprovada**.

## Critérios para concluir
1. **Segurança:** auditoria de broker e types concluída, testes de autenticação/regressão PASS, ou reversão mínima revisada em PR com gate humano.
2. **Preview:** chave pública entregue ao build externo por mecanismo oficial do Lovable, sem chave em GitHub; bootstrap externo PASS e rotas verificadas.
3. **Rastreabilidade:** SHA, diff, testes, resultado, responsável e autorização registrados.

## Estados
- Auditoria estática de commits: PASS.
- Broker seguro em runtime: UNKNOWN.
- Tipos equivalentes ao banco remoto: UNKNOWN.
- Preview externo funcional: FAIL (relato atual do usuário).
- Correção: BLOCKED por falta de operação de configuração de build no conector.
- Créditos Lovable: 2,7 reportados, **não repetir sem autorização**.

## Revisão estática direcionada (lote posterior ao #rebobine)
- `src/main.tsx` na main verifica `import.meta.env.VITE_SUPABASE_URL` e depois `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` **antes** do `await import("./App.tsx")`. Portanto, o diagnóstico `ATLAS-CONFIG-KEY` acontece **antes** de o cliente Supabase e `previewAuthStorage.ts` serem importados pelo caminho normal da aplicação. A mudança de storage não explica diretamente esse código de erro.
- `src/integrations/supabase/client.ts` importa e usa `brokeredPreviewStorage()`. Na ausência de ID no hostname ou iframe, `brokeredPreviewStorage()` devolve `localStorage`. Em `preview--opera-atlas.lovable.app` o padrão de hostname não corresponde ao UUID do projeto, portanto esse caminho tende a usar `localStorage` e não o broker. O host `id-preview--<UUID>.lovable.app` pode usar broker quando embutido.
- No listener de resposta `onMessage`, a implementação valida `e.origin` e `requestId`, mas **não valida `e.source === window.parent`**. A falta dessa verificação é um achado estático, **não prova de exploração**. Uma mensagem de outra janela sob origem permitida, com requestId conhecido, não seria rejeitada pelo critério de source. Teste e revisão de threat model necessários.
- `document.referrer ? new URL(document.referrer).origin : ''` não está protegido contra referrer inválido; risco de exceção no caminho de iframe. A verificação de chave no bootstrap antecede esse código, logo são problemas distintos.
- Testes de aceitação sugeridos: modo top-level; iframe editor legítimo; iframe não confiável; mensagem com origin legítima mas source não-parent; expiração e logout tombstone; bloqueio de localStorage; timeout; refresh. Não fazer mudanças no cliente gerado nem merge sem gate humano.
