# Checkpoint — Baseline de Prazo V1 — OPERA Atlas — 2026-08-12

## Estado do checkpoint

O Baseline de Prazo V1 está **aprovado pelo owner e registrado como capacidade canônica existente**.

- Conceito aprovado: separar o plano corrente do compromisso de prazo aprovado.
- Arquitetura aprovada: snapshot versionado, determinístico, imutável e com autoridade server-side.
- Commit funcional aprovado: `fc41041364dff022b41be25b7d11e096d784fda8` (`feat(atlas): implement versioned schedule baseline`).
- Aceite funcional: o owner validou o comportamento no Lovable e o aprovou.

Este documento é um checkpoint reconstruível e exclusivamente documental. Ele não altera o comportamento aprovado.

## Genealogia documental e técnica

A decisão foi construída e implementada nesta sequência:

1. Auditoria — `docs/decisoes/AUDITORIA-PRAZO-SPI-FONTE-CANONICA-ATLAS-2026-08-12.md`.
2. Contrato semântico — `docs/decisoes/CONTRATO-SEMANTICO-PRAZO-ATLAS-v0.1-2026-08-12.md`.
3. Arquitetura técnica — `docs/decisoes/ARQUITETURA-TECNICA-PRAZO-ATLAS-v0.1-2026-08-12.md`.
4. RFC — `docs/rfcs/RFC-PRAZO-CANONICO-ATLAS-v0.1-2026-08-12.md`.
5. Implementação — `docs/decisoes/IMPLEMENTACAO-BASELINE-PRAZO-V1-2026-08-12.md` e commit funcional `fc41041364dff022b41be25b7d11e096d784fda8`.
6. Aceite — validação funcional e aprovação do owner, formalizadas neste checkpoint.

## Estado funcional canônico

| Conceito | Fonte ou operação canônica |
| --- | --- |
| Plano corrente | `atividades` |
| Compromisso aprovado | `cronograma_baseline` |
| Aprovação | RPC server-side `aprovar_baseline_cronograma` |
| Baseline | Snapshot canônico + hash + versão + lineage |
| Histórico | Versões anteriores imutáveis |
| Autoridade de aprovação | Admin contextual do tenant e da obra |

O plano corrente permanece editável conforme as permissões existentes. Uma aprovação não transforma o baseline em
cópia viva: ela cria uma nova versão do compromisso, preservando todas as anteriores.

## Contrato aprovado

### Schema e versionamento

A implementação reutiliza e estende `cronograma_baseline`. `congelado_em` e `congelado_por` registram o instante e o
autor da aprovação. `snapshot_json` guarda o compromisso; `hash` guarda seu SHA-256; `versao` identifica a versão;
`baseline_anterior_id` preserva lineage. Formato, versão do formato e algoritmo distinguem o contrato V1 de registros
legados. A maior versão da obra é a vigente, sem atualização destrutiva da versão anterior.

### Operação e autoridade

`aprovar_baseline_cronograma` deriva identidade e tenant no servidor, valida acesso à obra e exige papel `admin`
contextual. Gestor não aprova compromisso. Superadmin não aprova rotineiramente em nome do tenant. A operação é
transacional, serializa aprovações concorrentes e deixa trilha em `audit_logs` e `system_events`, incluindo
correlation ID.

### Snapshot e hash

O snapshot contém `tenant_id`, `obra_id`, atividades e dependências. Atividades preservam `id`, `nome`, datas de
início e fim, duração em dias, responsável e ordem. Dependências preservam predecessor, sucessora, tipo e lag.
Progresso corrente, propriedades visuais, timestamps mutáveis, estado posterior e dados financeiros não participam.

A ordenação é explícita, datas usam `YYYY-MM-DD` e a serialização JSONB é canônica. O SHA-256 é calculado no servidor
sobre o domínio e a versão do formato mais o snapshot. Ele é próprio do cronograma e separado dos hashes financeiros.

### Imutabilidade e UI

Escrita direta autenticada foi revogada e trigger server-side bloqueia `UPDATE` e `DELETE` de baseline aprovado.
Mudança de compromisso exige nova versão. A UI do Cronograma apresenta ausência ou versão vigente, hash resumido,
confirmação da aprovação e histórico mínimo com versão, data, aprovador, hash e condição vigente/histórica. O Gantt
permanece preservado.

## Validações e aceite

Na implementação foram executados com sucesso:

- build de produção;
- typecheck TypeScript;
- testes Vitest existentes;
- lint direcionado aos arquivos da UI alterados;
- `git diff --check`.

Foi criado o teste pgTAP `supabase/tests/database/schedule_baseline.test.sql`, cobrindo determinismo, ordenação,
versionamento, preservação histórica, vigência única, autorização, isolamento cross-tenant e imutabilidade. Ele não
foi executado naquela sessão porque o Docker local estava indisponível. Nenhuma execução pgTAP é inferida neste
checkpoint.

Além dessas verificações técnicas, o owner realizou validação funcional no Lovable e aprovou o comportamento.

## Limitações preservadas

Ainda não existem neste domínio:

- diff estrutural completo;
- realizado verificável;
- EV/PV;
- SPI clássico;
- integração temporal com fechamento;
- rebaseline avançado;
- integração Vision;
- integração Control;
- Stakeholder View.

Essas ausências são limites deliberados do Baseline de Prazo V1. Este checkpoint não autoriza nem inicia a Fase 1B.
