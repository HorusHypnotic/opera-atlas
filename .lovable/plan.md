# PDF v2 — OPERA Atlas: Modelo Empresarial, Governança LGPD e Ecossistema

Manter o PDF v1 (técnico/migração) e gerar um **novo documento complementar** que cobre as 8 lacunas apontadas. Sem mudanças no código do app — apenas script Python + ReportLab gravando em `/mnt/documents/`.

## Entregável

`OPERA_Atlas_Modelo_Empresarial_v2.pdf` (~14–18 páginas), estruturado para 4 audiências: arquiteto, investidor, jurídico/DPO, cliente corporativo.

## Estrutura do documento

**1. Sumário Executivo (1 pág)**
Para quem é cada seção; relação com o v1 (Mapeamento de Migração).

**2. Modelo Canônico de Stakeholders (2 pág)**
Árvore Tenant → (Cliente Final, Construtora, Empreiteira, Fornecedor, Prestador, Equipe OPERA).
Árvore Obra → (Contratos, Equipes, Colaboradores, Terceirizados, Fornecedores, Equipamentos, Insumos, Evidências).
Diagrama ASCII + tabela com cardinalidade, dono do dado, e impacto em RLS.

**3. Hierarquia Organizacional (1 pág)**
Dois cenários canônicos:
- Grupo → Construtora → Filial → Obra
- Cliente → Empreiteira → Obra

Mapeamento para o conceito atual de `tenant` + plano de evolução (sub-tenants / hierarquia em fase futura).

**4. Modelo de Entidades Empresariais (2 pág)**
Modelo canônico compartilhável entre Atlas, Control, Stockflow, Smart Cotações, PDIC:
Organização, Contrato, Cliente, Obra, Etapa, Equipe, Colaborador, Fornecedor, Equipamento.
Tabela: entidade × produto que consome × produto que produz.

**5. Matriz Formal de Permissões (2 pág)**
Expandir I6 em matriz explícita:

```
Papel          | Ver           | Editar | Aprovar | Fechar | Reabrir
Operador       | Próprios      | Não    | Não     | Não    | Não
Encarregado    | Equipe        | Sim    | Não     | Não    | Não
Engenheiro    | Obra          | Sim    | Sim     | Não    | Não
Gestor         | Múlt. obras   | Sim    | Sim     | Sim    | Sim
Admin Tenant   | Tudo (tenant) | Sim    | Sim     | Sim    | Sim
Admin OPERA    | Suporte       | Restr. | Restr.  | Não    | Não
```

Cruzamento com roles atuais (admin/gestor/operacional/visualizador/super_admin) + gap a fechar.

**6. Governança LGPD (3 pág)**
Mapa de papéis LGPD:
- Titular (colaborador, gestor, etc.)
- Controlador (Construtora/Tenant)
- Operador (OPERA Atlas Ltda)
- Suboperador (Lovable Cloud, Supabase)
- Encarregado/DPO
- Base legal por finalidade (execução de contrato, obrigação legal trabalhista, legítimo interesse, consentimento)

Tabela RoPA mínima (Registro de Operações de Tratamento) com finalidade, base legal, retenção, transferência.
Direitos do titular: como o sistema atende (export CSV, soft delete, audit_logs).
Plano de DPA (Data Processing Agreement) entre OPERA e tenants.

**7. Classificação de Dados (1 pág)**
Tabela canônica por tabela/coluna:

```
Dado                | Classe        | Tabela
Nome colaborador    | Confidencial  | colaboradores.nome
CPF                 | Sensível/PII  | colaboradores.cpf
Salário/diária      | Sensível      | colaboradores.valor_diaria
Cronograma          | Interno       | atividades
Fotos da obra       | Interno       | obra-fotos
Logs de auditoria   | Confidencial  | audit_logs
Eventos sistema     | Interno       | system_events
```

Mapa para DLP/Purview futuro + regras de mascaramento sugeridas.

**8. Modelo de Eventos Humanos (1 pág)**
Cadeia Pessoa → Ação → Evento → Consequência, mapeada para `system_events` + `causation_id`. Exemplos: confirmação de presença → folha; reabertura de período → nova versão de hash.
Como isso vira **trilha explicável** em auditoria.

**9. Mapa do Ecossistema OPERA (2 pág)**
Diagrama empresarial dos produtos e seus fluxos:

```
                 PDIC (BI Estratégico)
                       ↑
              ┌────────┴────────┐
              │   Power BI       │
              └────────┬────────┘
                       ↑
   ┌──────────┬────────┴────────┬──────────┐
   │  Atlas   │   QFD-OS         │ Direcione │
   │ (verdade)│   (qualidade)    │ (decisão) │
   └─────┬────┴────────┬─────────┴─────┬────┘
         ↑             ↑               ↑
     Stockflow    Smart Cotações   Vaga Quente
         ↑             ↑               ↑
              Control + Mobile (captura)
```

Para cada produto: papel, entrada esperada do Atlas, saída devolvida, contrato de evento.

**10. Roadmap de Maturidade Empresarial (1 pág)**
Onde estamos × onde precisamos chegar antes de: investidor, cliente enterprise, ISO 27001, certificação LGPD. Checklist priorizado.

**11. Anexos (1 pág)**
- Glossário (tenant, obra, controlador, operador, RoPA, DPA, RLS, hash imortal).
- Referência cruzada para v1 e para `OPERA_CORE.md`.

## Implementação técnica

- Script Python `/tmp/build_modelo_empresarial.py` usando ReportLab (mesma stack do v1).
- Tabelas com `LongTable`, quebras controladas, KeepTogether nos diagramas ASCII (fonte Courier).
- Paleta consistente com v1 (laranja `#F97316` para títulos, cinza neutro para corpo).
- QA visual: converter cada página para PNG e inspecionar antes de entregar.
- Output: `/mnt/documents/OPERA_Atlas_Modelo_Empresarial_v2.pdf` + `<presentation-artifact>`.

## Fora do escopo

- Alterações em código, schema ou RLS do app.
- Implementação real de sub-tenants / hierarquia organizacional.
- Geração de RoPA dinâmica a partir do banco (fica como sugestão de feature futura).
- Tradução para inglês.

## Pergunta antes de implementar

Algum dos pontos abaixo precisa de ajuste antes de eu gerar o PDF?
1. Manter foco nas **8 lacunas que você listou** ou quer adicionar/remover seções?
2. Documento deve assumir **OPERA como Operador LGPD** e Tenants (construtoras) como Controladores — confirma esse enquadramento?
3. Incluir os produtos **Stockflow, Smart Cotações, Vaga Quente, PDIC, Control** no mapa do ecossistema mesmo que ainda não existam no código, tratando-os como visão de produto?
