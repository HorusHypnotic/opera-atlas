## Mudanças solicitadas

### 1) Novo Apontamento de Diárias — quantidade padrão "0"

Arquivo: `src/pages/RelatorioMaoObraPage.tsx`

- Em `openNewDialog()` (linha 332): trocar `setFormQtdDiarias("")` por `setFormQtdDiarias("0")`, para que ao abrir o diálogo "Novo Apontamento" o campo "Quantidade de Diárias" já apareça preenchido com `0` (em vez de vazio).
- Ajustar a validação em `handleSave()` (linha 362): hoje ela bloqueia se `!formQtdDiarias`, o que rejeitaria o valor `"0"`. Trocar por uma checagem numérica que só barra valores inválidos / negativos, permitindo `0` como rascunho mas exigindo `> 0` no momento de salvar (mensagem: "Informe uma quantidade de diárias maior que zero").
- O fluxo de edição (`openEditDialog`) continua usando o valor real do registro — sem mudança.

### 2) Exclusão em lote de Presenças & Faltas

Arquivo: `src/pages/ColaboradoresPage.tsx` (aba "Presenças & Faltas", linhas 257–327)

UI:
- Adicionar uma coluna de checkbox como primeira coluna da tabela.
- Cabeçalho com checkbox "selecionar todos os registros visíveis".
- Barra de ação acima da tabela aparecendo apenas quando há seleção: mostra "N selecionados" + botão "Excluir selecionados" (destrutivo) + "Limpar seleção".
- Confirmação forte usando `ConfirmDialog` (já existe em `src/components/admin/ConfirmDialog.tsx`): exige digitar `EXCLUIR` para confirmar, descrição lista a quantidade de registros e avisa que a ação é irreversível.

Lógica:
- Estado local `selectedIds: Set<string>` na aba.
- Toggle por linha; "selecionar todos" marca/desmarca todos os `presencas` atualmente renderizados.
- Exclusão em lote: itera sobre `selectedIds` chamando `removePresenca(id)` (já disponível em `useTableData`); apenas usuários com `canDelete` veem os controles.
- Após sucesso: limpa seleção e mostra toast "N registros excluídos".
- Respeita RLS (cada delete passa pelas policies existentes em `registro_presencas`).

Fora de escopo (não pedido):
- Filtros adicionais por período/colaborador/tipo na própria aba.
- Bulk delete em outras tabelas (registros_diarios, apontamentos).
- Mudanças em RLS, migrations ou edge functions.

### Arquivos editados
- `src/pages/RelatorioMaoObraPage.tsx`
- `src/pages/ColaboradoresPage.tsx`
