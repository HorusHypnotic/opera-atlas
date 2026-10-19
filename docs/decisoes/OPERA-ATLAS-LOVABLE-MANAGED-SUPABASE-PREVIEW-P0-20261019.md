# OPERA Atlas | P0 preview externo e configuração Lovable (2026-10-19)

Estado: DIAGNOSTICADO / CORREÇÃO PENDENTE / SEM AUTORIZAÇÃO DE PUBLICAÇÃO.

## Fonte de verdade
- Projeto Lovable: `5198af1a-2d9b-4863-aced-2ac8cd06e9a9`, conta `dinastypce@gmail.com`.
- Repositório de produto: `HorusHypnotic/opera-atlas`. SHA de referência: `2b06fc5cee4903d4ac1e1b979215f23adcab788f`.
- Backend Supabase do Atlas é GERENCIADO PELO LOVABLE. Não solicitar conexão com projeto Supabase externo nem tratá-la como bloqueio P0.
- Barramento PETECO em outro repositório: `HorusHypnotic/vitrinedigital-cod` issue #581. Issue de investigação: `HorusHypnotic/opera-control-tower` #106. Issue #106 não é automaticamente consumida pelo worker.
- Worker observado no Termux ativo; script define `PETECO_CONTROL_REPO=HorusHypnotic/vitrinedigital-cod` e `PETECO_CONTROL_ISSUE=581` quando ausentes no ambiente. Ausência de `~/.tower/runtime/peteco-control-issue` NÃO constitui falha: seletor é variável de ambiente.
- O PETECO V2 atual executa SOMENTE targets/capabilities allowlisted. PASS de `vitrine-readonly-brief` prova transporte/contrato do brief, NÃO diagnóstico semântico nem acesso ao ambiente do Atlas. Não despachar `target=atlas` ou shell arbitrário sem evidência de capacidade instalada e autorizada.

## Arqueologia e hipótese
- Em 2026-08-19, commit `3301911686b576ebbc096c6eda0a12bcdfab48a8` removeu `.env` versionado, adicionou `.env.example` e regras de gitignore. NÃO restaurar, copiar nem citar valores históricos de chave.
- `src/integrations/supabase/client.ts` já exigia `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` antes dessa mudança.
- Em 2026-10-19, bootstrap ganhou diagnóstico explícito; o PR #11 recuperou apenas a URL pública a partir de `supabase/config.toml`, NÃO a chave.
- Sintoma observado anteriormente: `ATLAS-CONFIG-KEY` no preview externo. Isso indica variável ausente naquele bundle/build, mas NÃO comprova por si só que a remoção do `.env` em agosto causou a falha.
- Distinguir: GitHub SHA sincronizado ≠ configuração do ambiente sincronizada ≠ preview reconstruído ≠ produção publicada.

## Procedimento de correção, em ordem
1. Confirmar SHA de Lovable e main e observar preview externo sem revelar variáveis.
2. Comparar configuração do preview interno e externo no painel/controle do próprio Lovable; confirmar injeção de `VITE_SUPABASE_PUBLISHABLE_KEY` **somente como presente/ausente**, nunca imprimir seu valor.
3. Se faltar configuração, restaurar pelo mecanismo oficial do Lovable usando credencial autorizada, com aprovação humana quando a operação afetar integração/ambiente. Não reutilizar chave de commit antigo.
4. Recompilar/atualizar **somente preview**, se o fluxo permitir, sem publicar produção; verificar ausência de `ATLAS-CONFIG-KEY` e executar QA de navegação e autenticação.
5. Registrar PASS/FAIL/BLOCKED, SHA, ambiente, horário, testes e evidência. Sem evidência runtime, status UNKNOWN.
6. Caso PETECO seja usado: primeiro verificar capability allowlisted específica de Atlas, produzir brief versionado e invocar pelo barramento #581 somente com SHA exato e capacidade validada. Não confundir criação de issue com execução.

## Restrições
Sem GitHub Actions, migrations, edição de `src/integrations/supabase/client.ts`, credenciais em GitHub/logs/chat, Lovable AI/créditos, merge ou publicação sem aprovação. Reutilizar antes de criar. Mudança mínima e reversível.

## Critério de conclusão
Preview externo acessível, inicialização sem erro de configuração, smoke test de telas e login autorizado, SHA confirmado, evidência registrada. Até então: PREVIEW UNKNOWN / P0 ABERTO.
