# RFC — Domínio canônico de prazo do OPERA Atlas v0.1

**Status:** FASE 1A IMPLEMENTADA / FASE 1B NÃO IMPLEMENTADA

**Data:** 2026-08-12

**Implementação:** Fase 1A — baseline versionado funcional — implementada em 2026-08-12. O diff estrutural da Fase 1B permanece não implementado. Ver `docs/decisoes/IMPLEMENTACAO-BASELINE-PRAZO-V1-2026-08-12.md`.

**Classificação proposta:** MINOR / ADITIVA

## 1. Sumário

Esta RFC propõe que o OPERA Atlas passe a distinguir formal e tecnicamente:

A. compromisso aprovado;
B. plano corrente;
C. realizado declarado;
D. realizado verificável;
E. data de status;
F. método de cálculo;
G. desvio reproduzível.

Nenhuma categoria pode substituir silenciosamente outra. A primeira implementação autorizada por esta RFC fica estritamente limitada a **baseline + versionamento + comparação estrutural**. Medição física, EV/PV, SPI clássico e fechamento de prazo permanecem fora do escopo.

## 2. Genealogia da decisão

Esta proposta deriva, em ordem, de:

1. [`AUDITORIA-PRAZO-SPI-FONTE-CANONICA-ATLAS-2026-08-12.md`](../decisoes/AUDITORIA-PRAZO-SPI-FONTE-CANONICA-ATLAS-2026-08-12.md), que comprovou fontes concorrentes e ausência de fonte canônica única;
2. [`CONTRATO-SEMANTICO-PRAZO-ATLAS-v0.1-2026-08-12.md`](../decisoes/CONTRATO-SEMANTICO-PRAZO-ATLAS-v0.1-2026-08-12.md), que separou compromisso, plano, declaração, verificação e corte;
3. [`ARQUITETURA-TECNICA-PRAZO-ATLAS-v0.1-2026-08-12.md`](../decisoes/ARQUITETURA-TECNICA-PRAZO-ATLAS-v0.1-2026-08-12.md), que propôs o menor delta técnico e transição sem big bang;
4. `.lovable/OPERA_CORE.md` v1.3, constituição vinculante de causalidade, rastreabilidade, soberania tenant, append-only e reprodutibilidade.

Esta RFC não reabre as conclusões anteriores. Ela autoriza e limita a primeira evolução arquitetural.

## 3. Problema

Hoje:

- `atividades` e dependências representam o cronograma corrente do Gantt;
- `sequenciamento_equipes` alimenta a heurística chamada SPI;
- `cronograma_baseline` existe como estrutura sem produtor/consumidor funcional;
- progresso manual não é realizado verificável;
- resultados dependem do relógio e de fontes mutáveis.

Consequentemente, o produto não responde de forma reproduzível “qual compromisso foi aprovado?” nem “o que mudou desde esse compromisso?”.

## 4. Decisão central proposta

Se aprovada, esta RFC estabelece:

- `atividades` e `atividade_dependencias` permanecem o plano corrente editável;
- `cronograma_baseline` será evoluído como compromisso aprovado, versionado e imutável;
- o baseline será snapshot, não cópia viva do cronograma;
- o plano corrente poderá divergir do baseline sem reescrevê-lo;
- `atividades.progresso` continuará classificado como realizado declarado;
- realizado verificável será um domínio append-only posterior;
- toda análise canônica futura usará data de status explícita e método versionado;
- `sequenciamento_equipes` deixa de ser candidato a fonte soberana e permanece mobilização/fluxo auxiliar;
- a heurística atual será futuramente denominada Índice de Ritmo Operacional (IRO);
- o termo SPI ficará reservado a eventual `EV/PV` real.

## 5. Invariantes normativas de prazo

Estas invariantes complementam o OPERA_CORE sem enfraquecê-lo:

### INV-PRAZO-01 — Imutabilidade do compromisso

Baseline aprovada nunca é sobrescrita, editada ou apagada por operação ordinária.

### INV-PRAZO-02 — Sucessão com lineage

Alterar o compromisso exige nova versão que referencia a anterior e preserva payload, hash, autoria, aprovação, instante e motivo anteriores.

### INV-PRAZO-03 — Independência do plano corrente

Alterações no plano corrente não modificam retroativamente nenhuma baseline.

### INV-PRAZO-04 — Declaração não é verificação

Progresso/status informado manualmente não se torna realizado verificável sem regra explícita de origem, evidência e validação.

### INV-PRAZO-05 — Lineage do realizado

Realizado verificável exige fonte identificável, tenant, obra, atividade/unidade, ator/sistema, instante efetivo, instante de conhecimento e regra de verificação.

### INV-PRAZO-06 — Corte explícito

Toda comparação temporal canônica declara data de status explícita e comum às fontes comparadas.

### INV-PRAZO-07 — Independência do relógio de consulta

Resultado histórico não pode variar por `Date.now()`, `CURRENT_DATE` ou momento da consulta quando entradas, corte e método forem os mesmos.

### INV-PRAZO-08 — Método identificável

Todo indicador ou desvio identifica método, versão, entradas, unidade, arredondamento e confiança.

### INV-PRAZO-09 — Falha epistemicamente segura

Informação insuficiente produz `não determinável` com motivo; nunca zero, conclusão ou precisão fabricada.

### INV-PRAZO-10 — Fechamento imortal

Edição posterior de plano, baseline ou medição não altera fechamento/corte histórico anterior. Correção produz nova versão/evento.

### INV-PRAZO-11 — Autoridade contextual

Editar plano e aprovar compromisso são capacidades distintas e sempre validadas server-side na interseção usuário, papel, tenant, obra e momento.

### INV-PRAZO-12 — Domínios de hash separados

Hash de cronograma possui formato e domínio próprios e nunca altera silenciosamente o hash financeiro.

## 6. Decisões aprováveis

Com a aprovação desta RFC ficam autorizadas, para desenho e futura implementação por fases:

1. reutilizar `atividades`/dependências como plano corrente;
2. evoluir `cronograma_baseline` em vez de criar outro repositório de planos;
3. produzir baseline exclusivamente server-side;
4. serializar snapshot com formato, normalização e ordenação determinísticos;
5. identificar algoritmo e versão do hash;
6. preservar todas as versões e lineage;
7. manter progresso atual como declarado;
8. introduzir realizado verificável incrementalmente, fora da Fase 1;
9. exigir medições futuras append-only;
10. retirar soberania de prazo de `sequenciamento_equipes` sem removê-lo;
11. separar IRO de eventual SPI clássico;
12. usar arquitetura aditiva e compatível.

## 7. Fronteira exata da Fase 1

### Nome

**Baseline + versionamento + comparação estrutural**

### Deve entregar

1. selecionar server-side o cronograma corrente autorizado de uma obra;
2. validar que o plano pode ser congelado;
3. gerar snapshot canônico;
4. aprovar e persistir baseline;
5. gerar hash determinístico em domínio próprio;
6. atribuir versão monotônica por obra;
7. preservar predecessora/lineage;
8. listar versões anteriores;
9. identificar baseline vigente;
10. comparar baseline vigente ou selecionada com plano corrente;
11. retornar diferenças estruturais explicáveis;
12. emitir eventos/auditoria de criação, aprovação, leitura relevante e comparação.

### Não deve entregar

- medição física;
- realizado verificável completo;
- pesos/unidades novos obrigatórios;
- PV, EV ou SPI clássico;
- cálculo de desvio de desempenho;
- data de status para realizado;
- fechamento temporal de prazo;
- alteração do hash financeiro;
- rebaseline automático;
- migração do dashboard/PDFs;
- integração Vision, Control ou Stakeholder View;
- conversão de sequenciamento em atividades;
- inferência de baseline histórica.

Na Fase 1, “desvio” significa somente **diferença estrutural entre compromisso e plano corrente**, não atraso físico nem performance.

## 8. Modelo da Fase 1

```text
ATIVIDADES + DEPENDÊNCIAS CORRENTES
                 │
                 ▼
      seleção/validação server-side
                 │
                 ▼
       snapshot canônico + hash
                 │
                 ▼
       aprovação contextual admin
                 │
                 ▼
 BASELINE N IMUTÁVEL ──lineage──► BASELINE N-1
                 │
                 └──── comparação ──── PLANO CORRENTE
```

Baseline e plano não são sincronizados bidirecionalmente. A aprovação captura o estado; edições posteriores só aparecem no diff.

## 9. Autoridade

### Papéis reais

O sistema possui `admin`, `gestor`, `operacional`, `visualizador` e flag global `is_super_admin`.

### Regra mínima proposta

| Ação | Admin tenant/obra | Gestor | Operacional | Visualizador | Superadmin |
|---|---:|---:|---:|---:|---:|
| Ler baseline/plano | Sim | Sim | Sim conforme acesso | Sim conforme acesso | Sim, server-side |
| Editar plano corrente | Sim | Sim | apenas capacidades já autorizadas, sem ampliar nesta RFC | Não | Sim em suporte autorizado |
| Submeter candidato | Sim | Sim | Não | Não | Não como fluxo comum |
| Aprovar baseline | **Sim** | Não | Não | Não | Não em nome do tenant no fluxo comum |
| Comparar baseline/plano | Sim | Sim | Sim/visualização conforme acesso | Sim | Sim |

Justificativa:

- o papel `owner` não existe; criar outro papel excede a Fase 1;
- `admin` já é a autoridade tenant-scoped que a policy atual de baseline reconhece;
- gestor pode preparar/editar, mas aprovação transforma plano em compromisso;
- superadmin preserva capacidade técnica de leitura/suporte, porém não assume vontade contratual do tenant;
- qualquer exceção de aprovação por superadmin exigirá fluxo explícito, justificativa, auditoria e RFC complementar.

Todas as decisões são derivadas server-side. A UI apenas solicita.

## 10. Imutabilidade

### Garantias obrigatórias no banco

- FKs e coerência de tenant/obra;
- unicidade da versão por obra;
- lineage válido e sem cruzamento de tenant/obra;
- nenhuma policy ordinária de UPDATE/DELETE;
- bloqueio de UPDATE/DELETE inclusive contra grants acidentais;
- criação somente pelo caminho privilegiado autorizado;
- constraints para formato/hash/autoria obrigatórios;
- concorrência serializada ao alocar versão;
- RLS contextual de leitura.

### Garantias obrigatórias na operação server-side

- autenticar usuário e derivar tenant/obra/papel;
- ler plano em visão transacional consistente;
- validar snapshot, motivo e autorização;
- selecionar predecessor vigente;
- canonicalizar e calcular hash;
- inserir baseline e eventos atomicamente;
- falhar sem persistência parcial;
- nunca aceitar snapshot, hash, versão ou aprovador enviados como autoridade pelo cliente.

### Sucessão

Baseline N+1 referencia N. N permanece integralmente legível e verificável. “Deixar de ser vigente” significa ser sucedida por versão posterior segundo regra de vigência; não significa mutação da versão anterior.

## 11. Contrato do snapshot e do hash

### Domínio

O hash pertence a um domínio próprio, por exemplo conceitual `opera.atlas.schedule-baseline`, separado de `periodos_fechados.hash_snapshot`.

### Envelope mínimo do snapshot

- identificador e versão do formato;
- tenant e obra;
- versão/vigência da baseline e predecessor, quando esses campos fizerem parte do conteúdo assinado;
- calendário/premissas disponíveis na Fase 1;
- coleção de atividades;
- coleção de dependências.

### Campos de atividade incluídos

- ID estável;
- `parent_id`;
- nome e descrição com significado de escopo;
- data de início e fim;
- ordem quando semanticamente relevante;
- responsável;
- peso, unidade e meta somente se já existirem no momento da implementação;
- estado de inclusão no compromisso.

`progresso`, `updated_at`, `updated_by`, cor de apresentação e timestamps técnicos não entram no compromisso da Fase 1. Atividades soft-deleted não entram na versão nova, mas permanecem em versões anteriores.

### Campos de dependência incluídos

- predecessora e sucessora;
- tipo;
- lag em dias.

### Canonicalização

- normalização documentada de Unicode/texto, datas ISO, números, booleanos, nulos e ausências;
- chaves do objeto em ordem canônica;
- atividades ordenadas por chave estável documentada e ID como desempate;
- dependências ordenadas por predecessora, sucessora, tipo e lag;
- arrays sem dependência da ordem de retorno do banco;
- serialização UTF-8 determinística;
- versão do formato dentro do domínio assinado.

### Algoritmo e recomputação

O algoritmo criptográfico será escolhido na especificação da implementação, identificado por nome/versão e não implícito. A operação de verificação deve recomputar o hash do payload armazenado sem consultar o plano corrente.

Mesmo payload canônico + mesmo domínio + mesmo algoritmo deve produzir o mesmo hash. Alterar formato/algoritmo cria nova versão identificável; não invalida hashes anteriores.

## 12. Contrato do diff estrutural

### Comparação

O comparador recebe uma baseline autorizada — vigente por padrão ou explicitamente selecionada — e uma leitura consistente do plano corrente da mesma obra.

### Identidade

Atividades são correlacionadas por ID estável, não por nome. Dependências são correlacionadas pelo par predecessora/sucessora e seus atributos.

### Categorias mínimas

| Categoria | Conteúdo mínimo |
|---|---|
| `ATIVIDADE_ADICIONADA` | atividade presente apenas no plano corrente |
| `ATIVIDADE_REMOVIDA` | atividade presente apenas na baseline |
| `INICIO_ALTERADO` | datas baseline/atual e delta em dias corridos |
| `FIM_ALTERADO` | datas baseline/atual e delta em dias corridos |
| `DURACAO_ALTERADA` | duração inclusiva baseline/atual e delta |
| `RESPONSAVEL_ALTERADO` | valor anterior/atual |
| `HIERARQUIA_ALTERADA` | pai anterior/atual |
| `ORDEM_ALTERADA` | valores, somente se ordem tiver semântica |
| `DESCRICAO_ESCOPO_ALTERADA` | anterior/atual, sem tentar inferir impacto |
| `PESO_UNIDADE_META_ALTERADOS` | valores, apenas se esses campos existirem |
| `DEPENDENCIA_ADICIONADA` | predecessor/sucessor/tipo/lag atual |
| `DEPENDENCIA_REMOVIDA` | predecessor/sucessor/tipo/lag da baseline |
| `DEPENDENCIA_ALTERADA` | tipo/lag anterior/atual |

### Saída

Cada item informa categoria, atividade/dependência, before, after e deltas determinísticos. A resposta inclui baseline ID/versão/hash, instante da leitura atual, formato e contagens por categoria.

Exemplo:

```text
ATIVIDADE X
baseline: início 2026-08-10, fim 2026-08-15
atual:    início 2026-08-12, fim 2026-08-18
resultado: INÍCIO +2 dias; FIM +3 dias; DURAÇÃO +1 dia
```

O diff não atribui causa, criticidade, atraso contratual ou impacto físico sem dados próprios. Ele é explicação estrutural, não score.

## 13. Baseline vigente

Na Fase 1, a baseline vigente é a versão aprovada mais recente para a obra segundo ordem de versão/vigência definida pela implementação. Não haverá flag `ativa` que exija mutar a versão anterior.

Regras:

- nenhuma baseline → `baseline inexistente`;
- uma baseline → ela é vigente;
- nova versão aprovada → passa a vigente sem alterar a anterior;
- empate/lineage inválido → falha segura;
- seleção histórica por data de status completa fica adiada, embora a metadata de aprovação/vigência deva ser preservada desde a Fase 1.

## 14. Migração e dados históricos

- Não gerar baseline retroativa automaticamente.
- Não tratar estado atual como compromisso histórico.
- Obra sem aprovação registrada recebe `baseline histórico inexistente`.
- Não converter progresso ou sequenciamento em evidência/realizado.
- A futura adoção inicial explícita captura o plano na data real da aprovação e será rotulada “primeira baseline adotada”, não “baseline original”.
- Atividades e dependências existentes permanecem intactas.
- Baselines existentes, se houver no remoto, devem ser inventariadas e classificadas antes da migration; não podem ser silenciosamente reescritas para o novo formato.

## 15. Observabilidade e auditoria

### Eventos conceituais mínimos

| Evento | Quando | Payload mínimo |
|---|---|---|
| `schedule.baseline.approval_requested` | submissão válida | tenant, obra, ator, motivo, correlation ID |
| `schedule.baseline.approved` | commit atômico | baseline, versão, predecessor, hash, formato, aprovador, vigência |
| `schedule.baseline.approval_denied` | autorização/validação negada | motivo seguro, ator, obra, correlation ID |
| `schedule.baseline.approval_failed` | falha técnica | etapa/código seguro e correlation ID |
| `schedule.baseline.verified` | hash recomputado | baseline, hash esperado/recomputado, resultado |
| `schedule.baseline.diff_read` | comparação relevante | baseline, hash, obra, ator, contagens; não duplicar payload sensível |

O registro aprovado deve permitir responder quem criou/aprovou, quando, versão, predecessora, hash, formato, obra, snapshot e motivo da sucessão. A baseline anterior não recebe evento de “edição”; a aprovação da sucessora explica por que deixou de ser vigente.

Eventos de sucesso fazem parte da mesma transação quando tecnicamente possível. Falhas/negações são observadas sem vazar dados de outro tenant.

## 16. Compatibilidade obrigatória

A Fase 1:

- não quebra nem substitui o Gantt;
- não apaga ou duplica atividades;
- não altera `atividades.progresso`;
- não remove/migra `sequenciamento_equipes`;
- não muda dashboard, ScheduleCard ou analytics;
- não muda PDFs ou nomenclatura pública nesta fase;
- não muda fechamento/reabertura;
- não modifica hash financeiro;
- não promove dados antigos a verificados;
- não exige baseline para continuar usando o plano corrente;
- adiciona operações e schema de maneira compatível.

## 17. Critérios de aceite da Fase 1

1. Baseline pode ser criada somente pela operação server-side autorizada.
2. Admin de tenant/obra pode aprovar; demais papéis não podem.
3. Cliente não controla tenant, aprovador, versão, snapshot ou hash.
4. Baseline aprovada rejeita UPDATE e DELETE por caminhos ordinários.
5. Segunda versão referencia e não altera a primeira.
6. Mesmo snapshot canônico produz o mesmo hash.
7. Hash armazenado pode ser recomputado e verificado offline/server-side.
8. Mudança de ordenação de query não muda snapshot/hash.
9. Baseline vigente é identificada sem mutar versões antigas.
10. Histórico e lineage são listáveis em ordem determinística.
11. Diff detecta todas as categorias mínimas e explica before/after.
12. Diff nunca compara tenant/obra diferentes.
13. Ausência de baseline retorna estado explícito, não inferência.
14. Gantt e operações atuais continuam funcionais.
15. Atividades, progresso, sequenciamento, dashboard, PDFs e fechamentos permanecem intactos.
16. RLS/testes provam isolamento tenant e acesso contextual por obra.
17. Concorrência de duas aprovações não produz versão duplicada ou lineage quebrado.
18. Falha entre snapshot/evento não deixa baseline parcial.
19. Logs respondem autoria, motivo, versão, predecessor, hash e formato.
20. `git diff --check`, testes de migration, RLS e contrato passam antes do rollout.

## 18. Rollback e segurança

### Estratégia

- migration futura é aditiva;
- Gantt não depende da nova operação;
- recurso nasce desabilitado/opt-in por rollout;
- leitura e aprovação podem ser desligadas sem apagar dados;
- rollback de aplicação volta a ignorar as novas capacidades;
- baselines aprovadas permanecem armazenadas e imutáveis;
- nunca executar rollback que faça DROP/truncate/delete de payload histórico;
- correção de schema usa migration seguinte compatível;
- export/backup das versões precede qualquer mudança estrutural posterior.

### Falha segura

Se formato, algoritmo, lineage, autorização ou integridade forem desconhecidos, aprovação e diff são negados/logados. Baseline inválida não vira vigente por fallback.

## 19. Classificação constitucional

### Fase 1

**MINOR / ADITIVA.** Ela adiciona capacidade e reforça I1–I3, I5–I8 e I10, sem quebrar contratos existentes nem alterar hash financeiro.

### Governança

- esta RFC é a autorização arquitetural;
- a implementação exigirá especificação técnica do snapshot/hash, threat model, migration compatível e testes RLS/concorrência;
- ao incorporar baseline como entidade fundamental e registrar a adoção, recomenda-se bump aditivo do OPERA_CORE e atualização das seções de entidades, temporalidade, causalidade e soberania;
- isso não enfraquece invariantes e não exige MAJOR constitucional.

### Pontos que elevariam a classificação

- alterar hash financeiro: MAJOR e RFC própria;
- reescrever/apagar baseline: violação/rejeição ou emenda explícita;
- mudar papéis/ownership: RFC de autorização;
- exigir baseline para o Gantt existente: quebra de compatibilidade;
- reinterpretar dados históricos: mudança semântica de alto risco e fora desta RFC.

## 20. NÃO DECIDIDO NESTA RFC

- fórmula definitiva do realizado;
- entidade e workflow completos de medição;
- critérios completos de evidência e confiança;
- pesos, unidades, metas e calendários;
- data de status para cálculo de desempenho;
- PV, EV e SPI clássico;
- fórmula/classificação de atraso e adiantamento;
- fechamento temporal de prazo;
- integração com hash financeiro;
- rebaseline, sua autoridade e vigência histórica completa;
- automação de aprovação;
- migração/depreciação definitiva do IRO;
- vínculo técnico de `sequenciamento_equipes` com atividades;
- integração Vision;
- integração Control;
- Stakeholder View;
- motor de caminho crítico;
- causa automática do desvio.

Esses temas exigem RFCs ou decisões posteriores e não podem entrar na Fase 1 por conveniência.

## 21. Resultado da aprovação

Se aprovada, esta RFC autoriza somente o planejamento detalhado e a futura implementação da Fase 1 descrita no §7, condicionada aos critérios do §17. Ela não autoriza migration nesta missão nem qualquer item da seção “NÃO DECIDIDO”.

Até aprovação formal, o documento permanece **PROPOSTA PARA APROVAÇÃO / NÃO IMPLEMENTADO**.
