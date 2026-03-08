import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportData {
  obraNome: string;
  responsavel: string;
  data: string;
  registros: any[];
  consumo: any[];
  ativos: any[];
  riscos: any[];
  retrabalhos: any[];
  lancamentos: any[];
  incidentes: any[];
  logistica?: any[];
  ciclos?: any[];
  aditivos?: any[];
}

export function exportOperaReport(data: ReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const checkPage = (needed = 40) => {
    if (y > 280 - needed) { doc.addPage(); y = 20; }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO OPERACIONAL O.P.E.R.A.", 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Obra: ${data.obraNome}`, 14, y);
  doc.text(`Data: ${data.data}`, pageWidth - 60, y);
  y += 6;
  doc.text(`Responsável: ${data.responsavel}`, 14, y);
  y += 4;

  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // ── 1. Organização ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("1. Organização — Mão de Obra", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const okCount = data.registros.filter((r) => r.status === "ok").length;
  doc.text(`Total registros: ${data.registros.length}  |  Status OK: ${okCount}  |  Alertas: ${data.registros.length - okCount}`, 14, y);
  y += 4;

  if (data.registros.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Nome", "Atividade", "Produção", "Status", "Data"]],
      body: data.registros.slice(0, 15).map((r) => [
        r.nome, r.atividade || "—", r.producao || "—", r.status, r.data_registro,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y += 6;
  }

  // ── 2. Padronização ──
  checkPage();
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("2. Padronização — Insumos", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const despTotal = data.consumo.length > 0
    ? data.consumo.reduce((a, m) => a + (m.previsto > 0 ? ((m.real_consumo - m.previsto) / m.previsto) * 100 : 0), 0) / data.consumo.length
    : 0;
  doc.text(`Materiais: ${data.consumo.length}  |  Desperdício médio: ${despTotal.toFixed(1)}%`, 14, y);
  y += 4;

  if (data.consumo.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Material", "Previsto", "Real", "Unidade", "Desp. %"]],
      body: data.consumo.slice(0, 10).map((m) => [
        m.material, m.previsto, m.real_consumo, m.unidade,
        m.previsto > 0 ? `${(((m.real_consumo - m.previsto) / m.previsto) * 100).toFixed(1)}%` : "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y += 6;
  }

  // ── 3. Eficiência — Ativos ──
  checkPage();
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("3. Eficiência — Ativos", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const ociosos = data.ativos.filter((a) => a.status === "ocioso");
  const ociosoValor = ociosos.reduce((s, a) => s + Number(a.valor), 0);
  doc.text(`Ativos: ${data.ativos.length}  |  Ociosos: ${ociosos.length} (R$ ${ociosoValor.toLocaleString("pt-BR")})`, 14, y);
  y += 4;

  if (data.ativos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Equipamento", "Local", "Valor (R$)", "Status"]],
      body: data.ativos.map((a) => [a.nome, a.local_atual || "—", Number(a.valor).toLocaleString("pt-BR"), a.status]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y += 6;
  }

  // ── 3b. Eficiência — Logística Interna ──
  const logistica = data.logistica || [];
  if (logistica.length > 0) {
    checkPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3b. Logística Interna", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const avgDeslocamento = logistica.reduce((s, l) => s + Number(l.tempo_deslocamento_min || 0), 0) / logistica.length;
    doc.text(`Registros: ${logistica.length}  |  Tempo médio de deslocamento: ${avgDeslocamento.toFixed(0)} min`, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Equipe", "Origem", "Destino", "Tempo (min)", "Data"]],
      body: logistica.slice(0, 10).map((l) => [
        l.equipe, l.origem || "—", l.destino || "—", l.tempo_deslocamento_min, l.data_registro,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 3c. Eficiência — Ciclos de Tarefa ──
  const ciclos = data.ciclos || [];
  if (ciclos.length > 0) {
    checkPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3c. Ciclos de Tarefa", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const avgDesvio = ciclos.reduce((s, c) => {
      const alvo = Number(c.tempo_alvo_min || 0);
      const real = Number(c.tempo_medio_min || 0);
      return s + (alvo > 0 ? ((real - alvo) / alvo) * 100 : 0);
    }, 0) / ciclos.length;
    doc.text(`Tarefas monitoradas: ${ciclos.length}  |  Desvio médio: ${avgDesvio.toFixed(1)}%`, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Tarefa", "Alvo (min)", "Médio (min)", "Desvio %", "Medições"]],
      body: ciclos.slice(0, 10).map((c) => {
        const alvo = Number(c.tempo_alvo_min || 0);
        const real = Number(c.tempo_medio_min || 0);
        const desvio = alvo > 0 ? (((real - alvo) / alvo) * 100).toFixed(1) + "%" : "—";
        return [c.tarefa, alvo, real, desvio, c.qtd_medicoes];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 4. Redução de Perdas ──
  checkPage();
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("4. Redução de Perdas", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const totalRet = data.retrabalhos.reduce((s, r) => s + r.quantidade, 0);
  doc.text(`Riscos ativos: ${data.riscos.length}  |  Retrabalhos: ${totalRet}`, 14, y);
  y += 4;

  if (data.riscos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Risco", "Severidade", "Impacto"]],
      body: data.riscos.map((r) => [r.risco, r.severidade, r.impacto || "—"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y += 6;
  }

  // ── 5. Financeiro ──
  checkPage();
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("5. Análise Contínua — Financeiro", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const receitas = data.lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const custos = data.lancamentos.filter((l) => l.tipo === "custo").reduce((s, l) => s + Number(l.valor), 0);
  const saldo = receitas - custos;
  const margem = receitas > 0 ? ((saldo / receitas) * 100) : 0;

  doc.text(`Receitas: R$ ${receitas.toLocaleString("pt-BR")}  |  Custos: R$ ${custos.toLocaleString("pt-BR")}`, 14, y);
  y += 5;
  doc.text(`Saldo: R$ ${saldo.toLocaleString("pt-BR")}  |  Margem: ${margem.toFixed(1)}%`, 14, y);
  y += 8;

  // ── 5b. Aditivos Contratuais ──
  const aditivos = data.aditivos || [];
  if (aditivos.length > 0) {
    checkPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("5b. Aditivos Contratuais", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const totalAditivos = aditivos.reduce((s, a) => s + Number(a.valor || 0), 0);
    const aprovados = aditivos.filter((a) => a.aprovado).length;
    doc.text(`Total aditivos: ${aditivos.length}  |  Aprovados: ${aprovados}  |  Valor total: R$ ${totalAditivos.toLocaleString("pt-BR")}`, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Tipo", "Valor (R$)", "Aprovado", "Data"]],
      body: aditivos.slice(0, 10).map((a) => [
        a.descricao, a.tipo, Number(a.valor).toLocaleString("pt-BR"),
        a.aprovado ? "Sim" : "Não", a.data,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 6. Segurança ──
  checkPage();
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("6. Segurança & Qualidade", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const acidentes = data.incidentes.filter((i) => i.tipo === "acidente");
  const ncAbertas = data.incidentes.filter((i) => i.tipo === "nc" && i.status === "aberto").length;
  const inspecoes = data.incidentes.filter((i) => i.tipo === "inspecao");
  const aprovadas = inspecoes.filter((i) => i.status === "aprovado").length;
  const lastAcidente = acidentes.sort((a, b) => b.data.localeCompare(a.data))[0];
  const dias = lastAcidente
    ? Math.floor((Date.now() - new Date(lastAcidente.data).getTime()) / (1000 * 60 * 60 * 24))
    : data.incidentes.length > 0 ? 999 : 0;

  doc.text(`Dias sem acidente: ${dias}  |  NC abertas: ${ncAbertas}  |  Inspeções aprovadas: ${aprovadas}/${inspecoes.length}`, 14, y);
  y += 10;

  // Footer
  checkPage(20);
  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Relatório gerado automaticamente pelo Sistema O.P.E.R.A. em ${new Date().toLocaleString("pt-BR")}`, 14, y);

  doc.save(`relatorio-opera-${data.data}.pdf`);
}
