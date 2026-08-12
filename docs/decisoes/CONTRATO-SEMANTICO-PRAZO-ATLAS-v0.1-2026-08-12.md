# Contrato semântico de prazo do OPERA Atlas v0.1

**Status:** PROPOSTA / NÃO IMPLEMENTADO

**Data:** 2026-08-12

**Direção adotada:** baseline aprovado + atividades correntes + realizado verificável + data de status.

Este documento define significados e invariantes futuras. Ele não define schema, API, fórmula, pesos, UI, migration ou estratégia de migração definitiva.

## 1. Objetivo e princípio central

O domínio de prazo deve permitir que duas consultas sobre a mesma obra, a mesma versão de planejamento e a mesma data de status produzam a mesma interpretação, independentemente do dia em que forem executadas.

Para isso, o Atlas deve separar quatro perguntas que hoje se confundem:

1. **Com o que a organização se comprometeu?** Baseline aprovado.
2. **Como a equipe pretende executar agora?** Plano corrente.
3. **O que foi efetivamente executado e sustentado por evidência?** Realizado verificável.
4. **Em qual instante essas informações estão sendo comparadas?** Data de status.

Nenhum percentual isolado deve simultaneamente significar plano, declaração e execução comprovada.

## 2. Estados semânticos

### 2.1 Baseline aprovado

#### Definição

Baseline aprovado é o **compromisso de prazo formalmente aceito e congelado em um instante**, aplicável a uma obra e identificado por uma versão imutável. Ele responde “qual era o planejamento aprovado?”.

#### Conteúdo semântico mínimo

Uma versão de baseline deve ser suficiente para interpretar o compromisso sem consultar estado mutável posterior. Conceitualmente, deve conter ou referenciar de forma imutável:

- identidade da obra;
- versão e instante de vigência/aprovação;
- estrutura das atividades e seus identificadores estáveis;
- datas e durações planejadas;
- dependências, hierarquia, marcos e calendário aplicável, quando utilizados;
- regra/peso planejado de contribuição de cada unidade ao avanço, se houver indicador agregado;
- limites e premissas relevantes à interpretação;
- autor da submissão, autoridade aprovadora e motivo;
- representação canônica, hash e lineage da versão anterior.

O contrato não exige que tudo esteja em uma única tabela ou JSON; exige que o conjunto congelado seja autossuficiente e reproduzível.

#### Nascimento e aprovação

O baseline nasce somente quando um plano corrente completo é **submetido e aprovado explicitamente**. Salvar ou editar uma atividade não cria baseline.

A aprovação deve ser exercida por ator com autoridade formal sobre o compromisso da obra. Semanticamente:

- editor do cronograma prepara o plano;
- autoridade aprovadora aceita o compromisso;
- a mesma pessoa pode acumular os papéis apenas se a governança da organização permitir;
- o mapeamento exato para `admin`, gestor, owner ou outra autoridade é decisão técnica/governamental futura.

Não se presume que qualquer pessoa capaz de editar uma atividade possa aprovar baseline.

#### Mudança e sucessão

Uma versão aprovada **jamais muda**. Correção, replanejamento ou novo compromisso produz nova versão, com:

- referência à versão sucedida;
- motivo e autoridade;
- instante de aprovação/vigência;
- diferenças rastreáveis;
- preservação integral das versões anteriores.

A nova versão passa a ser a baseline vigente para datas de status compatíveis com sua vigência. Ela não reescreve qual baseline estava vigente em um corte histórico anterior.

#### Invariantes

- Baseline não é o plano corrente vivo.
- Baseline não é realizado.
- Baseline não é sobrescrito, corrigido in-place nem apagado por operação comum.
- Alteração retroativa de uma versão aprovada é semanticamente inválida.
- Hash comprova identidade do conteúdo; não substitui aprovação, autoria ou significado.

### 2.2 Plano corrente

#### Definição

Plano corrente é o **cronograma operacional que a equipe utiliza agora para conduzir e projetar a execução**. Ele responde “como pretendemos executar a partir do conhecimento atual?”.

As `atividades` do Gantt são o candidato existente mais próximo dessa semântica.

#### Relação com o baseline

O plano corrente pode divergir do baseline por replanejamento operacional, previsão atualizada ou resposta a eventos reais. Essa divergência não altera o compromisso aprovado. Ela deve ser visível como mudança posterior ao baseline.

Uma alteração pode:

- afetar somente a projeção operacional, mantendo a baseline vigente;
- ser preparada como candidata a uma nova baseline;
- tornar-se novo compromisso apenas após nova aprovação formal.

#### Mutabilidade

O plano corrente é editável por atores autorizados enquanto a governança temporal permitir. A edição deve respeitar:

- períodos fechados e datas de status consolidadas;
- autorização por tenant/obra;
- registro de autor, instante, motivo e estado anterior/novo;
- impossibilidade de reescrever silenciosamente o passado.

Mudanças prospectivas podem alterar o estado vivo. Correções referentes a períodos já consolidados devem seguir fluxo explícito de reabertura/correção e deixar lineage, nunca apagar a interpretação anterior.

#### Invariantes

- O plano corrente é a melhor previsão operacional atual, não o compromisso histórico.
- Sua mutabilidade não autoriza alterar baseline.
- Toda mudança material deve ser causalmente rastreável.
- A projeção corrente em uma data passada deve ser reconstruível por versão/snapshot/eventos.

### 2.3 Realizado declarado

Realizado declarado é a **afirmação humana de avanço ou estado**, ainda não suficientemente sustentada pelas regras de verificação do Atlas.

Exemplos atuais:

- `atividades.progresso` informado manualmente;
- atividade/equipe marcada como em andamento ou concluída;
- `sequenciamento_equipes.status`;
- observação textual de produção.

O declarado é útil como sinal operacional e entrada para conferência, mas não deve ser apresentado automaticamente como realizado verificável nem alimentar indicador contratual sem qualificação.

Toda declaração deve identificar ator, instante de referência e unidade à qual se aplica. Alteração posterior não deve eliminar a declaração original quando ela tiver sustentado uma decisão ou fechamento.

### 2.4 Realizado verificável

#### Definição

Realizado verificável é a **quantidade ou estado de execução até uma data de status que satisfaz regras explícitas de evidência, atribuição e validação**. Ele responde “o que foi executado e por que o Atlas aceita isso como executado?”.

Não significa certeza absoluta. Significa que a afirmação possui cadeia verificável suficiente para o nível de confiança declarado.

#### Requisitos semânticos

Uma medição verificável deve possuir:

- atividade ou unidade planejada inequivocamente identificada;
- quantidade/estado e unidade de medida coerentes;
- data ou intervalo efetivo da execução;
- origem da evidência e ator/sistema que a registrou;
- regra de validação aplicada e resultado;
- vínculo com a versão de plano/baseline interpretada;
- proteção contra dupla contagem;
- correções e invalidações rastreadas sem apagar a medição anterior;
- nível de confiança ou estado de validação quando a evidência for incompleta.

#### Fontes atuais candidatas, não suficientes isoladamente

| Fonte existente | Contribuição possível | Limite atual |
|---|---|---|
| `registros_diarios` | atividade, equipe, data e produção registrada | não possui vínculo canônico com atividade Gantt nem regra universal de unidade/aceite |
| `lotes_consumo` | área executada e intervalo de execução | mede lote/consumo, não necessariamente avanço planejado da atividade |
| `apontamento_diarias` | ajustes e apontamentos operacionais | foco atual não define avanço físico de cronograma |
| `registro_presencas` | presença/capacidade mobilizada | presença não prova produção ou conclusão |
| produtividade por equipe | taxa/produção contextual | falta atribuição e peso canônicos por atividade |
| status/progresso da atividade | declaração diretamente ligada ao plano | manual e sem evidência obrigatória |
| documentos, fotos, inspeções e aceite | evidência corroborativa potencial | contrato de evidência temporal não está definido no domínio atual |

O realizado verificável poderá combinar fontes. Presença e custo podem corroborar execução, mas não devem ser convertidos automaticamente em avanço físico sem regra de medição.

#### Separação obrigatória

`progresso declarado ≠ progresso verificável`

O Atlas pode exibir ambos, desde que informe origem e confiança. A verificação deve promover ou validar uma medição por regra explícita; não deve apenas copiar o percentual declarado para outro campo.

### 2.5 Data de status

#### Definição

Data de status é o **instante de corte explícito no qual baseline, plano corrente, realizado e desvio são avaliados**. Ela responde “até quando os fatos são considerados?”.

Ela não é sinônimo de horário da consulta, `Date.now()`, data de fechamento ou data final da obra. Pode coincidir com um fechamento, mas possui significado próprio.

#### Regras semânticas

- Toda medição de prazo deve declarar sua data de status.
- Dados ocorridos ou conhecidos depois do corte não alteram silenciosamente o resultado daquele corte.
- A versão de baseline aplicável deve ser determinada pela vigência conhecida no corte, sem aplicar retroativamente uma aprovação posterior.
- O plano corrente usado na interpretação histórica deve ser o estado vigente no corte ou um snapshot explicitamente associado a ele.
- O realizado deve incluir apenas execução efetiva até o corte, segundo política explícita para eventos tardios e correções.
- A data de cálculo/consulta deve ser registrada separadamente da data de status.
- Fuso horário, granularidade (instante ou fim de dia/período) e calendário deverão ser definidos tecnicamente sem mudar este significado.

Uma consulta repetida para a mesma obra, baseline, política e data de status deve produzir o mesmo resultado, salvo quando uma correção posterior autorizada for solicitada explicitamente como nova interpretação versionada.

## 3. Relação entre os conceitos

```text
BASELINE APROVADO  ── compromisso histórico imutável
        │
        ├── comparado ao PLANO CORRENTE ── mudança de previsão/replanejamento
        │
        └── comparado ao REALIZADO VERIFICÁVEL ── desempenho contra compromisso
                                      │
DATA DE STATUS ───────────────────────┘ define o corte comum
                                      │
                                      ▼
                                   DESVIO
```

O plano corrente não está “abaixo” do baseline como uma execução; é uma previsão mutável comparável ao compromisso. O realizado verificável não deriva necessariamente do plano corrente; ele registra fatos atribuídos às unidades planejadas. A data de status impede que estados de épocas diferentes sejam misturados.

Há pelo menos duas famílias distintas de desvio:

- **desvio de planejamento:** plano corrente versus baseline;
- **desvio de desempenho:** realizado verificável versus avanço previsto na baseline até a data de status.

Elas não devem ser condensadas em um único número sem que sua composição seja explícita.

## 4. Indicador de prazo

### Situação atual

O indicador atualmente chamado SPI no Atlas é:

`(equipes concluídas / total de equipes) ÷ percentual do prazo transcorrido`

Na ausência de sequenciamento, usa peso fixo da fase da obra. Ele é uma heurística própria e **não é o SPI clássico `EV / PV`**.

### Opções

| Opção | Benefício | Risco semântico |
|---|---|---|
| A — renomear e preservar a heurística | mantém continuidade e sinal operacional barato | ainda pode induzir decisão inadequada se origem/confiança não forem exibidas |
| B — substituir por SPI clássico | adota conceito reconhecido e ligado ao baseline | cria falsa precisão se PV, EV, pesos e realizado verificável ainda não existirem |
| C — manter ambos, distintos | preserva série/sinal atual e permite indicador contratual futuro | exige nomes, escopos e apresentação rigorosamente separados |

### Recomendação semântica

**Opção C é a mais segura**, em transição e possivelmente de forma permanente:

- renomear conceitualmente o indicador atual como **heurística de ritmo operacional** — nome final sujeito à decisão de produto;
- sempre exibir fórmula, fonte, data de status e nível de confiança;
- reservar o termo **SPI** para um indicador que efetivamente satisfaça o contrato `EV / PV`;
- não fabricar SPI clássico antes de existirem baseline ponderado e realizado verificável;
- impedir comparação direta entre as duas séries como se fossem equivalentes.

A heurística pode continuar útil para alerta, mas não como prova de aderência ao cronograma aprovado.

## 5. Desvio de prazo

O contrato futuro deve produzir respostas independentes e rastreáveis:

| Pergunta | Resposta semântica esperada |
|---|---|
| Qual era o compromisso aprovado? | versão integral da baseline vigente no corte |
| Qual é o plano corrente? | projeção operacional vigente na data consultada, com alterações desde a baseline |
| O que foi executado até a data de status? | medições verificáveis aceitas até o corte, mais declarações separadas quando aplicável |
| Quanto deveria estar executado? | avanço planejado derivado da baseline vigente e da data de status |
| Qual é o desvio? | diferença de planejamento e/ou desempenho, identificada pelo tipo, unidade e confiança |
| Quando o desvio surgiu? | primeiro corte reproduzível em que o limiar/regra foi satisfeito |
| O que mudou após a baseline? | diff ordenado e causal das mudanças do plano corrente e das novas baselines |

Não se fixa nesta versão uma fórmula de agregação. Antes disso, será necessário definir unidades, pesos, calendários, tratamento de atividades sobrepostas e política de aceitação do realizado.

O desvio deve sempre declarar:

- baseline e versão;
- data de status;
- plano corrente/snapshot considerado;
- fontes e versão das medições;
- método/versão do cálculo;
- unidade, sinal e confiança;
- instante em que o cálculo foi produzido.

## 6. Reprodutibilidade

### Regra

> Consultar a situação de uma obra em uma data histórica deve produzir a mesma interpretação independentemente do dia em que a consulta for executada.

### Informações que precisam ser preservadas

- todas as versões aprovadas de baseline, conteúdo canônico, hash, vigência, aprovadores e lineage;
- estado/versionamento do plano corrente ou eventos completos capazes de reconstruí-lo;
- medições declaradas e verificáveis, evidências, estados de validação e correções;
- data de status e política de inclusão de eventos tardios;
- calendário, unidade, pesos e premissas vigentes;
- versão do método de cálculo e regras de arredondamento;
- vínculos estáveis entre atividade, medição e evidência;
- eventos causais de criação, alteração, aprovação, reabertura, invalidação e correção;
- snapshots de cortes consolidados e seus hashes quando o custo de replay ou a criticidade justificar;
- identidade do ator/sistema e instante de conhecimento, distintos do instante efetivo do fato.

### Relação com OPERA_CORE

- **Append-only:** aprovações, baselines, medições aceitas e correções preservam versões anteriores.
- **Causalidade:** toda mudança material referencia origem e, quando aplicável, a versão/medição que sucede ou corrige.
- **Irreversibilidade temporal:** o estado conhecido em um corte não é sobrescrito silenciosamente.
- **Reprodutibilidade:** entradas e método versionados permitem repetir o resultado.
- **Hashes:** identificam conteúdo canônico de snapshots/baselines; não substituem autorização ou evidência.
- **Lineage:** rebaseline, reabertura e correção formam cadeia explícita.

Eventos sozinhos só bastam se forem completos, ordenáveis e duráveis. Snapshots sozinhos só bastam para os cortes capturados. O contrato admite combinação de eventos, versões e snapshots.

## 7. Relação com fechamento

### Regra proposta

Fechar um período deve **consolidar também o estado de prazo relevante ao corte**, sem converter o fechamento financeiro atual automaticamente em baseline de cronograma.

O fechamento futuro de prazo deve preservar ou referenciar imutavelmente:

- data de status do fechamento;
- versão da baseline vigente;
- snapshot/versão do plano corrente no corte;
- realizado declarado e verificável aceito até o corte;
- evidências e estados de validação necessários à interpretação;
- desvios e versão do método de cálculo;
- hash e autoria do conjunto consolidado.

### Consequências

- Fechamento não cria uma nova baseline por si só.
- Baseline deve ser referenciada pelo identificador/versionamento vigente, não copiada sem lineage.
- Mudanças posteriores não alteram fechamento anterior.
- Evento tardio ou correção exige nova versão/reabertura explícita, preservando o resultado anterior.
- Reabertura do período não reabre automaticamente a baseline aprovada.
- Rebaseline não reescreve fechamentos já emitidos; novos cortes usam a versão aplicável segundo sua vigência.
- Plano corrente pode continuar prospectivamente editável fora da porção consolidada, conforme governança.

O snapshot de folha existente e o futuro snapshot de prazo possuem finalidades diferentes. Podem compartilhar o evento de fechamento e correlação, mas não devem ter semânticas misturadas.

## 8. Papel futuro de `sequenciamento_equipes`

`sequenciamento_equipes` não deve ser uma segunda fonte soberana de cronograma nem fonte exclusiva de realizado.

Papel sugerido: **visão auxiliar de mobilização e fluxo de equipes**, ligada futuramente ao plano canônico quando houver correspondência explícita.

Ele pode apoiar:

- previsão de entrada/saída e continuidade das equipes;
- conflitos de mobilização e capacidade;
- leitura operacional de frentes;
- sinais auxiliares de risco e ritmo;
- evidência corroborativa, nunca prova automática de avanço físico.

Se linhas atuais duplicarem atividades, uma missão técnica futura deverá decidir migração, vínculo ou descontinuação. Até isso ocorrer:

- seu status permanece declaração operacional;
- semanas não constituem calendário canônico;
- conclusão de equipe não equivale a conclusão ponderada da obra;
- o dado não deve governar o SPI clássico.

Assim, sua classificação futura sugerida é **indicador/planejamento auxiliar de mobilização**, não legado descartado automaticamente e não autoridade de prazo.

## 9. Contrato semântico consolidado

| Conceito | Significado | Mutável? | Versionado? | Fonte futura esperada |
|---|---|---:|---:|---|
| Baseline aprovado | compromisso formal congelado e vigente a partir de uma aprovação | Não; somente sucedido | Sim, obrigatório | snapshot canônico aprovado do plano e dependências |
| Plano corrente | melhor previsão operacional atual de como a obra será conduzida | Sim, sob governança | Sim/reconstruível | atividades correntes e eventos/snapshots de mudança |
| Realizado declarado | afirmação humana ainda não validada pelas regras de evidência | Corrigível sem apagar original | Sim quando material | progresso/status/apontamento com ator e data |
| Realizado verificável | execução aceita por regra explícita, atribuída a atividade e sustentada por evidência | Não sobrescrito; correção sucede | Sim, obrigatório | medições operacionais validadas + evidências vinculadas |
| Data de status | corte explícito comum a plano, realizado e desvio | Não para um cálculo emitido | Sim/registrada | parâmetro persistido do corte/fechamento |
| Desvio | diferença tipada entre compromisso, previsão e/ou desempenho no corte | Recalculável só como nova versão | Sim para resultado emitido | baseline + plano/realizado + data + método versionado |
| Indicador de prazo | medida identificada por método, fontes, corte e confiança | Método evolui por versão | Sim | heurística nomeada e/ou SPI clássico quando suportado |

## 10. Invariantes do contrato

1. Baseline aprovada nunca é sobrescrita.
2. Plano corrente nunca é apresentado como se fosse o compromisso original.
3. Progresso declarado nunca é promovido implicitamente a verificável.
4. Toda análise possui data de status explícita; horário de consulta não é o corte.
5. SPI significa `EV / PV`; outra fórmula deve possuir outro nome.
6. Replanejamento não apaga desvio nem histórico.
7. Fechamento preserva a interpretação do corte e não é alterado por eventos futuros.
8. Correções produzem lineage e nova interpretação versionada.
9. Nenhuma fonte auxiliar, inclusive sequenciamento de equipes, compete silenciosamente com a fonte canônica.
10. Indicador sem fonte, método, versão e confiança não é evidência de prazo.

## 11. Lacunas antes da arquitetura técnica

Uma missão futura precisará resolver, sem que este documento antecipe o schema:

- autoridade e segregação de funções para submissão/aprovação/rebaseline;
- identidade estável e granularidade das atividades;
- calendários, dias úteis, fusos e granularidade da data de status;
- unidades e pesos de planejamento/avanço;
- regra de atribuição entre registros operacionais e atividades;
- níveis de evidência, validação, aceite, contestação e correção;
- política para eventos tardios e conhecimento posterior ao corte;
- modelo de versionamento/replay/snapshot e serialização/hash canônicos;
- semântica de reabertura versus rebaseline;
- convivência e migração de `sequenciamento_equipes`;
- definição do método clássico de PV/EV e critérios para liberar o nome SPI;
- apresentação separada de compromisso, previsão, declaração, verificação e confiança;
- retenção, auditoria e permissões compatíveis com OPERA_CORE;
- migração dos dados atuais sem inventar evidência histórica que nunca existiu.

## 12. Critérios de aceite para a futura arquitetura

Uma arquitetura só implementará este contrato se conseguir demonstrar, no mínimo:

1. duas versões aprovadas coexistem sem alterar a primeira;
2. uma mudança no plano corrente aparece como diff após a baseline;
3. declaração e verificação apresentam estados e fontes diferentes;
4. um cálculo histórico repetido usa a mesma data de status e produz a mesma interpretação;
5. um fechamento permanece idêntico após mudanças posteriores;
6. uma correção/reabertura preserva lineage e resultado anterior;
7. o indicador expõe método e não chama a heurística atual de SPI clássico;
8. sequenciamento não altera a autoridade de prazo sem vínculo/regra explícitos.

Até que esses critérios sejam atendidos, este contrato permanece **PROPOSTA / NÃO IMPLEMENTADO**.
