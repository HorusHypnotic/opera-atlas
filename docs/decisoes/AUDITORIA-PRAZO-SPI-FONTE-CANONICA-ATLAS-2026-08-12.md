# Auditoria de prazo, SPI e fonte canônica do OPERA Atlas

**Data:** 2026-08-12

**Escopo:** investigação estática no baseline Git `7835c70d01f052885567e47bad07a7931f497959`. Nenhuma alteração funcional, de banco, RLS, dashboard ou publicação foi realizada.

## 1. Resumo executivo

O OPERA Atlas **não possui hoje uma fonte canônica única de prazo**. Há três estruturas paralelas, com semânticas e consumidores diferentes:

1. `atividades` + `atividade_dependencias` formam o planejamento detalhado e o acompanhamento manual mostrado no Gantt.
2. `sequenciamento_equipes`, combinado com datas/fase de `obras`, alimenta o indicador chamado SPI no dashboard e nos relatórios.
3. `cronograma_baseline` oferece schema de snapshot versionado com hash, mas não tem produtor, fluxo de aprovação, visualização ou comparação encontrado no repositório.

Quando o dashboard responde “a obra está atrasada?”, ele **não consulta o Gantt nem o baseline**. Ele calcula uma heurística:

`SPI atual = percentual de equipes com status concluído / percentual do prazo de calendário já transcorrido`

Na ausência de sequenciamento, o numerador vira um peso fixo da fase da obra. Esse índice não é o SPI clássico de Earned Value Management (`EV / PV`): não usa valor planejado, valor agregado, pesos de atividades, curva de avanço aprovada nem realizado derivado de produção.

O Gantt é classificado como **MISTO**: datas e dependências representam planejamento corrente, enquanto `progresso` tenta representar acompanhamento/realizado, mas é manual e não possui datas reais, evidência produtiva ou comparação com baseline. O passado só é **parcialmente reconstruível**: updates via Edge Function geram eventos, períodos fechados bloqueiam algumas mutações e há schema de baseline, porém criação direta, estado anterior completo, sequenciamento e baseline efetivo não têm preservação suficiente.

Sem tomar decisão definitiva, a hipótese mais coerente com as estruturas e princípios existentes é **C: baseline aprovado + atividades atuais = desvio**. Ela preserva a distinção entre compromisso e estado corrente e oferece base para histórico. Ainda exigiria definir realizado físico verificável e a matemática do indicador; `sequenciamento_equipes` pode continuar como visão de mobilização, não necessariamente como autoridade de prazo.

## 2. Inventário de prazo

### Mapa funcional

| Entidade/capacidade | Entrada | Transformação | Saída | Consumidor |
|---|---|---|---|---|
| `obras.data_inicio` / `data_previsao` | cadastro da obra | dias corridos, totais e restantes contra `Date.now()` | progresso temporal | `calculateScheduleMetrics`, dashboard e PDFs |
| `obras.fase_atual` | atualização da obra | peso fixo 5/15/60/80/95 quando não há sequenciamento | progresso físico substituto | SPI/dashboard |
| `atividades` | criação e edição manual | validação de datas/progresso; bloqueio por período fechado | tarefas Gantt correntes | `/cronograma`, `gantt-list`, export CSV |
| `atividade_dependencias` | API/banco; sem editor encontrado | apenas bloqueio de autorreferência | predecessoras visuais | Gantt e export CSV |
| `sequenciamento_equipes` | CRUD em Redução de Perdas | contagem de status `concluido`; semanas só desenham barras | sequenciamento e progresso físico heurístico | Redução de Perdas, dashboard, relatório de equipe, export CSV |
| `cronograma_baseline` | nenhum produtor encontrado | nenhuma geração/hash/diff encontrada | estrutura de snapshot | somente export CSV/tipos; sem UI |
| `periodos_fechados` | RPCs de fechamento de folha | snapshot/hash de folha; bloqueia tarefas pelo mês de término | versão mensal e trava | Admin, Gantt e governança financeira |
| eventos Gantt | leitura/update via Edge Functions | correlation/causation e old/new | `system_events` | observabilidade; sem tela histórica específica |
| `ScheduleCard` | datas/fase da obra + sequenciamento | razão heurística e thresholds | adiantado/no prazo/atrasado/crítico | dashboard |
| relatórios PDF | métricas do dashboard | formatação | SPI %, dias e fase | relatório OPERA/cliente |

### Conceitos temporais coexistentes

- Data absoluta: atividades e datas da obra.
- Semana ordinal: `sequenciamento_equipes.semana_inicio`/`semana_fim`, sem âncora de calendário própria além da interpretação humana.
- Fase categórica: `obras.fase_atual`.
- Percentual manual: `atividades.progresso`.
- Status categórico manual: planejado/em andamento/concluído no sequenciamento.
- Snapshot: baseline do cronograma e snapshot financeiro de período, que são mecanismos distintos.

## 3. Gantt

### Representação

A unidade é a **atividade** por obra. O schema contém nome, descrição, datas início/fim, progresso, ordem, pai, responsável textual, cor, timestamps, autor de update e soft delete. Dependências contêm predecessora, sucessora, tipo default `FS` e lag em dias.

A UI cria nome, datas e responsável. O componente Gantt lê atividades/dependências e permite mover início/fim e editar progresso. Não há UI encontrada para criar dependências, hierarquia, baseline, datas reais ou exclusão de atividade.

### Respostas obrigatórias

| Pergunta | Resposta |
|---|---|
| Representa planejado? | **Sim.** Datas, ordem, hierarquia e dependências descrevem o plano corrente. |
| Representa realizado? | **Parcialmente e apenas por declaração manual.** `progresso` mistura acompanhamento ao plano. |
| Progresso manual ou derivado? | **Manual**, alterado no Gantt/API. |
| Regra para datas reais? | **Não.** Não há início/fim real separados. |
| Estado fechado/consolidado? | **Parcial.** Mês de término fechado bloqueia mutações; não congela uma versão completa do cronograma na UI. |
| Comparação com baseline? | **Não.** |
| Vínculo com produtividade real? | **Não.** |
| Vínculo com registros diários? | **Não.** |
| Vínculo com equipe/presença? | **Não.** Responsável é texto, não FK. |
| Vínculo com custo? | **Não.** |

### Persistência, bloqueio e histórico

- SELECT é tenant/obra-scoped por RLS; INSERT aceita admin/gestor/operacional; UPDATE aceita admin/gestor; DELETE aceita admin; superadmin tem acesso amplo.
- As policies adicionais impedem INSERT/UPDATE/DELETE quando o mês de `data_fim` está fechado. A Edge Function de update checa tanto o mês de término anterior quanto o novo.
- `gantt-update-task` registra old/new e contexto causal em evento. A criação de atividade é INSERT direto da página e não usa essa trilha detalhada.
- Não há tabela de versões das atividades. Soft delete e `updated_at` não reconstroem todos os estados anteriores.
- Dependências são visuais; não há propagação de datas, critical path ou prevenção de ciclos maiores.

**Classificação:** **MISTO**, com predominância de planejamento corrente e acompanhamento manual não comprovado por dados de execução.

## 4. Sequenciamento de equipes

### Finalidade e schema

`sequenciamento_equipes` nasceu no pilar Redução de Perdas. Cada linha possui:

- tenant e obra;
- nome textual da equipe;
- semana de início e fim como inteiros;
- status textual, usado como `planejado`, `em_andamento` ou `concluido`;
- `created_at`.

Não há FK para equipe, colaborador ou atividade. Não há datas absolutas, percentual, peso, quantidade produzida, responsável, `updated_at`, soft delete ou baseline próprio. O schema original não impõe checks para semanas/status.

### Entrada e consumidores

- CRUD genérico em `ReducaoPerdasPage`, onde as semanas viram barras visuais.
- Leitura em `DashboardOverview` para o SPI.
- Leitura em `RelatorioMaoObraPage` para tabela de duração/status.
- Inclusão na exportação CSV e em fixtures demo.

As semanas afetam a visualização e duração do relatório, mas **não entram na fórmula do SPI**. Uma equipe concluída conta igualmente, tenha uma ou cinquenta semanas.

### Permissões

O fluxo usa `useTableData`: operacional pode inserir, gestor/admin atualizar e admin excluir conforme RLS. A leitura atualizada de obra é filtrada no cliente e por policies posteriores de acesso à obra. O estado é manual.

### Semântica

O sequenciamento representa **planejamento de mobilização/ordem de equipes com status manual de conclusão**. Ele mistura plano (intervalo de semanas) e realizado declarado (status), mas não mede avanço físico da obra.

## 5. Baseline

### Estrutura

`cronograma_baseline` contém:

- `tenant_id`, `obra_id`;
- `versao`, única por obra;
- `congelado_em`, `congelado_por`;
- `snapshot_json`;
- `hash`;
- `motivo`.

Há SELECT tenant/obra-scoped, INSERT para admin com ator igual ao usuário e acesso amplo de superadmin. A migration posterior `20260802195000_grant_policy_backed_tables.sql` concede UPDATE/DELETE ao papel `authenticated`, mas não cria policy correspondente para admin de tenant; a policy `super_admin_all` ainda permite mutação por superadmin. Portanto, “append-only” é intenção forte para usuários tenant, mas não é imutabilidade absoluta no desenho versionado.

### Estrutura, fluxo, dado e consumidor

| Dimensão | Estado |
|---|---|
| ESTRUTURA EXISTE | **Sim.** Tabela, versão, snapshot, hash e policies. |
| FLUXO EXISTE | **Não encontrado.** Sem UI, RPC, trigger, Edge Function, fluxo manual ou automático produtor. |
| DADO EXISTE | **Não confirmado no estado remoto atual.** Auditoria remota anterior de 2026-08-12 encontrou zero linhas. |
| CONSUMIDOR EXISTE | **Apenas exportação bruta/tipos.** Sem comparação, diff, seleção de versão ou indicador. |

### Respostas obrigatórias

1. **Quem cria?** Nenhum produtor versionado; a policy permitiria INSERT direto por admin.
2. **UI?** Não.
3. **RPC?** Não encontrada.
4. **Edge Function?** Não encontrada.
5. **Fluxo manual?** Não encontrado.
6. **Fluxo automático?** Não encontrado.
7. **Consumidor?** Export CSV bruto; nenhum consumidor semântico.
8. **Comparação baseline × atual?** Não.
9. **Diff?** Não.
10. **Histórico de versões?** O schema permite; não há navegador/fluxo.
11. **Hash reproduzível?** **Não determinável.** Não há algoritmo canônico de serialização/hash nem função de verificação do baseline.
12. **Baseline real?** A última evidência remota documental diz zero; exige reconfirmação para o estado atual.

O baseline de cronograma não deve ser confundido com `periodos_fechados.snapshot_json`, que armazena resultado de `folha_pagamento` e seu hash.

## 6. SPI atual

### Fluxo real

`obras.data_inicio + obras.data_previsao + obras.fase_atual + sequenciamento_equipes[]`

→ `calculateScheduleMetrics(selectedObra, sequenciamento)`

→ progresso temporal + progresso físico heurístico

→ razão chamada `spi`

→ `ScheduleCard`, classificação visual e relatórios PDF.

### Fórmula

Se há previsão:

`diasTotais = max(1, data_previsao - data_inicio)`

Senão:

`diasTotais = 365`

Então:

`diasCorridos = max(0, hoje - data_inicio)`

`progressoTemporal = min(100, diasCorridos / diasTotais × 100)`

Se há pelo menos uma linha de sequenciamento:

`progressoFisico = equipes_concluidas / total_equipes × 100`

Senão:

`progressoFisico = peso(fase_atual)`

com pesos: iniciação 5, planejamento 15, execução 60, monitoramento 80, encerramento 95; fallback 10.

Por fim:

`SPI = progressoFisico / progressoTemporal`, ou 1 quando o denominador é zero.

Classificação: `>= 1,1` adiantado; `>= 0,9` no prazo; `>= 0,7` atrasado; abaixo disso crítico.

### O que usa e o que ignora

| Entrada | Usa? |
|---|---:|
| Planejado | Apenas datas macro da obra; ignora semanas planejadas na razão. |
| Realizado | Status manual `concluido` ou fase manual. |
| Datas reais | Não. |
| Produtividade/produção | Não. |
| Percentuais manuais | Não usa `atividades.progresso`; usa status/fase manuais. |
| Registros de execução | Não. |
| Gantt | Não. |
| Baseline | Não. |
| Pesos/duração das equipes | Não. |

### Divergência do conceito clássico

O SPI clássico de gestão de valor agregado é `EV / PV`: valor agregado do trabalho realizado dividido pelo valor planejado até a data de status. O Atlas calcula “fração de equipes concluídas / fração de calendário transcorrida”. Sem pesos, curva baseline e medição física, o nome SPI superestima a precisão conceitual do indicador.

### Cenários de divergência

- Todas as equipes curtas concluídas e uma equipe longa pendente podem gerar avanço alto.
- Alterar `semana_inicio`/`semana_fim` não altera o SPI.
- Gantt pode marcar atividades em 10% e sequenciamento estar 100% concluído.
- Uma obra sem sequenciamento em fase execução recebe 60%, independentemente da produção real.
- Uma previsão vencida mantém progresso temporal limitado a 100%; dias restantes podem ficar negativos.
- Inserir/remover linhas de sequenciamento muda o denominador e o SPI sem mudança física.
- Alterar datas macro da obra muda o SPI sem tocar no Gantt.

## 7. Fontes concorrentes

### Quem responde hoje

| Pergunta | Fonte atual | Confiabilidade | Problema |
|---|---|---|---|
| Planejado detalhado | `atividades` e dependências | média | Plano corrente mutável; sem versão aprovada em uso. |
| Planejado macro | datas da `obra`; semanas do sequenciamento em outra tela | baixa/média | Três granularidades sem reconciliação. |
| Realizado | status do sequenciamento para o dashboard; progresso manual das atividades no Gantt | baixa | Duas declarações manuais e sem evidência física. |
| Baseline aprovado | nenhuma fonte operacional | inexistente | Schema órfão e última evidência remota com zero linhas. |
| SPI | datas/fase da obra + contagem de equipes concluídas | baixa como SPI; útil como heurística | Não usa Gantt, baseline, semanas, pesos ou produção. |
| Desvio | heurística físico/tempo no dashboard | baixa | Não é baseline × atual nem planejado × realizado verificável. |

Logo:

- “A obra está atrasada?” → o dashboard usa a heurística baseada em obra/sequenciamento.
- “Qual era o planejamento aprovado?” → o Atlas não consegue responder operacionalmente.
- “Qual é o realizado?” → não há realizado canônico; há status/progresso manuais concorrentes.
- “Qual é o desvio?” → há somente proxy de avanço temporal, não desvio de cronograma aprovado.

## 8. Conflitos e duplicidades

| Caso | Classificação | Evidência/efeito |
|---|---|---|
| Atividade versus equipe como unidade temporal | PARALELISMO INTENCIONAL na origem | Uma planeja trabalho; outra mobilização, mas o dashboard transforma a segunda em avanço físico global. |
| Datas absolutas versus semanas ordinais | INCONSISTÊNCIA | Não existe regra de conversão ou âncora comum. |
| `atividades.progresso` versus `sequenciamento.status` | DUPLICIDADE | Ambos expressam avanço manual sem reconciliação. |
| Datas da obra versus extensão do Gantt | INCONSISTÊNCIA | Nenhuma validação mantém início/previsão coerentes com atividades. |
| SPI versus Gantt | INCONSISTÊNCIA | Indicador de prazo ignora o módulo dedicado de cronograma. |
| Baseline versus atividades | PARALELISMO PREPARADO | Modelo de snapshot é compatível com atividades, mas o vínculo só existe implicitamente em JSON. |
| Snapshot de período versus baseline | PARALELISMO INTENCIONAL | Fechamento preserva folha; baseline deveria preservar plano. Não são substitutos. |
| Pesos de fase como fallback | LEGADO/heurística | Supre ausência de sequenciamento, sem ser realizado mensurado. |

## 9. Fechamento e histórico

| Questão | Resposta | Evidência |
|---|---|---|
| Atividades participam de período fechado? | **PARCIAL.** | Mutações são bloqueadas pelo mês de término. |
| Atividades entram no snapshot do período? | **NÃO.** | RPCs fecham/reabrem/refecham snapshot de `folha_pagamento`. |
| Baseline entra no snapshot? | **NÃO.** | Tabelas e hashes separados. |
| Progresso entra no hash de fechamento? | **NÃO.** | Hash verificado é o da folha. |
| Cronograma é congelado? | **PARCIAL.** | Fechamento trava tarefas conforme `data_fim`; baseline poderia congelar, mas não há fluxo. |
| Realizado de prazo é preservado? | **PARCIAL/NÃO suficiente.** | Eventos de update guardam old/new, mas não cobrem todas as mutações nem formam snapshot completo. |
| Reabertura altera planejamento? | **Pode permitir alteração.** | Ao marcar período reaberto, deixa de existir a trava ativa; não cria automaticamente versão do cronograma. |
| Há versão histórica do cronograma? | **Estrutura sim, operação não.** | `cronograma_baseline.versao` sem produtor/consumidor. |

Há ainda uma fragilidade de borda: a trava associa a atividade ao mês de `data_fim`, não a todos os meses que a atividade atravessa. Uma atividade longa pode começar em mês fechado e terminar em mês aberto sem que o mês inicial determine a trava.

## 10. Reprodutibilidade e OPERA_CORE

O desenho aspira a causalidade, append-only, hashes, snapshots e lineage, mas o domínio de prazo ainda não satisfaz integralmente esses princípios:

- **Causalidade:** update via Edge Function registra old/new; INSERT direto e demais caminhos não têm cobertura uniforme.
- **Append-only:** baseline é nominalmente append-only para tenant admin, mas superadmin pode mutar; atividades e sequenciamento são estado vivo.
- **Reprodutibilidade:** não há snapshot operacional usado, algoritmo canônico de hash do baseline ou versão de todas as fontes do SPI.
- **Irreversibilidade temporal:** fechamento bloqueia parte das atividades, mas reabertura não preserva automaticamente uma versão do cronograma.
- **Diferenciação de estado:** plano corrente, plano aprovado e realizado não são tipos separados.
- **Hashes:** hash de período cobre folha; hash de baseline não tem produtor/verificador.

**Classificação:** **PARCIALMENTE RECONSTRUÍVEL**.

É possível recuperar o estado vivo e alguns eventos de alteração, mas não garantir o cronograma completo em qualquer instante passado, nem reproduzir o SPI histórico: a fórmula depende de `Date.now()`, datas atuais da obra e sequenciamento mutável sem versionamento.

## 11. Hipóteses de fonte canônica

### Hipótese A — `atividades` como fonte canônica

| Critério | Avaliação |
|---|---|
| Coerência | Alta para planejamento detalhado; baixa se também for realizado sem campos/evidência distintos. |
| Impacto/migração | Dashboard e relatórios teriam de abandonar/reinterpretar sequenciamento e agregar atividades. |
| Compatibilidade | Boa com Gantt, dependências, obra, bloqueios e exportação. |
| Risco | Plano corrente mutável vira autoridade sem compromisso aprovado. |
| Potencial de SPI | Médio; requer pesos, curva planejada e medição de avanço. |
| Histórico/fechamento | Fraco sem baseline/versionamento; integração de trava já existe. |

### Hipótese B — `sequenciamento_equipes` como fonte canônica

| Critério | Avaliação |
|---|---|
| Coerência | Baixa para cronograma da obra; unidade é equipe, semanas são ordinais e status é grosseiro. |
| Impacto/migração | Preserva dashboard atual, mas marginaliza o Gantt e exigiria enriquecer fortemente o schema. |
| Compatibilidade | Boa com Redução de Perdas/relatório; ruim com dependências/baseline. |
| Risco | Confundir mobilização com avanço físico e perpetuar indicador sem pesos. |
| Potencial de SPI | Baixo no formato atual. |
| Histórico/fechamento | Ausente. |

### Hipótese C — baseline aprovado + atividades atuais

`baseline aprovado + estado atual + medição de avanço = desvio`

| Critério | Avaliação |
|---|---|
| Coerência | Mais alta: separa compromisso, plano corrente e evolução. |
| Impacto/migração | Maior que A; exige ativar baseline, definir serialização/hash/diff e reconciliar sequenciamento. |
| Compatibilidade | Aproveita Gantt, schema de baseline, exportação, eventos e princípios OPERA_CORE. |
| Risco | Baseline atual é órfão; sem realizado verificável, apenas versiona planos. |
| Potencial de SPI | Alto, se PV vier do baseline e EV de avanço físico ponderado e evidenciado. |
| Histórico/fechamento | Alto potencial; precisa alinhar congelamento, reabertura e lineage. |

**Hipótese mais promissora:** C, sem decisão definitiva. B não tem granularidade suficiente; A sozinha não separa o plano aprovado do plano corrente.

## 12. Redefinição conceitual do SPI

Com base nas estruturas existentes, o modelo mais coerente seria uma **combinação**, não uma escolha simples:

- baseline de atividades para o valor/avanço planejado até a data de status;
- atividades atuais para estado e projeção;
- avanço físico ponderado e verificável para realizado/valor agregado;
- sequenciamento de equipes como informação de mobilização/capacidade, não como numerador automático;
- registros diários/produtividade como evidência possível, desde que exista regra explícita de atribuição à atividade.

Isso não define ainda pesos, unidade de valor ou algoritmo. Apenas estabelece que o SPI não deveria derivar da mera contagem de equipes concluídas. O indicador atual deve ser tratado conceitualmente como **índice heurístico de avanço físico declarado versus tempo transcorrido**, não como SPI clássico.

## 13. Impacto sistêmico

| Módulo | Estado da integração | Evidência |
|---|---|---|
| Dashboard | JÁ INTEGRADO ao sequenciamento/obra | `calculateScheduleMetrics`; não usa Gantt. |
| Relatórios OPERA/cliente | JÁ INTEGRADO ao SPI atual | Exporta fase, SPI e dias. |
| Relatório de equipe | JÁ INTEGRADO ao sequenciamento | Lista semanas/status/duração. |
| Exportação CSV | JÁ INTEGRADO às três fontes | Exporta sequenciamento, atividades, dependências e baseline separadamente. |
| Fechamento | PARCIAL | Trava atividades; snapshot/hash não contém cronograma. |
| Snapshots | PARCIAL | Schema de baseline existe; fluxo não. |
| Riscos | NÃO EXISTE | Impacto/prazo textual não liga atividade/desvio. |
| Produtividade/registros | NÃO EXISTE | Nenhuma atribuição automática ao progresso. |
| Equipe/presença | PARCIAL sem vínculo | Sequenciamento usa nome textual; presença não alimenta status. |
| Stakeholder view futura | POTENCIAL | Precisaria distinguir baseline, atual, realizado e confiança. |
| OPERA Control | NÃO DETERMINÁVEL | Catálogo/documentação não provam consumidor técnico. |
| Vision | NÃO DETERMINÁVEL | Nenhuma integração técnica versionada encontrada. |

## 14. Riscos

1. **ALTO — decisão executiva por indicador não canônico.** Dashboard e PDFs rotulam uma heurística como SPI e atraso.
2. **ALTO — ausência de plano aprovado recuperável.** Não há baseline operacional nem comparação.
3. **MÉDIO — duas declarações manuais de realizado.** Progresso do Gantt e status do sequenciamento podem contradizer-se.
4. **MÉDIO — passado não reproduzível.** SPI usa relógio atual e fontes mutáveis sem versão.
5. **MÉDIO — fechamento temporal incompleto.** Snapshot financeiro não preserva cronograma e a trava usa apenas mês de término.

## 15. Achados acidentais

| Achado | Local | Impacto | Missão futura |
|---|---|---|---|
| Grant posterior inclui UPDATE/DELETE no baseline | `20260802195000_grant_policy_backed_tables.sql` | Policy ainda restringe tenant admin, mas superadmin não é append-only absoluto. | Auditoria de imutabilidade do baseline. |
| SPI histórico depende do relógio | `src/analytics/cronograma.ts` | Mesmo dado produz métrica diferente em datas diferentes, sem `status_date`. | Especificação de indicador reprodutível. |
| Trava por mês usa somente `data_fim` | migration do Cronograma e Edge Function | Atividade que atravessa meses não é governada por todo o intervalo. | Auditoria de fronteiras temporais do fechamento. |
| `sequenciamento_equipes` não tem checks/versionamento | schema inicial | Semanas/status inválidos ou mudança não rastreada podem afetar indicador. | Contrato de dados do sequenciamento. |

## 16. Recomendação de próxima decisão

Realizar uma missão **decisória, ainda sem implementação**, para definir o contrato semântico de prazo:

1. distinguir formalmente baseline aprovado, plano corrente e realizado;
2. decidir a unidade ponderada de avanço e sua evidência;
3. definir o papel residual de `sequenciamento_equipes`;
4. definir data de status e fórmula reproduzível do indicador;
5. estabelecer relação entre baseline, fechamento e reabertura.

A decisão deve avaliar a hipótese C como candidata principal, mas não assumir que o schema atual de baseline ou `atividades.progresso` já seja suficiente.

### Estado remoto a confirmar

Sem acessar Lovable Cloud, permanecem não confirmados:

- contagens atuais de atividades, dependências e baselines;
- existência de funções/policies implantadas fora do repositório;
- uso externo do baseline;
- versões implantadas das Edge Functions Gantt;
- eventos reais e divergência de dados entre Gantt/sequenciamento.

A evidência remota documental anterior, produzida em 2026-08-12, registrou `cronograma_baseline = 0` e `sequenciamento_equipes = 36`; esses números não foram tratados como estado remoto atual nesta auditoria.
