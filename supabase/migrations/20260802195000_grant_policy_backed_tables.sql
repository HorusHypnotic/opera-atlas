-- Reproduce the table privileges implied by the existing command-specific RLS
-- policies. RLS remains the row-level authority for authenticated requests.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.acoes_corretivas,
  public.aditivos_contratuais,
  public.apontamento_diarias,
  public.ativos,
  public.checklist_semanal,
  public.ciclos_tarefa,
  public.colaborador_obras,
  public.colaboradores,
  public.compras_emergenciais,
  public.consumo_materiais,
  public.incidentes_seguranca,
  public.influencer_codes,
  public.invites,
  public.lancamentos_financeiros,
  public.logistica_interna,
  public.lote_materiais,
  public.lotes_consumo,
  public.obra_membros,
  public.periodos_fechados,
  public.registro_presencas,
  public.registros_diarios,
  public.retrabalhos,
  public.riscos,
  public.sequenciamento_equipes,
  public.session_transfers
TO authenticated;

GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT ON TABLE public.audit_logs_db TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.beta_config TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.beta_waitlist TO authenticated;
GRANT UPDATE, DELETE ON TABLE public.cronograma_baseline TO authenticated;
GRANT SELECT, INSERT ON TABLE public.mobile_debug_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.periodos_reaberturas TO authenticated;
GRANT SELECT ON TABLE public.system_events TO authenticated;

GRANT ALL ON TABLE
  public.acoes_corretivas,
  public.aditivos_contratuais,
  public.apontamento_diarias,
  public.ativos,
  public.audit_logs,
  public.audit_logs_db,
  public.beta_config,
  public.beta_waitlist,
  public.checklist_semanal,
  public.ciclos_tarefa,
  public.colaborador_obras,
  public.colaboradores,
  public.compras_emergenciais,
  public.consumo_materiais,
  public.incidentes_seguranca,
  public.influencer_codes,
  public.invites,
  public.lancamentos_financeiros,
  public.logistica_interna,
  public.lote_materiais,
  public.lotes_consumo,
  public.mobile_debug_logs,
  public.obra_membros,
  public.periodos_fechados,
  public.registro_presencas,
  public.registros_diarios,
  public.retrabalhos,
  public.riscos,
  public.sequenciamento_equipes,
  public.session_transfers,
  public.system_events
TO service_role;
