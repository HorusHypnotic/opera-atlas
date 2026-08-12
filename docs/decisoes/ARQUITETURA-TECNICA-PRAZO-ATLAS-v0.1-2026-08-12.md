# Arquitetura técnica mínima do domínio de prazo do OPERA Atlas v0.1

**Status:** PROPOSTA TÉCNICA / NÃO IMPLEMENTADO

**Data:** 2026-08-12

**Baseline analisado:** `8309476b4bd831dcace3a3a559ac097e64e2f620`

Este documento transforma o contrato semântico de prazo em arquitetura mínima. Não contém SQL final, migration, RPC implementada, alteração de UI ou fórmula definitiva.

## 1. Decisão técnica resumida

A menor arquitetura coerente é:

1. manter `atividades` e `atividade_dependencias` como plano corrente editável;
2. ativar `cronograma_baseline` como snapshot aprovado e imutável desse plano;
3. não duplicar atividades em outra estrutura relacional de planejamento;
4. adicionar lineage, vigência, formato canônico e imutabilidade ao baseline;
5. preservar `atividades.progresso` como realizado declarado;
6. criar uma única entidade append-only de medição por atividade para realizado verificável;
7. ligar gradualmente registros/produção existentes às atividades, sem inferência por texto;
8. exigir `data_status` explícita em toda consulta canônica;
9. calcular desvio server-side, retornando fontes, método e confiança;
10. manter a heurística atual temporariamente como Índice de Ritmo Operacional, fora do indicador canônico.

`sequenciamento_equipes` permanece visão auxiliar de mobilização. O fechamento de prazo usa snapshot/hash próprio associado ao fechamento, sem alterar o hash financeiro existente.

## 2. Restrições constitucionais

A proposta foi confrontada com `.lovable/OPERA_CORE.md` v1.3:

- I1/I6: toda entidade e operação é tenant/obra/contexto-scoped.
- I2: aprovação, verificação, cálculo e fechamento são server-side.
- I3/I11: baseline, medições consolidadas, correções e cortes são append-only/versionados.
- I4: correção retroativa após fechamento exige reabertura formal.
- I5: evidência carrega lineage completo.
- I7: estado consolidado é reconstruível dos eventos primários; snapshot é derivado.
- I8: ausência ou ambiguidade falha de modo seguro e explícito.
- I10: declarado, verificado, consolidado e fechado não se misturam.

O domínio pertence ao núcleo por servir execução física verificável no tempo. Não é BI arbitrário nem app de tarefas.

## 3. Reutilização

| Estrutura | Classificação | Uso futuro | Limite atual |
|---|---|---|---|
| `atividades` | REUTILIZAR + ESTENDER | plano corrente e unidade planejada | falta peso/unidade e trilha completa |
| `atividade_dependencias` | REUTILIZAR + ESTENDER | relações do plano e do snapshot | falta auditoria completa e validação de ciclos |
| `cronograma_baseline` | REUTILIZAR + ESTENDER | compromisso aprovado | falta produtor, lineage, vigência, formato e imutabilidade absoluta |
| `atividades.progresso` | REUTILIZAR | progresso declarado | nível de certeza não está explícito |
| `registros_diarios` | ESTENDER gradualmente | produção/evidência atribuível | atividade é texto |
| `lotes_consumo` | ESTENDER gradualmente | medição física candidata | atividade é texto; aceite não definido |
| produtividade | REUTILIZAR como contexto | corroboração/capacidade | não prova avanço isoladamente |
| `registro_presencas` | NÃO USAR como avanço direto | contexto de mobilização | presença não é produção |
| `apontamento_diarias` | NÃO USAR como avanço direto | contexto operacional/financeiro | não mede avanço físico |
| auditoria/eventos | ESTENDER | lineage do plano | cobertura parcial |
| `periodos_fechados` | REUTILIZAR por associação | âncora mensal/reabertura | snapshot/hash é financeiro |
| `sequenciamento_equipes` | MIGRAR consumidores | mobilização auxiliar | hoje alimenta indicador de prazo |
| `calculateScheduleMetrics` | DEPRECAR gradualmente | heurística transitória | não é SPI e depende do relógio |
| `export-csv` | ESTENDER | exportar novas fontes com lineage | export bruto não é interpretação |

Não existe hoje conceito equivalente a `data_status`. `Date.now()`, data de fechamento e datas da obra não têm essa semântica.

## 4. Delta mínimo de schema

Os nomes são conceituais; a migration futura poderá ajustá-los.

| Conceito | Estrutura atual | Lacuna | Mudança mínima |
|---|---|---|---|
| Integridade do baseline | IDs sem FKs declaradas | referência tenant/obra fraca | FKs/constraints e índices tenant/obra/versão |
| Aprovação/vigência | `congelado_em/por` | falta vigência quando distinta da aprovação | reutilizar como aprovado em/por; coluna `vigente_desde` apenas se necessária |
| Lineage | versão numérica | sem predecessor | relação nullable à baseline anterior, mesma obra/tenant |
| Formato reproduzível | snapshot/hash | formato e algoritmo implícitos | colunas de versão do snapshot e do hash |
| Imutabilidade | superadmin pode mutar | append-only não absoluto | revogar mutação ordinária + policies/trigger bloqueadores |
| Baseline vigente | nenhuma marca | escolha histórica ambígua | derivar por vigência/versão aplicável ao corte; índice, sem flag mutável |
| Peso/unidade | inexistentes em atividades | agregação sem significado | colunas nullable de peso e unidade/meta planejada |
| Histórico do plano | timestamps/eventos parciais | não reconstitui cortes | trigger/evento DB usando auditoria existente |
| Realizado verificável | inexistente | falta evento de medição | uma nova tabela append-only de medições por atividade |
| Produção → atividade | campos de texto | atribuição ambígua | FKs nullable nas fontes adotadas, gradualmente |
| Evidência | sem contrato comum | lineage obrigatório | manifesto/relação de evidência na medição |
| Data de status | inexistente | cálculo usa relógio | nenhuma tabela: parâmetro obrigatório server-side |
| Resultado emitido | snapshot financeiro | prazo não preservado | tabela de corte de prazo somente para emissão/fechamento |
| Fechamento | sem vínculo | nenhuma versão de prazo | FK do corte de prazo ao período; hash financeiro intocado |
| Método | código implícito | cálculo não reproduzível | versão do método no resultado/corte |

### Entidade nova mínima: medição de atividade

A única tabela nova indispensável ao realizado verificável representa evento primário append-only com tenant, obra, atividade, data/intervalo efetivo, quantidade/unidade, estado de certeza, fonte/evidência, regra/ator da verificação, predecessor compensado, instante de ocorrência/conhecimento e correlation/causation IDs.

Ela preserva incrementos/medições, não apenas “percentual atual”. Correção cria evento compensatório.

### Entidade posterior: corte de prazo

Não é pré-requisito para consulta ad hoc. Torna-se necessária para relatório emitido ou fechamento imutável. Materializa entradas, saída, método e hash, mas continua derivada dos eventos primários conforme I7.

## 5. Baseline versionado

### Fluxo mínimo

```text
atividades + dependências atuais
→ leitura server-side consistente
→ validação e aprovação explícita
→ snapshot canônico ordenado
→ hash versionado
→ versão N com lineage
→ registro imutável + evento
```

### Produtor e autoridade

Uma única operação transacional server-side, conceitualmente `aprovar_baseline`, produz a versão. O cliente fornece obra, motivo, vigência pretendida e correlation ID. O servidor deriva tenant, ator, papel, versão, snapshot e hash.

Somente ator com permissão contextual de aprovação executa. A aprovação e o evento são atômicos. O mapeamento exato do papel exige RFC; capacidade de editar atividade não implica aprovação.

### Payload canônico

- versão do formato, tenant/obra, vigência e calendário;
- atividades não excluídas com ID, pai, conteúdo relevante, datas, ordem e pesos/metas quando definidos;
- dependências com predecessora, sucessora, tipo e lag;
- premissas necessárias;
- referência à baseline anterior.

Campos voláteis sem significado de compromisso ficam fora.

### Ordenação, hash e versão

- chaves JSON, atividades e dependências seguem ordenação documentada e estável;
- IDs são desempate; datas, números, nulos e texto são normalizados;
- serialização determinística e algoritmo de hash são versionados;
- hash cobre payload, versão do formato e predecessor;
- versão é alocada sob lock/constraint no servidor;
- baseline vigente no corte é a de vigência mais recente não posterior à `data_status`;
- empate ou ambiguidade falha de forma segura;
- nova versão sucede, nunca altera ou apaga a anterior.

Nenhum admin ou superadmin edita/apaga baseline pela API ordinária. Correção cria versão/compensação.

## 6. Plano corrente

`atividades` e dependências continuam o único plano vivo. Baseline é snapshot do compromisso, não cópia editável.

Não é necessário `baseline_id` em cada atividade: IDs estáveis capturados no snapshot permitem diff. Atividade posterior aparece como adição; removida permanece na versão anterior.

São alterações materiais: criar/excluir/restaurar, alterar datas, progresso declarado, hierarquia, peso/meta/unidade, dependência/tipo/lag e identidade/escopo. Cada uma gera evento server-side ou DB com old/new, ator, tenant, obra, instante e causalidade. Alteração retroativa após fechamento segue reabertura.

Diff atual usa snapshot + estado vivo. Consulta histórica do plano exige replay completo ou snapshot de corte; `updated_at` não basta.

## 7. Realizado verificável

| Alternativa | Custo | Auditabilidade | Integração | Risco | OPERA_CORE |
|---|---:|---:|---|---|---|
| A — manual + evidência obrigatória | baixo/médio | média | reaproveita progresso | evidência pode não provar quantidade | parcial |
| B — medição por atividade | médio | alta | nova entidade | exige unidade/meta | alta aderência |
| C — produção física vinculada | médio/alto | alta | registros/lotes | unidades heterogêneas | alta com regras explícitas |
| D — combinação gradual | incremental | alta progressiva | A declarado, B núcleo, C adaptadores | risco de mistura na transição | melhor opção |

### Estratégia recomendada: D

1. manter `atividades.progresso` como declarado;
2. criar medições append-only vinculadas à atividade, inicialmente com evidência e validação humana;
3. impedir declarado de entrar no resultado verificado;
4. ligar primeiro fonte estruturada aderente, como `lotes_consumo`, por FK e regra versionada;
5. ligar registros diários quando atividade, produção e unidade forem estruturadas;
6. usar presença, custo e sequenciamento só como contexto;
7. corrigir por compensação, nunca editar consolidado;
8. não agregar percentual até peso/meta/unidade terem contrato válido.

Dados legados permanecem declarados/desconhecidos; não se inventa realizado histórico.

## 8. Data de status

Contrato técnico mínimo:

- parâmetro obrigatório de `calcular_estado_prazo`;
- normalizada server-side;
- nunca default implícito para `now()`;
- seleciona baseline, limita medições e determina plano no corte;
- retorna junto da data/hora de cálculo;
- persiste em corte, fechamento, export ou relatório emitido;
- integra o payload/hash do corte.

| Local | Regra |
|---|---|
| Consulta/RPC | obrigatória |
| Baseline | baseline tem vigência, não data de status |
| Corte de prazo | obrigatória e imutável |
| Fechamento | obrigatória, segundo política do período |
| Tabela só de datas | desnecessária |

A UI pode sugerir hoje, mas envia explicitamente; ausência não vira relógio atual no servidor.

## 9. Desvio reproduzível

```text
obra + data_status
→ baseline vigente validada por hash
+ plano no corte
+ medições verificáveis até o corte
+ calendário/pesos/método versionados
→ estado de prazo explicável
```

Inputs obrigatórios: contexto server-side, corte, baseline, plano reconstruído, medições/correções, estados de certeza, calendário, pesos/unidades, versão do método, arredondamento e correlation ID.

Saída mínima:

- corte e data de cálculo;
- baseline/hash e método;
- planejado e realizado verificável, se suportados;
- diferença absoluta/relativa e unidade;
- atraso/adiantamento apenas com dados suficientes;
- diff baseline × plano e atividades contribuintes;
- atividade crítica apenas com motor confiável;
- fontes, confiança, faltas e motivo de indeterminação.

Sem pesos, baseline ou realizado válido, retorna `não determinável`, nunca zero ou SPI fabricado. O resultado não é chamado SPI clássico até existir EV/PV formal.

## 10. Indicador atual

Nome transitório recomendado: **Índice de Ritmo Operacional (IRO)**.

- permanece temporariamente no dashboard/PDF para compatibilidade;
- exibe fórmula, data de cálculo e aviso de que não é SPI nem baseline;
- fica separado do estado canônico;
- não entra em fechamento ou decisão contratual automática;
- cálculo atual é encapsulado/versionado sem mudança matemática;
- dashboard e PDFs migram após aceite do novo estado;
- termo SPI fica reservado a EV/PV.

## 11. `sequenciamento_equipes`

Permanece visão de mobilização e pode futuramente referenciar atividades/frentes. Não determina avanço canônico e não é convertido automaticamente.

Consumidores futuros a migrar:

- `DashboardOverview` deixa de usá-lo no indicador canônico;
- `calculateScheduleMetrics` vira implementação legada do IRO;
- `ScheduleCard` separa IRO de prazo canônico;
- PDFs deixam de rotular IRO como SPI;
- relatório de equipe mantém mobilização explicitamente;
- Redução de Perdas, demo e CSV continuam sem quebra.

## 12. Fechamento temporal

Não alterar conteúdo ou algoritmo do hash financeiro. Em fase posterior, criar corte de prazo separado associado a `periodos_fechados`, com corte, baseline ID/versão/hash, plano, medições consolidadas, método/resultado, hash próprio, ator e lineage.

Reabertura financeira não reabre baseline automaticamente. Correção do prazo emite nova versão encadeada e preserva a anterior.

Adicionar snapshot derivado é compatível com I7. Incorporá-lo ao hash financeiro existente seria MAJOR, exigindo RFC, versão e compatibilidade; a proposta mínima evita isso.

## 13. Operações mínimas

| Operação | Entrada | Validação | Saída | Invariante |
|---|---|---|---|---|
| `aprovar_baseline` | obra, motivo, vigência, correlação | JWT, contexto, papel, plano e lock | baseline/hash/versão/evento | I1–I3, I6–I10 |
| `listar_baselines` | obra, corte opcional | acesso contextual | metadata/lineage | I1, I6, I7 |
| `comparar_baseline_plano` | obra, baseline/corte | hash, acesso, reconstrução | diff explicável | I2, I7, I8 |
| `registrar_medicao_atividade` | atividade, ocorrência, quantidade, evidência | contexto, período, unidade, lineage, duplicidade | evento de medição | I1–I6, I8, I10 |
| `verificar_medicao` | medição, decisão, regra, motivo | autoridade, período, evidência | novo estado/evento | I2–I5, I10 |
| `calcular_estado_prazo` | obra, data_status, método | baseline/hash/fontes/autorização | planejado, realizado, desvio e confiança | I1, I2, I7–I10 |
| `emitir_corte_prazo` | obra, corte, fechamento opcional | cálculo determinável e contexto | snapshot/hash/evento | I3–I7, I10/I11 |

Não é necessária RPC separada para SPI nesta fase.

## 14. Impacto constitucional

O OPERA_CORE não formaliza SemVer de features. Aqui: PATCH é correção compatível; MINOR, capacidade aditiva; MAJOR, quebra de contrato consolidado/invariante.

| Mudança | Classe | Governança |
|---|---|---|
| Produtor e imutabilidade do baseline | MINOR | RFC + migration compatível |
| Formato/hash/lineage do baseline | MINOR | RFC de serialização |
| Auditoria completa do plano | MINOR | migration e testes constitucionais |
| Medição append-only | MINOR | RFC de domínio, RLS e threat model |
| `data_status` em nova API | MINOR | contrato aditivo versionado |
| IRO + cálculo canônico | MINOR | rollout aditivo; renome visual posterior pode ser PATCH |
| Corte separado no fechamento | MINOR | RFC/migration alinhada a I11 |
| Alterar hash financeiro | MAJOR | RFC, versão, compatibilidade e possível emenda |
| Reinterpretar legado como verificado | MAJOR/REJEITAR | viola I7/I10 sem evidência |
| Enfraquecer append-only | MAJOR | emenda, bump constitucional e consenso |

I1–I11 já sustentam a proposta; não é necessária nova invariante. Ao implementar baseline/cortes como entidades fundamentais, recomenda-se atualização aditiva das seções 3, 5, 6 e 8 do OPERA_CORE e bump de versão como nota de adoção.

## 15. Ordem de implementação

| Fase | Escopo | Aceite |
|---:|---|---|
| 0 | RFC, formato, papéis, calendário e threat model | decisões abertas resolvidas e testes desenhados |
| 1 | produtor/hardening do baseline | determinismo, concorrência segura, imutabilidade, Gantt intacto |
| 2 | histórico do plano e diff | todas as mudanças materiais reconstruíveis/auditadas |
| 3 | data de status + comparação baseline/plano | mesma entrada/corte produz mesma saída |
| 4 | medição manual append-only com verificação | declarado separado; correção compensatória; fronteiras protegidas |
| 5 | adaptador de uma fonte física | FK, unidade/regra versionada, sem duplicidade |
| 6 | desvio de desempenho | resultado explicável; sem nome SPI indevido |
| 7 | consumidores paralelos | IRO e estado canônico não se misturam |
| 8 | corte/fechamento de prazo | hash separado e reabertura versionada |
| 9 | depreciação legada | consumidores migrados e dependências ocultas verificadas |

Rollback de código nunca apaga baseline, medição ou corte já emitido.

## 16. Migração sem big bang

- Gantt continua usando `atividades`.
- Baseline começa opt-in; obra sem baseline mostra “não configurado”.
- Progresso atual permanece declarado.
- Medições verificáveis começam prospectivas e vazias.
- Dashboard/PDFs preservam temporariamente a heurística.
- Estado canônico roda em paralelo e pode retornar indeterminado.
- Sequenciamento permanece íntegro.
- Exportações são aditivas.
- Fechamento financeiro não muda antes da fase própria.
- Não se cria baseline retroativa nem se converte progresso/equipe em verificado.
- Primeira aprovação usa vigência real, não data inventada.
- Novas colunas começam nullable/sem efeito nos fluxos existentes.

## 17. Riscos prioritários

1. Duas verdades durante a transição: IRO e estado canônico.
2. Histórico fabricado ao promover legado a verificado.
3. Hash divergente por serialização/ordenação.
4. Quebra MAJOR se prazo for incorporado ao hash financeiro.
5. Evidência decorativa sem regra de atribuição.
6. Consumidores ocultos em PDFs, demo, export e relatórios.
7. Plano histórico incompleto por eventos parciais.

## 18. Questões para a RFC da fase 0

- autoridade de aprovação/rebaseline e segregação;
- formato, algoritmo de hash e vigência;
- calendário, fuso, granularidade e eventos tardios;
- peso/meta/unidade por atividade;
- workflow de medição/verificação;
- storage/evidência com lineage;
- primeira fonte física e deduplicação;
- reabertura de corte de prazo;
- nomes públicos do IRO e do estado canônico;
- critérios para declarar EV, PV e SPI.

Até essas questões serem decididas, esta arquitetura permanece **PROPOSTA TÉCNICA / NÃO IMPLEMENTADO**.
