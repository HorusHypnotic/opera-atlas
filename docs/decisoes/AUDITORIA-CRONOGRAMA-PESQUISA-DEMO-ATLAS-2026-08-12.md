# Auditoria transversal — Cronograma, Pesquisa e Convidado/Demo

**Data:** 2026-08-12

**Escopo:** análise estática e direcionada do repositório OPERA Atlas. Nenhuma alteração de produto, banco, autenticação, RLS ou dados foi realizada.

**Regra de evidência:** “comprovado” significa presente no código/migrations versionados. O estado implantado e os dados do Lovable Cloud/Supabase são marcados como não confirmados.

## 1. Estado inicial Git

| Item | Estado comprovado no início |
|---|---|
| Branch | `main` |
| HEAD | `423a4b5118953d4874c2e439749ff00034d4b5e3` |
| `origin/main` | `423a4b5118953d4874c2e439749ff00034d4b5e3` |
| Working tree | limpa |
| Divergência | nenhuma; `HEAD == origin/main` |

## 2. Resumo executivo

Os três nomes escondem capacidades de naturezas muito diferentes:

- **Cronograma** é uma ferramenta real de planejamento e acompanhamento manual por obra: cadastra atividades, mostra Gantt, permite arrastar datas e progresso, lê dependências e respeita fechamento de período. O banco possui baseline append-only, mas não existe fluxo de criação/consulta/comparação de baseline na UI. Não há cálculo de realizado a partir da operação nem propagação automática de dependências. Classificação: **C — planejamento + acompanhamento**, ainda não integrado à memória operacional em sentido amplo.
- **Pesquisa** não é busca operacional nem pesquisa textual. É um registro experimental de “obras de pesquisa” próprias do usuário, divididas em grupo piloto/controle, com status, data e observações. Não se liga a `tenants`, `obras`, registros históricos ou documentos. É um módulo funcional pequeno, porém isolado e semanticamente enganoso.
- **Convidado/Demo** não usa conta Auth, credencial ou tenant real. É um estado client-side persistido em `sessionStorage`, com perfil/roles sintéticos, duas obras estáticas e dados locais principalmente para a primeira. Mutações feitas pelo hook genérico viram no-op; páginas que acessam Supabase/Edge Functions diretamente não entendem o modo guest. Por isso Cronograma e Pesquisa aparecem no menu, mas não constituem uma experiência demo funcional desses módulos.

Não foi encontrada conexão direta Cronograma ↔ Pesquisa. O elo mais próximo com memória operacional é o bloqueio do Cronograma por períodos fechados, sua observabilidade e sua exportação. A Demo cobre vários painéis operacionais por fixtures locais, mas não cobre `atividades`, dependências, baseline nem `obras_pesquisa`.

## 3. Cronograma

### 3.1 Superfícies e arquitetura

| Camada | Elementos |
|---|---|
| Rota | `/cronograma`, dentro de `ProtectedRoute`, `ObraProvider` e `AppLayout` em `src/App.tsx` |
| Página | `src/pages/CronogramaPage.tsx` |
| Visualização | `src/components/cronograma/GanttBoard.tsx`, biblioteca `gantt-task-react` |
| Analytics relacionado | `src/analytics/cronograma.ts` e cards do dashboard |
| Tabelas | `atividades`, `atividade_dependencias`, `cronograma_baseline` |
| Integração de governança | `periodos_fechados` |
| Edge Functions | `gantt-list`, `gantt-update-task` |
| Exportação | `export-csv` inclui atividades, dependências e baseline |
| Migration central | `20260527164854_e3145be4-5e7e-4f06-b0ab-8874366421c9.sql` |

### 3.2 Unidade e dados cadastráveis

A unidade principal é **atividade**. A UI cria apenas:

- nome;
- data de início;
- data de fim;
- responsável textual opcional;
- obra e tenant derivados do contexto.

O schema suporta adicionalmente:

- descrição;
- progresso de 0 a 100;
- ordem;
- `parent_id` para composição/hierarquia;
- cor;
- autor da última atualização;
- soft delete.

A UI atual não oferece criação/edição de descrição, hierarquia, ordem, cor ou exclusão. O Gantt permite alterar datas e progresso por interação gráfica.

### 3.3 Dependências

`atividade_dependencias` modela predecessora, sucessora, tipo default `FS` e `lag_dias`. O Gantt lê predecessoras e as entrega à biblioteca visual. Porém:

- não existe editor de dependências na UI encontrada;
- a única validação SQL específica impede autorreferência;
- não foi encontrada prevenção de ciclos maiores;
- `gantt-update-task` declara explicitamente a fase atual como modo “block”, sem validação/propagação de dependências;
- tipo e lag são lidos pela função, mas o frontend conserva apenas os IDs para renderização.

Logo, há representação visual de vínculo, mas não um motor de scheduling/critical path.

### 3.4 Gantt

É um **Gantt real como componente interativo**, não uma imagem ou tabela estilizada. Ele possui escalas dia/semana/mês, barras por atividade, progresso, dependências e drag de datas/progresso. Sua capacidade de planejamento, contudo, é limitada: não calcula automaticamente datas sucessoras, caminho crítico, folgas, recursos ou replanejamento.

`gantt-list` lê dados com o JWT do usuário e, portanto, submete os registros a RLS. A função usa service role apenas para consultar papéis e formar `can_edit`. `gantt-update-task` busca a tarefa com service role, mas depois valida papel do usuário no tenant da tarefa, perfil/superadmin, fronteira cross-tenant, datas e período fechado antes do update.

### 3.5 Progresso e planejado × realizado

O progresso da atividade é **manual**. Não foi encontrada alimentação automática por registros diários, produção, presença, custos, riscos ou ações corretivas.

Há duas noções paralelas de cronograma:

1. o módulo `/cronograma`, baseado em `atividades`;
2. o SPI do dashboard em `src/analytics/cronograma.ts`, baseado nas datas/fase da obra e em `sequenciamento_equipes`.

O SPI compara percentual temporal estimado com percentual de equipes marcadas como concluídas; ele não usa `atividades.progresso` nem `cronograma_baseline`. Portanto, o Atlas possui uma aproximação de avanço/atraso no dashboard, mas não uma comparação coerente de baseline planejado versus execução real do Gantt.

### 3.6 Baseline

`cronograma_baseline` significa um **snapshot versionado e congelado do cronograma**, contendo:

- obra e tenant;
- versão única por obra;
- instante e usuário do congelamento;
- `snapshot_json`;
- hash;
- motivo.

A migration concede SELECT/INSERT e cria policy de INSERT para admin, além do acesso de superadmin. Não foram encontrados botão, hook, RPC ou Edge Function que crie baseline, calcule seu hash, liste versões ou compare baseline com o cronograma vivo. A única utilização operacional localizada fora de tipos/migration é a inclusão na exportação CSV.

Assim, baseline é **infraestrutura persistente preparada, mas órfã de fluxo funcional**. Documentação remota anterior registra zero linhas em `cronograma_baseline`, mas esse número deve ser reconfirmado no estado remoto atual.

### 3.7 Relações com o Atlas

| Relação | Estado |
|---|---|
| Obra/tenant | Forte; todas as entidades são scoped por obra/tenant. |
| Período fechado | Real; tarefas cujo mês de término está fechado ficam bloqueadas, e update checa mês antigo e novo. |
| Auditoria/eventos | Real para leitura e alterações pelo Edge Function, com correlation/causation; INSERT direto da página não usa o mesmo fluxo observável. |
| Exportação | Real; atividades, dependências e baselines entram no export CSV administrativo. |
| Registros diários/produtividade | Ausente como integração automática. |
| Colaboradores | Responsável é texto livre, não FK de colaborador/usuário. |
| Custos, riscos, ações corretivas | Sem vínculo direto encontrado. |
| Snapshots de fechamento | Fechamento bloqueia mudanças, mas o snapshot de período não foi comprovado como contendo o cronograma. Baseline é tabela separada. |
| Outros consumidores | Dashboard usa outro modelo (`sequenciamento_equipes`), não as atividades. |

### 3.8 Permissões e estado

- SELECT: usuário autenticado do tenant com acesso à obra; superadmin.
- INSERT: admin, gestor ou operacional do tenant; período fechado bloqueia.
- UPDATE: admin ou gestor do tenant; período fechado bloqueia; superadmin.
- DELETE: admin; período fechado bloqueia; superadmin.
- A sidebar expõe Cronograma a visualizador, coerente com leitura.
- O botão “Nova atividade” não é ocultado por papel; uma tentativa não autorizada depende da RLS para falhar.

**Estado:** funcional, com capacidades persistentes parciais.

**Maturidade:** **3 — fluxo funcional**.

**Risco:** **médio**.

**Potencial:** **estratégico**.

**Classificação funcional:** **C — ferramenta de planejamento + acompanhamento**, porque permite planejar atividades/dependências e atualizar progresso, mas o realizado é manual e as integrações de memória operacional/baseline não estão completas.

## 4. Pesquisa

### 4.1 O que “Pesquisa” significa

Pesquisa é **módulo de pesquisa de campo/experimento**, não mecanismo de busca. O título da página é “Pesquisa de Campo” e o subtítulo é “Piloto vs Controle · registro paralelo”.

Uma linha de `obras_pesquisa` contém:

- nome livre;
- `dono_id` ligado a `auth.users`;
- grupo `piloto` ou `controle`;
- status `ativa`, `finalizada` ou `desistente`;
- data de início;
- observações;
- timestamps.

A interface cria linhas, lista contagens piloto/controle, exibe a tabela e edita status/observações. O grupo fica travado na edição. A policy permite DELETE do próprio registro, mas a UI não oferece exclusão.

### 4.2 Fontes, filtros e resultados

- Fonte única: tabela viva `obras_pesquisa`.
- Query: SELECT de todos os registros visíveis por RLS, ordenados por `created_at` descendente.
- Filtros: nenhum.
- Busca textual: inexistente.
- Busca temporal: inexistente.
- Full-text/indexação: inexistente.
- Paginação: inexistente.
- Exportação: inexistente.
- Histórico/snapshots: inexistente; existe somente `updated_at`.
- Evidências/documentos/ocorrências/auditoria: nenhum vínculo.

Ela não pesquisa nenhuma entidade operacional do Atlas. O nome “obra” nessa tabela é apenas um registro paralelo e não uma FK para `obras`.

### 4.3 Escopo e autorização

O isolamento é **por dono**, não por tenant:

- RLS SELECT/INSERT/UPDATE/DELETE exige `dono_id = auth.uid()`;
- qualquer autenticado pode possuir seus registros, sem checagem de papel ou tenant;
- não há compartilhamento com colegas, visão do tenant ou agregação global de superadmin;
- ela pode atravessar conceitualmente várias obras cadastradas pelo mesmo usuário, mas não atravessa obras reais do Atlas nem consulta outros usuários.

A sidebar oculta Pesquisa para um usuário apenas `visualizador`, pois a marca como não `viewOnly`; a rota, entretanto, não possui gate próprio. Um visualizador autenticado que abra `/pesquisa` diretamente pode usar o módulo sob as policies de ownership. Isso é divergência de autorização/UX, embora não produza leitura cross-user.

### 4.4 Memória operacional

No estado atual, Pesquisa não recupera memória operacional: não consulta registros vivos do núcleo, snapshots, fechamentos, logs, documentos ou cronograma. Sua tabela poderia futuramente servir como metadata de coorte de uma pesquisa, mas isso seria uma nova integração ainda inexistente. Não há base no código para chamá-la de busca global.

**Estado:** funcional, isolado e experimental.

**Maturidade:** **3 — fluxo funcional**, restrito ao próprio cadastro.

**Risco:** **médio** pela ambiguidade, pelo escopo fora do tenant e pela discrepância visualizador/rota; o isolamento entre donos é adequado no código.

**Potencial:** **médio** como pesquisa de campo; **baixo no estado atual** como recuperação de memória.

## 5. Convidado/Demo

### 5.1 Fluxo real

`Landing -> “Entrar ou explorar a demo” -> /login -> “Entrar como Convidado (Demo)” -> enterGuestMode() -> /`

`enterGuestMode`:

- não chama Supabase Auth;
- cria `user.id = "guest"` apenas em memória;
- aplica perfil sintético `convidado@opera.demo`, tenant `guest-tenant`;
- atribui simultaneamente os papéis `admin`, `gestor`, `operacional` e `visualizador`;
- grava apenas `opera_guest=true` no `sessionStorage`;
- o modo sobrevive a reload na mesma aba/sessão do navegador e é removido no logout/fechamento da sessão.

Não existe conta demo real, login automático remoto, credencial compartilhada ou tenant demo persistido comprovado.

### 5.2 Dados e obras

`DEMO_OBRAS` contém duas obras sintéticas. `DEMO_DATA` contém fixtures de operação ligadas quase integralmente a `demo-obra-001`/“Residencial Aurora”: registros diários, materiais, compras, ativos, sequenciamento, riscos, retrabalho, financeiro, segurança, ações corretivas, logística, ciclos, aditivos, lotes e checklist.

A segunda obra aparece no seletor, mas não possui conjunto equivalente de linhas nas fixtures. Isso pode produzir telas vazias ao selecioná-la.

`useTableData` detecta guest, lê apenas `DEMO_DATA` e transforma INSERT/UPDATE/DELETE em no-op com aviso “dados não são salvos no banco”. O estado não é realmente mutado nem precisa de reset; recarregar recompõe as fixtures, cujas datas relativas são recalculadas no carregamento.

### 5.3 Permissões práticas

Os papéis sintéticos fazem a UI apresentar controles de criação/edição/exclusão. Nos módulos que usam `useTableData`, essas operações são simuladas como sucesso/no-op e não alteram nem mesmo uma cópia local. Entretanto, nem todas as páginas usam esse hook:

- chamadas diretas ao Supabase são feitas como `anon`, sem sessão Auth;
- Edge Functions recebem `Bearer` vazio e rejeitam autenticação;
- componentes que têm guard específico de `isGuest` apenas fecham/avisam;
- o resultado é uma demo heterogênea: segura por ausência de credencial, mas com botões que aparentam capacidades que não funcionam.

### 5.4 Respostas objetivas

| Pergunta | Resposta comprovada no repositório |
|---|---|
| Conta demo real? | Não. |
| Login automático? | Apenas ativação local do estado guest; não há login Auth. |
| Credencial compartilhada? | Não. |
| Tenant demo real? | Não; `guest-tenant` é ID sintético. |
| Usa usuário Auth? | Não; `User` é objeto sintético com ID `guest`. |
| Papel? | Todos os quatro papéis simultaneamente, somente no cliente. |
| Obras? | Duas obras estáticas; dados substanciais apenas para a primeira. |
| Pode alterar/criar dados reais? | Não pelo desenho conhecido: hooks fazem no-op e RLS/Edge Functions não recebem usuário autenticado. |
| Pode alterar estado local? | Em geral não; os hooks apenas avisam e retornam. Alguns controles falham contra o backend. |
| Pode exportar? | Relatórios/exportações puramente client-side que consumam fixtures podem funcionar; exportação administrativa/server-side não, por falta de Auth. Exige teste de interface para enumerar cada botão. |
| Pode acessar Admin? | A entrada é ocultada, mas `/admin` direto renderiza o shell porque os papéis sintéticos incluem admin. Dados/operações remotos devem ser negados por RLS. |
| Pode descobrir outros tenants? | Nenhum caminho foi comprovado; não há JWT e `guest-tenant` não é real. |
| Risco de destruir a demo? | Baixo: fixtures são imutáveis/recriadas. O risco principal é UX incoerente, não destruição remota. |
| Restauração/reset? | Recarregamento recompõe dados; logout remove `sessionStorage`. Não existe rotina de reset porque não há persistência demo. |

### 5.5 Cronograma e Pesquisa na Demo

- **Cronograma:** aparece no menu, mas `DEMO_DATA` não contém `atividades`, dependências ou baseline; a página usa insert Supabase direto e Edge Functions autenticadas. O guest recebe erro/vazio, não uma demonstração de Gantt.
- **Pesquisa:** aparece no menu porque guest não é `visualizador-only`, porém faz query Supabase direta. Sem Auth, não vê linhas e não consegue inserir `dono_id = "guest"` sob RLS/tipo UUID.

**Estado:** funcional para módulos baseados nas fixtures; parcial/inconsistente transversalmente.

**Maturidade:** **3 — fluxo funcional** como vitrine local, mas **1** para Cronograma/Pesquisa.

**Risco:** **médio** por bypass de shell, UX de mutação enganosa e cobertura desigual; nenhum acesso remoto real foi comprovado.

**Potencial:** **alto** como experimentação comercial, desde que o escopo demonstrado seja explícito e consistente.

## 6. Relações entre subsistemas

| Relação perguntada | Evidência |
|---|---|
| Cronograma produz informação recuperável pela Pesquisa? | Não. `obras_pesquisa` não consulta nem referencia atividades/baselines. |
| Pesquisa recupera estados históricos? | Não; lê apenas sua tabela viva, sem histórico. |
| Demo experimenta Cronograma? | Não funcionalmente; menu existe, dados/auth necessários não. |
| Demo experimenta Pesquisa? | Não funcionalmente; consulta direta exige Auth. |
| Snapshots/fechamentos aparecem? | Fechamentos bloqueiam atividades; baseline é snapshot próprio não exposto. Pesquisa e Demo não os usam. |
| Há preparação para visão histórica integrada? | Cronograma tem baseline/hash, eventos e exportação. Isso é preparação localizada, não uma integração com Pesquisa. |

O triângulo sugerido `Cronograma ↔ Pesquisa ↔ memória operacional ↔ Demo` não existe como arquitetura atual. Há quatro ilhas: cronograma operacional, pesquisa experimental, mecanismos de preservação e fixtures demo.

## 7. Segurança e autorização

### Riscos altos

Nenhum risco alto ou crítico novo foi comprovado nesta inspeção estática.

### Riscos médios

1. **Pesquisa ignora tenancy e papéis.** É segura por ownership, mas qualquer autenticado, inclusive visualizador via URL direta, pode criar/editar registros pessoais fora da governança da organização.
2. **Demo atravessa guards com papéis máximos sintéticos.** Isso renderiza shells/controles como Admin e páginas não preparadas. A falta de sessão mantém a proteção remota conhecida, mas aumenta a chance de futura chamada privilegiada esquecer `isGuest`.
3. **Cobertura demo heterogênea.** Mutações podem parecer aceitas, virar no-op ou falhar, dependendo do componente.
4. **Criação de atividade não usa a Edge Function observável.** O INSERT da página depende diretamente de RLS e não recebe o mesmo evento causal detalhado dos updates.
5. **Decisão visual de edição no `gantt-list`.** A função consulta papéis via service role sem filtrar tenant para formar `can_edit`; um papel admin/gestor em outro tenant pode marcar a UI como editável. RLS e `gantt-update-task` ainda bloqueiam a operação, reduzindo impacto a UX/tentativa negada.

### Riscos baixos

1. A segunda obra demo é majoritariamente vazia.
2. Pesquisa usa data inicial default fixa `2026-08-03`.
3. O botão de nova atividade aparece para papéis sem INSERT; a RLS é a proteção efetiva.
4. Dependências não têm prevenção de ciclos gerais nem enforcement temporal, embora a UI não permita cadastrá-las.

## 8. Dados e persistência

| Subsistema | Persistência | Escopo | Histórico/imutabilidade | Saída |
|---|---|---|---|---|
| Cronograma | Supabase: atividades, dependências, baseline | tenant + obra | atividades mutáveis/soft delete; baseline append-only pela intenção/policies; eventos de update | Gantt, eventos, export CSV |
| Pesquisa | Supabase: `obras_pesquisa` | usuário Auth (`dono_id`) | apenas `updated_at`; sem histórico | tabela e contadores |
| Demo | memória + fixtures TypeScript; flag em `sessionStorage` | sessão do navegador | nenhum histórico; recomposto no reload | telas/relatórios client-side compatíveis |

O estado remoto das tabelas, contagens, policies e funções implantadas não foi consultado nesta missão.

## 9. Achados acidentais

| Achado | Local | Por que importa | Missão futura sugerida |
|---|---|---|---|
| Dois modelos de planejamento: `atividades` e `sequenciamento_equipes` | Cronograma, analytics/dashboard e demoData | SPI não mede o Gantt mostrado ao usuário; conceitos podem divergir. | Auditoria de indicadores prazo/SPI e fonte canônica. |
| Baseline com hash sem produtor/consumidor de UI | `cronograma_baseline` e export | Infraestrutura estratégica está órfã; não se sabe se alguma implantação externa a usa. | Auditoria específica de baseline, fechamento e reprodutibilidade. |
| “Pesquisa” é experimento piloto/controle | `PesquisaPage`/`obras_pesquisa` | Nome sugere busca global, mas o módulo pertence a outra finalidade e não ao núcleo tenant. | Decisão de produto sobre pesquisa de campo versus busca/memória. |
| Exportação inclui cronograma e baseline | `supabase/functions/export-csv` | É a única saída encontrada para baseline e fortalece preservação/evidência. | Incluir na missão de baseline/fechamento, sem abrir agora. |

## 10. Matriz de maturidade

Escala: 0 inexistente; 1 interface; 2 persistência; 3 fluxo funcional; 4 integrado ao Atlas; 5 capacidade estratégica.

| Subsistema/capacidade | Estado | Maturidade | Justificativa |
|---|---|---:|---|
| Cronograma vivo | funcional | 3 | CRUD parcial, Gantt, progresso e autorização server-side. |
| Dependências | parcial | 2 | Persistem e aparecem visualmente; sem editor/motor. |
| Baseline | órfão/parcial | 2 | Schema versionado/hash; sem fluxo produtor/consumidor. |
| Integração realizado | inexistente | 0 | Produção/registros não atualizam atividades. |
| Pesquisa de campo | funcional isolada | 3 | Cadastro próprio completo de pequeno escopo. |
| Pesquisa/busca operacional | inexistente | 0 | Nenhuma indexação, query multi-entidade ou filtro. |
| Demo operacional por fixtures | funcional parcial | 3 | Navegação e dados ricos na primeira obra; mutações não persistem. |
| Demo do Cronograma | placeholder acidental | 1 | Página/menu existem, mas backend e fixtures não suportam guest. |
| Demo da Pesquisa | placeholder acidental | 1 | Página/menu existem, mas RLS/Auth impedem o fluxo. |

## 11. Matriz de riscos

| Risco | Severidade | Subsistema | Impacto principal |
|---|---|---|---|
| Pesquisa fora do tenant/papéis e acessível por URL | médio | Pesquisa | Governança/semântica incoerente; não há vazamento cross-user comprovado. |
| Guest com papéis máximos e bypass de guards | médio | Demo | Superfícies indevidas e risco de regressão futura. |
| Demo oferece ações com três comportamentos diferentes | médio | Demo | Confiança e previsibilidade da demonstração. |
| Progresso do Gantt não é realizado operacional | médio | Cronograma | Indicador manual pode ser interpretado como medição integrada. |
| SPI usa modelo diferente do Gantt | médio | Cronograma | Métricas conflitantes de prazo. |
| Baseline prometido sem fluxo de uso | médio | Cronograma | Expectativa de evidência/reprodutibilidade não entregue pela UI. |
| Dependências sem motor/ciclos | baixo | Cronograma | Representação pode sugerir enforcement inexistente. |
| Segunda obra demo vazia | baixo | Demo | Experiência incompleta. |

## 12. Potencial estratégico

### Cronograma — estratégico

É o candidato natural a ligar planejamento, realizado, fechamento e evidência. O schema já oferece atividades, hierarquia, dependências, baseline versionado/hash e escopo por obra. A lacuna não é ausência de fundação, mas falta de integração e de uma semântica canônica para progresso/SPI.

### Pesquisa — médio

Como experimento piloto/controle, pode apoiar validação de produto ou estudo de campo. Como recuperação de memória operacional, o potencial só existe conceitualmente: o código atual não oferece nenhum mecanismo reutilizável de busca.

### Demo — alto

As fixtures cobrem boa parte da narrativa operacional sem risco a dados reais. Seu potencial comercial é alto, mas a cobertura precisa ser entendida como uma matriz explícita; hoje o menu promete mais do que a camada demo implementa.

## 13. Perguntas que exigem Lovable Cloud

Solicitar ao agente Lovable somente consultas read-only:

1. Quais versões/hashes de `gantt-list` e `gantt-update-task` estão implantadas, e todas as migrations de atividades/dependências/baseline/pesquisa constam como aplicadas?
2. Quantas linhas existem atualmente em `atividades`, `atividade_dependencias`, `cronograma_baseline` e `obras_pesquisa`, agregadas sem PII por tenant/obra ou dono? O baseline continua vazio?
3. Liste policies e grants efetivos dessas quatro tabelas e confirme se há policies/funções remotas não versionadas.
4. Há logs recentes de `gantt.list.*` e `gantt.task.update.*`, incluindo negações por papel, cross-tenant ou período fechado?
5. Alguma função, automação ou aplicação externa cria/consulta `cronograma_baseline` ou consome `obras_pesquisa`?
6. Existem eventos anônimos/erros associados a guest nas Edge Functions Gantt ou queries de Pesquisa? Fornecer apenas totais e códigos, sem IP/PII.
7. Há conta, tenant ou credencial demo remota não representada no repositório?

## 14. Próximas missões recomendadas

No máximo três, em ordem:

1. **Auditoria de prazo e fonte canônica:** confrontar `atividades`, `sequenciamento_equipes`, SPI, progresso e dados realizados.
2. **Auditoria de baseline/fechamento/evidência:** provar produtor, hash, comparação, exportação, reabertura e estado remoto.
3. **Matriz de experiência Demo:** inventariar, por rota, fixture, leitura, mutação e exportação, sem ainda implementar correções.

## 15. Estado final

O único arquivo criado por esta missão é este relatório. O SHA do commit documental e a confirmação final de `HEAD == origin/main`, working tree limpa, `git diff --check` e ausência de tag são registrados na entrega da missão, pois o próprio documento não pode conter antecipadamente o hash do commit que o contém.

Nenhuma melhoria identificada foi implementada e nenhuma próxima missão foi iniciada.
