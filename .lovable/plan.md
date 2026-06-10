# Plano: PDF "OPERA Atlas – Mapeamento Funcional para Migração"

## Entrega
Arquivo único: `/mnt/documents/OPERA_Atlas_Mapeamento_Migracao_v1.pdf`
Auto-contido, ~10–14 páginas, gerado via ReportLab (Platypus), capa preto/laranja alinhada à identidade Atlas, com QA visual (`pdftoppm -r 150`) em todas as páginas antes da entrega.

## Estrutura do documento

**Capa** — título, subtítulo "Escopo restrito: Atlas + QFD-OS + Direcione", versão, data, aviso de confidencialidade técnica.

**Sumário Executivo** (1 pág) — o que está e o que NÃO está no escopo desta migração (exclui Smart Cotações, Vaga Quente, Stockflow), e as 11 invariantes OPERA_CORE como contrato não-negociável.

**Parte I — Mapeamento dos 3 Motores**

Para cada motor (Atlas, QFD-OS, Direcione), uma ficha padronizada de ~2 páginas:
- Problema que resolve (1 frase)
- Informações que consome (tabela: fonte → tipo de dado)
- Informações que produz (tabela: saída → consumidor)
- Regras de negócio críticas com **invariantes I1/I2/I4/I9/I11 em negrito** quando aplicáveis
- Dependência do OPERA Core (Alta/Média/Baixa) com justificativa
- Risco de impacto na migração (cenário "se este motor cair")
- Domínio de UI relacionado (mapeando às abas Organização, Padronização, Eficiência, Redução de Perdas, Análise Contínua, Segurança & Qualidade, Ações Corretivas)

**Parte II — Síntese de Migração**
- Tabela-resumo: Motor × Dependência × Risco × Ordem sugerida × Pré-requisitos técnicos
- **Recomendação de ordem**: Atlas (core) → QFD-OS (consumidor de baseline) → Direcione (orquestrador, integração futura preservada)
- Justificativa por acoplamento: Atlas é fonte de verdade; QFD-OS depende do baseline; Direcione hoje é independente mas a interface de marcos/alertas deve ser preservada.

**Parte III — Análise Sistêmica (resposta à segunda parte do prompt)**

Bloco único intitulado "OPERA Atlas como Estrutura Empresarial":
1. **Conceito e proposta de valor** — livro-razão imutável da operação física; transforma execução de obra em evidência auditável.
2. **Direção estratégica** — camada de verdade do ecossistema Canteiro de Obras Digital; condição para qualquer motor downstream (BI, IA, cotações inteligentes) ter dado confiável.
3. **Objetivos mensuráveis** — KPIs: % de períodos fechados sem reabertura, tempo médio entre evento e auditoria, taxa de divergência QFD-OS, determinismo financeiro (hash estável).
4. **Processos operacionais** — ciclo Registrar → Fechar → Rastrear → Corrigir → Refechar.
5. **Critérios de decisão** — as 11 invariantes como filtros de aceitação de qualquer feature.
6. **Pontos de integração** — header `x-correlation-id`, RPCs SECURITY DEFINER, eventos `system_events` como contrato com motores externos.
7. **Potencial de escala, automação e monetização** — multi-tenant nativo, eventos causais habilitam IA preditiva, fechamentos imutáveis viabilizam produto B2B de evidência jurídica/seguros.

**Apêndices**
- A. Glossário (invariantes, snapshot, hash imortal, correlation/causation)
- B. Checklist de migração mínima por motor

## Detalhes técnicos
- Script Python isolado em `/tmp/build_mapeamento.py`, ReportLab Platypus.
- Tipografia: Helvetica; títulos em laranja `#F97316`, corpo preto.
- Tabelas com `colWidths` explícitos para evitar overflow; quebras de linha controladas em `Paragraph`.
- QA: converter cada página em JPG, inspecionar e iterar até zero defeitos visuais (overflow, sobreposição, cortes).
- Sem alterações de código da aplicação. Sem segredos. Sem dependência de assets externos.

## Fora de escopo
- Não gera versões para os motores não listados (Smart Cotações, Vaga Quente, Stockflow).
- Não modifica nenhum arquivo do projeto.
- Não publica nem expõe URLs internas ou IDs de backend.
