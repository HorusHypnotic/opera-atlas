# Plano: PDF "Diagnóstico Objetivo OPERA Atlas"

Gerar um único PDF estilo documentação técnica respondendo às 6 seções do prompt, **baseado apenas no que existe no código/migrations/memórias** (não em promessas). Salvar em `/mnt/documents/OPERA_Atlas_Diagnostico_Objetivo.pdf`.

## Fonte da verdade (verificável no repo)

- `.lovable/OPERA_CORE.md` + `.lovable/memory/architecture/*` (invariantes, período, causalidade)
- `.lovable/memory/features/csv-export.md` → export-csv edge function existe
- `.lovable/memory/security/rls-access-validation.md` → RLS hardening aplicado
- `supabase/functions/export-csv/index.ts` → exportação implementada
- Tabelas `periodos_fechados`, `periodos_reaberturas`, `cronograma_baseline`, `system_events`, `audit_logs_db` existem
- Ausência de: integração Copiloto (nenhum arquivo/edge function referenciando), testes de hash em cenário real, provas jurídicas.

## Estrutura do PDF

1. **Capa** — Título, data (06/07/2026), versão OPERA_CORE v1.3, tag "Diagnóstico Objetivo — evidence-based"
2. **Legenda de status** — ✅ Implementado e verificável | 🟡 Parcial / não testado em produção | ❌ Não iniciado
3. **§1 O que já está construído** — tabela item × status × evidência (arquivo/migration/memória)
   - Baseline `cronograma_baseline` → 🟡 tabela existe, sem prova de uso em obra real
   - Fechamento SHA-256 (`periodos_fechados.hash_snapshot`) → 🟡 estrutura pronta, não validado
   - Exportação CSV → ✅ edge `export-csv` + UI `ExportarDadosTab`
   - Integração Copiloto → ❌ nenhum artefato encontrado
   - RLS multi-tenant → ✅ ativo (memória rls-access-validation), 🟡 sem teste cross-tenant automatizado
   - Invariantes I1/I2/I4/I9/I11 → ✅ codificadas em RLS + funções SECURITY DEFINER + append-only em system_events
4. **§2 Em construção** — apontamento de diárias, bulk delete presenças (recém-feitos), capacidade/planejamento (memória), Gantt
5. **§3 Faltando para MVP** — bullets curtos por área (Copiloto, hash, CSV completo, prova jurídica, docs)
6. **§4 Riscos & débito técnico** — bundle sem lazy-loading, 15 queries no dashboard, hash não testado, ausência de testes automatizados de tenant isolation, sem monitoramento de erros
7. **§5 Próximo passo (7 dias)** — sequência crítica: (a) rodar 1 fechamento real com hash, (b) validar CSV em tenant piloto, (c) definir contrato de dados Copiloto→Atlas
8. **§6 Critério de prontidão para venda** — veredicto: **Não vendável autônomo hoje**. Estimativa: 4–6 semanas condicionado a Copiloto + fechamento validado + 1 caso jurídico simulado.
9. **Anexo A — Matriz-resumo** (igual ao "exemplo de resposta esperada" do usuário, atualizado com evidência real)
10. **Anexo B — Referências no repositório** (lista de arquivos citados)

## Detalhes técnicos de geração

- Python + `reportlab` (Platypus): `SimpleDocTemplate` A4, margens 2cm.
- Estilo: cabeçalho laranja (#F97316) coerente com tema Atlas; corpo Helvetica 10pt; tabelas com `Paragraph` em cada célula (wrap automático) e cabeçalho cinza-escuro texto branco.
- Sem caracteres Unicode subscript/superscript.
- Diagramas: nenhum necessário nesta versão (documento é textual/tabular).
- QA obrigatório: `pdftoppm -jpeg -r 150` → `code--view` de cada página, corrigir overflow/alinhamento antes de finalizar.

## Fora de escopo

- Não alterar código de aplicação.
- Não implementar Copiloto/fechamento/testes — apenas relatar status.
- Não gerar versão executiva/comercial separada (só o diagnóstico técnico pedido).

## Entregável

Um arquivo: `/mnt/documents/OPERA_Atlas_Diagnostico_Objetivo.pdf` (~6–10 páginas).
