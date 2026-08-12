# Auditoria de identidade e arquitetura — OPERA Atlas

**Data:** 2026-08-12
**Natureza:** investigação somente leitura
**Escopo:** repositório, artefato público, frontend, Supabase, documentação e histórico Git
**Fora do escopo:** publicar, corrigir, renomear, mover, apagar, aplicar migrations ou reconectar integrações

## Resumo executivo

O repositório `HorusHypnotic/opera-atlas` contém hoje um SaaS multi-tenant autenticado de gestão operacional de obras, construído em React/Vite e Supabase. O núcleo implementado acompanha mão de obra, materiais, ativos, riscos, retrabalho, segurança, produtividade, cronograma, custos e fechamento de períodos. A constituição interna chama esse núcleo de **Opera/Atlas** e o banco comercial cadastra **O.P.E.R.A. Atlas** e **O.P.E.R.A. Control** como produtos separados.

A inconsistência principal está na borda comercial: a landing dentro do repositório e no bundle live usa **O.P.E.R.A. Control**, embora o domínio, o repositório, textos de relatórios e a constituição técnica apontem para **Atlas**. “O.P.E.R.A. Construction Hub” não ocorre no código, migrations, documentação nem histórico textual pesquisado; é, pelas evidências disponíveis, o nome do projeto/editor Lovable e não uma identidade implementada no produto.

Conclusão mais provável: há uma combinação de **produtos distintos no portfólio** (Atlas e Control) com **branding misturado no mesmo deploy**. O aplicativo autenticado é predominantemente Atlas; a landing é Control; Construction Hub é um rótulo externo do contêiner/editor.

## 1. Estado Git

| Item | Evidência em 2026-08-12 |
|---|---|
| Repositório | `https://github.com/HorusHypnotic/opera-atlas.git` |
| Branch | `main` |
| HEAD | `6484ddde336fba2c1b6af1d6290c57776a041a6a` |
| `origin/main` | `6484ddde336fba2c1b6af1d6290c57776a041a6a` |
| Divergência | nenhuma; `HEAD == origin/main` |
| Commits locais não enviados | nenhum |
| Commits remotos não integrados | nenhum |
| Working tree antes da auditoria | limpa |
| Tags | nenhuma |
| Branches relevantes | somente `main` e `origin/main` |

Os commits recentes relevantes são `6484ddd fix: restaura reprodutibilidade do OPERA Atlas`, `fe6c381 feat: adiciona dominio comercial do portfolio` e `eae46dd feat: corrige relatorios e adiciona compartilhamento WhatsApp`.

Esta auditoria cria apenas este documento; não foi feito commit nem push.

## 2. Live, preview e publicação

| Estado | Revisão | Conteúdo provado |
|---|---|---|
| GitHub main | `6484ddd` | fonte atual do repositório |
| Lovable Previewing | **NÃO CONFIRMADO** | a interface observada pelo usuário indica publicação pendente, mas a revisão não está disponível no repositório |
| Live | commit **NÃO CONFIRMADO** | `https://opera-atlas.lovable.app` responde 200 e serve `/assets/index-C94YJeGE.js` |
| Pendente de publicação | **NÃO CONFIRMADO** | não é possível enumerar sem acessar o estado interno do editor |

O SHA-256 do bundle live é `74646D84E82072761FF97D283E929E5969AE60DE6D61BFF5AC747FFE4C315C14`, idêntico ao `dist/assets/index-C94YJeGE.js` local. O bundle live contém “O.P.E.R.A. Control”, “O.P.E.R.A. Atlas”, “Controle de obra que mostra”, “Participar do Beta” e “Experimentar grátis”; não contém “Construction Hub”. Como `dist/` é ignorado pelo Git, essa igualdade comprova o conteúdo servido, mas não vincula formalmente o artefato a um commit.

Os metadados live são “Método O.P.E.R.A. — Gestão de Obras” e descrevem dashboard com KPIs de mão de obra, insumos, ativos, perdas e financeiro. Não se deve equiparar Previewing e live.

## 3. Inventário funcional

```text
APLICAÇÃO
├── Entrada pública
│   ├── Landing comercial Control (/landing)
│   ├── Beta e status (/beta, /beta-status)
│   ├── Login, convite e recuperação (/login, /invite, /reset-password)
│   └── Setup de tenant autenticado (/setup)
├── Núcleo autenticado Atlas
│   ├── Dashboard e inteligência (/)
│   ├── Método O.P.E.R.A. (/organizacao, /padronizacao, /eficiencia,
│   │   /reducao-perdas, /analise-continua)
│   ├── Segurança, qualidade e correção
│   ├── Obras, colaboradores e presença
│   ├── Financeiro, economia e relatório de equipe
│   ├── Cronograma Gantt e baseline
│   └── Pesquisa piloto versus controle
└── Administração
    ├── tenants, usuários, papéis e acesso por obra
    ├── beta, convites e códigos
    ├── períodos fechados/reaberturas
    ├── auditoria e exportação
    └── superadmin
```

| Módulo | Rota | Finalidade / dados principais | Estado aparente |
|---|---|---|---|
| Landing | `/landing` | oferta Control, pacotes, FAQ, formulário, WhatsApp, beta | ATIVO, identidade conflitante |
| Auth/setup | `/login`, `/invite`, `/reset-password`, `/setup` | Supabase Auth, profiles, tenants, user_roles, invites | ATIVO |
| Dashboard | `/` | agregados de registros, consumo, ativos, riscos, retrabalho, finanças, incidentes e presença | ATIVO |
| Organização | `/organizacao` | registros diários, presença e organização de equipe | ATIVO |
| Padronização | `/padronizacao` | materiais, lotes, estoque, compras | ATIVO |
| Eficiência | `/eficiencia` | ativos, ciclos, logística e produtividade | ATIVO |
| Redução de perdas | `/reducao-perdas` | riscos, retrabalho e desperdício | ATIVO |
| Análise contínua | `/analise-continua` | sequenciamento, aditivos e lançamentos financeiros | ATIVO |
| Segurança/qualidade | `/seguranca-qualidade` | incidentes e indicadores | ATIVO |
| Ações/checklist | `/acoes-corretivas`, `/checklist` | acompanhamento corretivo e verificação semanal | ATIVO |
| Obras/equipe | `/obras`, `/colaboradores`, `/relatorio-mao-obra` | obras, membros, colaboradores, presença, diárias, folha e exportações | ATIVO |
| Economia | `/economia` | fluxo financeiro, custos de retrabalho, burn rate e economia estimada | ATIVO |
| Cronograma | `/cronograma` | atividades, dependências, Gantt e baseline append-only | ATIVO |
| Pesquisa | `/pesquisa` | cadastro isolado de obras de pesquisa piloto/controle | PARCIAL/experimental |
| Administração | `/admin` | governança, RBAC, períodos, auditoria, beta e exportação | ATIVO |
| `src/pages/Index.tsx` | sem rota | fallback Lovable “Blank App” não importado por `App.tsx` | ÓRFÃO |
| Domínio `portfolio_*` | sem UI principal correspondente | funil e catálogo comercial separados do core Atlas | PARCIAL/backend |

Não existem diretórios `routes/`, `services/`, `schemas/` ou storage versionado como pastas próprias. As rotas ficam em `src/App.tsx`; serviços são distribuídos entre hooks, `src/lib`, integrações e Edge Functions; o schema é reconstruído pelas migrations. Assets ficam em `public/`; não há logos de produto claramente separados.

## 4. Identidades encontradas

| Identidade | Classificação | Evidência |
|---|---|---|
| OPERA / Método O.P.E.R.A. | visual, técnica e metodológica | sidebar, login, dashboard, analytics, relatórios e documentação |
| O.P.E.R.A. Atlas | técnica/comercial | repositório/domínio, exports de relatório, migrations “Atlas pre-piloto”, catálogo `portfolio_products` |
| O.P.E.R.A. Control | visual/comercial | header/footer/CTAs da landing e produto separado no catálogo |
| O.P.E.R.A. Construction Hub | indeterminado/externo | ausente do código, docs, migrations e bundle live; conhecido somente pelo rótulo do editor Lovable |
| `opera-atlas.lovable.app` | domínio | manual, constituição e produção HTTP |
| `vite_react_shadcn_ts` | identidade técnica genérica/legada | `package.json` |

O histórico textual associa Control ao commit da landing e Atlas ao núcleo/relatórios. O commit do domínio comercial é a evidência mais forte contra tratar os dois nomes como simples sinônimos: ele cria duas linhas distintas, com maturidade e ofertas distintas (`Atlas` em produção; `Control` em validação).

## 5. Genealogia provável

1. **Método O.P.E.R.A.** é a metodologia/guarda-chuva e também o nome visual do app.
2. **Atlas** é a aplicação SaaS operacional multi-tenant implementada neste repositório.
3. **Control** é um produto/oferta comercial separado, em validação, cuja landing foi colocada dentro do deploy Atlas.
4. **Construction Hub** parece ser o nome histórico ou administrativo do projeto Lovable, sem representação funcional no código.
5. Existem resíduos Lovable genéricos (`README` template, package name e `Index.tsx` órfão), mas não formam outro produto.

Essa genealogia é provável, não uma decisão canônica formal. A documentação formal define Opera/Atlas, mas não contém uma decisão explícita “Atlas = X; Control = Y; Construction Hub = Z”.

## 6. Landing atual

A landing tem hero (“Controle de obra que mostra o desvio antes dele virar prejuízo”), proposta de leitura contínua de custo/prazo/produtividade, seção de problemas, cinco pilares O.P.E.R.A., pacotes Essencial/Gestão/Estratégico, perfil profissional, métricas, formulário, WhatsApp, FAQ extenso, beta/demo e footer Control.

| Afirmação | Classificação | Fundamentação |
|---|---|---|
| leitura contínua de custo, prazo e produtividade | COMPROVADO | dashboard, analytics, cronograma e financeiro existem |
| alertas de desvios/riscos | COMPROVADO | analytics, risk matrix, alertas e ações corretivas existem |
| cinco pilares cobrem 100% da operação | MARKETING | cinco módulos existem; cobertura de 100% não é demonstrada |
| redução de custos de 20–49% “comprovada” | PLAUSÍVEL MAS NÃO DOCUMENTADO | landing atribui a sistema próprio de cotação; não há estudo/casos no repositório |
| 8–11 frentes simultâneas | PLAUSÍVEL MAS NÃO DOCUMENTADO | apresentado como experiência pessoal, sem fonte verificável no repositório |
| 150+ fornecedores | PLAUSÍVEL MAS NÃO DOCUMENTADO | não há base/evidência versionada |
| 5+ anos em campo | PLAUSÍVEL MAS NÃO DOCUMENTADO | não há comprovação versionada |
| fluxo de caixa/análise financeira | COMPROVADO | lançamentos, agregações, economia e relatórios existem |
| inteligência preditiva/alertas preditivos | PARCIAL / MARKETING | há analytics determinísticos; não foi encontrado modelo preditivo validado |
| consultoria operacional mensal | NÃO DETERMINADO | serviço externo ao software, não comprovável pelo código |
| beta, vagas e demo grátis | PARCIAL | fluxos beta e contagem existem; condições comerciais atuais não são provadas pelo código |

A landing descreve razoavelmente capacidades do aplicativo, mas representa o produto como **Control** e agrega promessas/serviços não demonstrados. Portanto, ela não representa corretamente a identidade e a maturidade do app Atlas, embora reutilize várias capacidades reais dele.

## 7. Aplicação autenticada

O app autenticado oferece dashboard por obra/período, cadastro de obras, gestão multi-tenant e papéis, registros diários, materiais/estoque/compras, ativos, produtividade/presença, riscos, retrabalho, incidentes, ações corretivas, checklist, lançamentos financeiros, aditivos, relatório/folha de equipe, economia, exportação PDF/XLSX/CSV, cronograma Gantt, baseline, fechamento e reabertura auditada de períodos.

Ele se comporta mais como **Atlas**: é amplo, analítico, multiobra, multi-tenant e reúne os cinco pilares, não apenas uma camada comercial de “controle”. A constituição `.lovable/OPERA_CORE.md` o define como infraestrutura operacional contextual e motor verificável de operações físicas, inicialmente construção civil.

## 8. Modelo de dados

```text
tenant
├── profiles / user_roles
├── obras ── obra_membros
│   ├── registros_diarios
│   ├── consumo_materiais / lotes_consumo / lote_materiais
│   ├── ativos / riscos / retrabalhos / incidentes_seguranca
│   ├── compras_emergenciais / aditivos_contratuais
│   ├── sequenciamento_equipes / logistica_interna / ciclos_tarefa
│   ├── colaboradores ── colaborador_obras
│   │   └── registro_presencas / apontamento_diarias
│   ├── lancamentos_financeiros
│   ├── atividades ── atividade_dependencias / cronograma_baseline
│   └── periodos_fechados ── periodos_reaberturas
├── audit_logs / audit_logs_db / system_events
└── convites, beta e configuração

portfolio_* (domínio comercial separado)
companies ── leads ── diagnoses/interests/history/events
products ── versions ── offers
```

As relações críticas são delimitadas por `tenant_id` e, quando aplicável, `obra_id`. O schema contém soft delete em entidades centrais, trilhas de auditoria, snapshots JSON e hashes de fechamento, baseline append-only e eventos de reabertura. Não foi encontrada entidade genérica de orçamento/budget completa nem contas a pagar/receber; o próprio OPERA_CORE proíbe que o núcleo vire ERP financeiro genérico.

## 9. Financeiro

Existem:

- `lancamentos_financeiros`, com receitas/despesas/categorias usadas em fluxo e gráficos;
- `aditivos_contratuais` e `compras_emergenciais`;
- custos de materiais, mão de obra, ativos, retrabalho e desperdício;
- `registro_presencas` + `apontamento_diarias` e RPC `folha_pagamento`;
- `periodos_fechados` com `snapshot_json`, hash, versão e validação;
- `periodos_reaberturas` append-only e RPCs de reabrir/refechar/histórico;
- indicadores de burn rate, economia estimada, fluxo, saldo e custo por categoria;
- exportações PDF/XLSX/CSV e compartilhamento de resumo por WhatsApp.

O cronograma possui baseline próprio (`cronograma_baseline`); não há uma baseline financeira genérica identificada. Snapshots estão ligados principalmente ao fechamento de folha/período.

## 10. Mecanismos temporais e exclusão

Foi encontrada a origem provável da mensagem de exclusão iminente.

| Elemento | Evidência |
|---|---|
| Frontend | `src/components/dashboard/DataRetentionBanner.tsx`, renderizado no dashboard |
| Prazo | 3 meses; avisos nos últimos 30 dias, 7 dias e 24 horas |
| Tabelas mostradas | registros diários, consumo, incidentes, lançamentos financeiros e retrabalhos |
| Backend | `supabase/functions/data-retention/index.ts` |
| Autorização | segredo de cron ou usuário confirmado como superadmin |
| Ação | hard delete via service role de registros com `created_at < hoje - 3 meses` |
| Escopo real | 14 tabelas operacionais, incluindo `lancamentos_financeiros` |
| Agendamento | **NÃO CONFIRMADO**; há suporte a cron, mas nenhum schedule/cron versionado foi encontrado |

Risco preliminar **CRÍTICO**: a função executa exclusão física em massa com service role, inclusive dados financeiros, contradizendo potencialmente as invariantes de reprodutibilidade, append-only e soberania temporal do OPERA_CORE. O banner calcula 3 meses como aproximadamente 90 dias, enquanto o backend usa subtração de meses de calendário; os avisos podem divergir da data efetiva. A função registra resultados, mas não cria snapshot/arquivo antes de apagar. Nada foi alterado nesta auditoria.

Outros `expires_at` dizem respeito a convites, links de exportação e acesso temporário de membros, não a deleção automática financeira.

## 11. Segurança

Evidências positivas:

- RLS é habilitado nas tabelas principais e no domínio `portfolio_*`;
- políticas usam `tenant_id`, `get_user_tenant_id`, roles e acesso contextual à obra;
- funções SECURITY DEFINER observadas fixam `search_path`;
- migrations posteriores revogam acessos públicos amplos e restringem RPCs;
- existem testes SQL de contrato de permissões e isolamento multi-tenant;
- reabertura/fechamento e auditoria têm desenho server-side e append-only;
- a Edge Function de retenção nega acesso sem segredo ou superadmin.

Achados preliminares:

| Severidade | Achado |
|---|---|
| CRÍTICO | hard delete de 14 tabelas via service role na retenção; impacto financeiro e operacional |
| ALTO | bucket `obra-fotos` é documentado como público; o próprio OPERA_CORE registra risco de evidência exposta por URL |
| MÉDIO | coexistem migrations históricas permissivas (`USING/WITH CHECK (true)`) e hardenings posteriores; o estado final deve ser validado no banco remoto, não inferido só pela soma textual das migrations |
| MÉDIO | funções Edge com `verify_jwt = false` dependem de validação manual; várias fazem isso, mas cada fluxo requer teste específico |
| MÉDIO | mutações financeiras diretas do cliente ainda não têm observabilidade causal sistemática, dívida registrada no OPERA_CORE |
| BAIXO | `.env` existe localmente, mas está ignorado; não foram impressos nem documentados seus valores nesta auditoria |
| NÃO CONFIRMADO | os “7 Problemas” do painel Lovable; o contador visual não permite mapear sete causas específicas |

Não é correto afirmar que os sete itens acima correspondem ao contador do Lovable. Esta é uma triagem independente do repositório, sem inspeção do banco remoto e sem executar correções.

## 12. Documentação existente

- `.lovable/OPERA_CORE.md`: constituição vinculante do sistema “Opera/Atlas”; fonte arquitetural mais forte.
- `.lovable/memory/**`: memória de arquitetura, auth/RBAC, multi-tenancy, financeiro, reporting, landing e segurança.
- `MANUAL_SISTEMA.md`: manual técnico amplo, com URL de produção e módulos.
- `RELATORIO_TESTE_SISTEMA.md`: relatório histórico de análise/testes.
- `README.md`: template Lovable não personalizado; dívida documental.
- `.lovable/plan.md`: plano experimental da pesquisa piloto versus controle; “controle” ali é grupo de pesquisa, não produto Control.

Não havia `docs/decisoes/` nem ADR que formalizasse a genealogia das três marcas antes deste relatório.

## 13. Dívidas e legados

- landing Control acoplada ao deploy Atlas;
- nome do editor Construction Hub sem correspondência versionada;
- README e package metadata genéricos;
- `Index.tsx` órfão;
- `vite-plugin-pwa` instalado/configurado apesar da memória declarar não usar service worker; o HTML tenta remover registros antigos;
- dados mock/demo e módulo de pesquisa experimental convivem com o produto principal;
- domínio comercial `portfolio_*` foi introduzido no mesmo banco, embora explicitamente separado por prefixo;
- frontend usa hook genérico com operações diretas, enquanto a constituição prefere autoridade e agregação server-side;
- afirmações comerciais sem evidência versionada.

## 14. Riscos

1. Publicar o preview sem identificar o delta pode trocar identidade ou comportamento inadvertidamente.
2. A landing pode vender Control enquanto o usuário entra no Atlas.
3. A política de retenção pode destruir dados necessários à auditoria, fechamento e reprodutibilidade.
4. Corrigir automaticamente os “7 Problemas” pode alterar policies/migrations sem respeitar OPERA_CORE.
5. Tratar Construction Hub como produto real criaria uma terceira taxonomia sem evidência.
6. Tratar toda ocorrência de “controle” como Control confundiria linguagem funcional e grupo de pesquisa com marca.

## 15. O que parece ser realmente o Atlas

Atlas parece ser o produto SaaS abrangente de gestão e inteligência operacional de obras: multi-tenant, multiobra, cinco pilares O.P.E.R.A., indicadores, cronograma, equipe, custos, fechamento, auditoria e governança. É o núcleo técnico deste repositório e está classificado como `producao` no catálogo comercial.

## 16. O que parece pertencer ao Control

Control parece ser uma oferta distinta, classificada como `validacao`, focada em acompanhamento contínuo e antecipação de desvios, com mensalidade e participação sobre economia comprovada. No código atual, sua materialização clara é a landing; não existe limite técnico ou rota autenticada que separe um “app Control” do Atlas.

## 17. O que significa Construction Hub

**NÃO CONFIRMADO.** A única evidência fornecida é o título do projeto/editor Lovable. A ausência total no repositório, histórico textual e bundle live sugere nome administrativo/histórico do contêiner, não produto ou módulo implantado.

## 18. Recomendações sem implementação

1. Congelar publicação até registrar o commit/artefato do Previewing e comparar com live.
2. Decidir formalmente a taxonomia: Método O.P.E.R.A. (guarda-chuva), Atlas (app), Control (serviço/produto) e Construction Hub (nome do projeto ou legado).
3. Abrir uma missão separada e prioritária para suspender/validar com segurança a retenção, preservar dados e reconciliar a regra com OPERA_CORE — sem apagar nada.
4. Obter os detalhes exportáveis dos sete alertas Lovable e auditá-los individualmente; não usar correção automática.
5. Depois da decisão de marca, separar landing e aplicação por domínio/rota/repositório conforme a estratégia escolhida.
6. Versionar evidências das métricas comerciais ou remover/qualificar alegações não comprovadas numa missão posterior.
7. Atualizar README, package metadata e ADRs somente depois da decisão canônica.

## Próxima missão sugerida

**Missão 2 — Preservação financeira e auditoria da retenção de 3 meses.** Primeiro confirmar se a Edge Function está implantada e agendada, obter logs somente leitura, quantificar registros em risco por tabela/tenant/obra, desenhar backup/restore e propor a desativação segura do hard delete. A execução deve exigir autorização explícita e plano reversível. Em paralelo posterior, uma missão curta pode capturar o delta Previewing versus live e os detalhes dos sete alertas sem publicar nem corrigir.

## Limites de prova

Esta auditoria não acessou o editor Lovable, não reconectou GitHub/Supabase, não consultou dados remotos, não executou migrations nem publicou. “Live = conteúdo do bundle local” foi provado por hash; “live = commit 6484ddd”, “Previewing = revisão X”, “cron ativo” e “sete alertas = achados Y” permanecem **NÃO CONFIRMADOS**.
