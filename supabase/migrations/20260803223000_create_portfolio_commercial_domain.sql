-- Domínio comercial do portfólio O.P.E.R.A.
-- Isolado das entidades operacionais do Atlas pelo prefixo portfolio_.

CREATE TABLE public.portfolio_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_normalized text NOT NULL,
  cnpj_normalized text,
  cidade text,
  uf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_companies_nome_check CHECK (char_length(nome) BETWEEN 2 AND 140),
  CONSTRAINT portfolio_companies_cnpj_check CHECK (cnpj_normalized IS NULL OR cnpj_normalized ~ '^[0-9]{14}$'),
  CONSTRAINT portfolio_companies_uf_check CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$')
);
CREATE UNIQUE INDEX portfolio_companies_cnpj_unique ON public.portfolio_companies(cnpj_normalized)
  WHERE cnpj_normalized IS NOT NULL;

CREATE TABLE public.portfolio_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.portfolio_companies(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  telefone text,
  telefone_normalized text,
  cidade text,
  uf text,
  origem text NOT NULL DEFAULT 'portfolio_site',
  consentimento boolean NOT NULL,
  consentimento_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_leads_nome_check CHECK (char_length(nome) BETWEEN 2 AND 100),
  CONSTRAINT portfolio_leads_email_check CHECK (char_length(email_normalized) BETWEEN 5 AND 255),
  CONSTRAINT portfolio_leads_phone_check CHECK (telefone_normalized IS NULL OR telefone_normalized ~ '^[0-9]{10,13}$'),
  CONSTRAINT portfolio_leads_uf_check CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  CONSTRAINT portfolio_leads_consent_check CHECK (consentimento = true)
);
CREATE INDEX portfolio_leads_phone_lookup ON public.portfolio_leads(telefone_normalized)
  WHERE telefone_normalized IS NOT NULL;

CREATE TABLE public.portfolio_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  modulo smallint NOT NULL CHECK (modulo BETWEEN 0 AND 3),
  maturity_level text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_products_maturity_check CHECK (maturity_level IN ('beta','piloto','validacao','producao')),
  CONSTRAINT portfolio_products_status_check CHECK (status IN ('ativo','pausado','arquivado'))
);

CREATE TABLE public.portfolio_product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.portfolio_products(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  titulo text NOT NULL,
  descricao text,
  maturity_level text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, version),
  CONSTRAINT portfolio_product_versions_maturity_check CHECK (maturity_level IN ('beta','piloto','validacao','producao')),
  CONSTRAINT portfolio_product_versions_period_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE UNIQUE INDEX portfolio_product_versions_one_current
  ON public.portfolio_product_versions(product_id) WHERE is_current;

CREATE TABLE public.portfolio_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES public.portfolio_product_versions(id) ON DELETE RESTRICT,
  offer_type text NOT NULL,
  titulo text NOT NULL,
  amount_min numeric(12,2),
  amount_max numeric(12,2),
  moeda char(3) NOT NULL DEFAULT 'BRL',
  recorrencia text NOT NULL DEFAULT 'unico',
  price_label text NOT NULL,
  performance_percent numeric(5,2),
  ativo boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_offers_type_check CHECK (offer_type IN ('analise','implantacao','setup','mensalidade','piloto','performance','sob_proposta')),
  CONSTRAINT portfolio_offers_recurrence_check CHECK (recorrencia IN ('unico','mensal','por_obra','variavel','sob_proposta')),
  CONSTRAINT portfolio_offers_amount_check CHECK (amount_min IS NULL OR amount_min >= 0),
  CONSTRAINT portfolio_offers_range_check CHECK (amount_max IS NULL OR amount_min IS NULL OR amount_max >= amount_min),
  CONSTRAINT portfolio_offers_performance_check CHECK (performance_percent IS NULL OR performance_percent BETWEEN 0 AND 100),
  CONSTRAINT portfolio_offers_period_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE public.portfolio_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.portfolio_leads(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  custo_score smallint NOT NULL CHECK (custo_score BETWEEN 0 AND 2),
  prazo_score smallint NOT NULL CHECK (prazo_score BETWEEN 0 AND 2),
  execucao_score smallint NOT NULL CHECK (execucao_score BETWEEN 0 AND 2),
  controle_score smallint NOT NULL CHECK (controle_score BETWEEN 0 AND 2),
  risco_score smallint NOT NULL CHECK (risco_score BETWEEN 0 AND 2),
  score smallint GENERATED ALWAYS AS (custo_score + prazo_score + execucao_score + controle_score + risco_score) STORED,
  classificacao text NOT NULL,
  resultado text NOT NULL,
  recomendacao text NOT NULL,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_diagnoses_classification_check CHECK (classificacao IN ('baixo','medio','alto'))
);

CREATE TABLE public.portfolio_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.portfolio_leads(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.portfolio_products(id) ON DELETE RESTRICT,
  diagnosis_id uuid REFERENCES public.portfolio_diagnoses(id) ON DELETE SET NULL,
  modalidade text NOT NULL,
  mensagem text,
  status text NOT NULL DEFAULT 'interesse',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, product_id),
  CONSTRAINT portfolio_interests_mode_check CHECK (modalidade IN ('interesse','solicitacao_diagnostico','solicitacao_proposta','lista_prioritaria')),
  CONSTRAINT portfolio_interests_status_check CHECK (status IN ('interesse','diagnostico','proposta','cliente','descartado'))
);

CREATE TABLE public.portfolio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  event_type text NOT NULL,
  product_id uuid REFERENCES public.portfolio_products(id) ON DELETE SET NULL,
  page_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portfolio_interest_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL REFERENCES public.portfolio_interests(id) ON DELETE RESTRICT,
  modalidade text NOT NULL,
  mensagem text,
  status text NOT NULL,
  diagnosis_id uuid REFERENCES public.portfolio_diagnoses(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portfolio_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  metric_name text NOT NULL,
  product_id uuid REFERENCES public.portfolio_products(id) ON DELETE SET NULL,
  metric_value bigint NOT NULL DEFAULT 0 CHECK (metric_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX portfolio_daily_metrics_unique
  ON public.portfolio_daily_metrics(metric_date, metric_name, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.portfolio_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_interest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_daily_metrics ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'portfolio_companies','portfolio_leads','portfolio_products','portfolio_product_versions',
    'portfolio_offers','portfolio_diagnoses','portfolio_interests','portfolio_events',
    'portfolio_interest_history','portfolio_daily_metrics'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY[''admin''::public.app_role]) OR public.is_super_admin(auth.uid()))',
      table_name || '_admin_select', table_name
    );
  END LOOP;
END $$;

CREATE POLICY portfolio_products_admin_insert ON public.portfolio_products FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));
CREATE POLICY portfolio_products_admin_update ON public.portfolio_products FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));
CREATE POLICY portfolio_versions_admin_manage ON public.portfolio_product_versions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));
CREATE POLICY portfolio_offers_admin_manage ON public.portfolio_offers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));
CREATE POLICY portfolio_companies_admin_update ON public.portfolio_companies FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));
CREATE POLICY portfolio_leads_admin_update ON public.portfolio_leads FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));
CREATE POLICY portfolio_interests_admin_update ON public.portfolio_interests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role]) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.preserve_portfolio_funnel_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE old_rank integer; new_rank integer;
BEGIN
  IF auth.uid() IS NOT NULL AND (
    public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role])
    OR public.is_super_admin(auth.uid())
  ) THEN
    RETURN NEW;
  END IF;
  old_rank := CASE OLD.status WHEN 'interesse' THEN 1 WHEN 'diagnostico' THEN 2 WHEN 'proposta' THEN 3 WHEN 'cliente' THEN 4 ELSE 0 END;
  new_rank := CASE NEW.status WHEN 'interesse' THEN 1 WHEN 'diagnostico' THEN 2 WHEN 'proposta' THEN 3 WHEN 'cliente' THEN 4 ELSE 0 END;
  IF OLD.status <> 'descartado' AND NEW.status <> 'descartado' AND new_rank < old_rank THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER portfolio_10_preserve_funnel_progress
  BEFORE UPDATE OF status ON public.portfolio_interests
  FOR EACH ROW EXECUTE FUNCTION public.preserve_portfolio_funnel_progress();

CREATE OR REPLACE FUNCTION public.archive_portfolio_interest_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.portfolio_interest_history
    (interest_id, modalidade, mensagem, status, diagnosis_id, changed_at)
  VALUES
    (OLD.id, OLD.modalidade, OLD.mensagem, OLD.status, OLD.diagnosis_id, now());
  RETURN NEW;
END;
$$;
CREATE TRIGGER portfolio_20_archive_interest_revision
  BEFORE UPDATE ON public.portfolio_interests
  FOR EACH ROW
  WHEN (
    OLD.modalidade IS DISTINCT FROM NEW.modalidade
    OR OLD.mensagem IS DISTINCT FROM NEW.mensagem
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.diagnosis_id IS DISTINCT FROM NEW.diagnosis_id
  )
  EXECUTE FUNCTION public.archive_portfolio_interest_revision();
REVOKE ALL ON FUNCTION public.preserve_portfolio_funnel_progress() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_portfolio_interest_revision() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_portfolio_public_metrics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'interessados_total', COUNT(DISTINCT i.lead_id) FILTER (WHERE i.status <> 'descartado'),
    'diagnosticos_solicitados', COUNT(DISTINCT i.lead_id) FILTER (WHERE i.status IN ('diagnostico','proposta','cliente')),
    'propostas_solicitadas', COUNT(DISTINCT i.lead_id) FILTER (WHERE i.status IN ('proposta','cliente')),
    'clientes', COUNT(DISTINCT i.lead_id) FILTER (WHERE i.status = 'cliente'),
    'empresas_interessadas', COUNT(DISTINCT l.company_id) FILTER (WHERE l.company_id IS NOT NULL AND i.status <> 'descartado'),
    'produtos_selecionados', COUNT(*) FILTER (WHERE i.status <> 'descartado')
  )
  FROM public.portfolio_interests i
  JOIN public.portfolio_leads l ON l.id = i.lead_id;
$$;
REVOKE ALL ON FUNCTION public.get_portfolio_public_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_public_metrics() TO service_role;

INSERT INTO public.portfolio_products (slug,nome,modulo,maturity_level,status,ordem) VALUES
('diagnostico-opera','Diagnóstico O.P.E.R.A.',0,'producao','ativo',1),
('copiloto-obras','Copiloto de Obras',0,'piloto','ativo',2),
('opera-atlas','O.P.E.R.A. Atlas',0,'producao','ativo',3),
('opera-control','O.P.E.R.A. Control',0,'validacao','ativo',4),
('pedidos-cod','Pedidos COD',1,'validacao','ativo',5),('reo','REO',1,'piloto','ativo',6),
('stockflow','StockFlow',1,'validacao','ativo',7),('direcione','Direcione',2,'validacao','ativo',8),
('smart-cotacoes','Smart Cotações',2,'piloto','ativo',9),('gestao-os','Gestão de Ordem de Serviço',2,'piloto','ativo',10),
('pdic','PDIC',3,'validacao','ativo',11),('canteiro-crm','Canteiro CRM',3,'validacao','ativo',12);

INSERT INTO public.portfolio_product_versions (product_id,version,titulo,descricao,maturity_level,is_current)
SELECT id,1,nome,'Versão comercial inicial publicada no portfólio.',maturity_level,true FROM public.portfolio_products;

INSERT INTO public.portfolio_offers (product_version_id,offer_type,titulo,amount_min,amount_max,recorrencia,price_label,performance_percent)
SELECT v.id,'analise','Análise inicial',197,197,'unico','R$ 197',NULL FROM public.portfolio_product_versions v JOIN public.portfolio_products p ON p.id=v.product_id WHERE p.slug='diagnostico-opera'
UNION ALL SELECT v.id,'mensalidade','Operação por obra',2500,3500,'por_obra','R$ 2.500 a R$ 3.500/mês por obra',NULL FROM public.portfolio_product_versions v JOIN public.portfolio_products p ON p.id=v.product_id WHERE p.slug='copiloto-obras'
UNION ALL SELECT v.id,'setup','Setup Atlas',3500,8000,'unico','Setup de R$ 3.500 a R$ 8.000',NULL FROM public.portfolio_product_versions v JOIN public.portfolio_products p ON p.id=v.product_id WHERE p.slug='opera-atlas'
UNION ALL SELECT v.id,'mensalidade','Operação Atlas',2500,4500,'mensal','R$ 2.500 a R$ 4.500/mês',NULL FROM public.portfolio_product_versions v JOIN public.portfolio_products p ON p.id=v.product_id WHERE p.slug='opera-atlas'
UNION ALL SELECT v.id,'mensalidade','Operação Control',1500,3000,'mensal','R$ 1.500 a R$ 3.000/mês',NULL FROM public.portfolio_product_versions v JOIN public.portfolio_products p ON p.id=v.product_id WHERE p.slug='opera-control'
UNION ALL SELECT v.id,'performance','Performance elegível',NULL,NULL,'variavel','Até 20% da economia comprovada',20 FROM public.portfolio_product_versions v JOIN public.portfolio_products p ON p.id=v.product_id WHERE p.slug='opera-control';

REVOKE ALL ON public.portfolio_companies, public.portfolio_leads, public.portfolio_products,
  public.portfolio_product_versions, public.portfolio_offers, public.portfolio_diagnoses,
  public.portfolio_interests, public.portfolio_events, public.portfolio_interest_history,
  public.portfolio_daily_metrics FROM anon;
GRANT SELECT ON public.portfolio_companies, public.portfolio_leads, public.portfolio_products,
  public.portfolio_product_versions, public.portfolio_offers, public.portfolio_diagnoses,
  public.portfolio_interests, public.portfolio_events, public.portfolio_interest_history,
  public.portfolio_daily_metrics TO authenticated;
GRANT INSERT, UPDATE ON public.portfolio_products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portfolio_product_versions, public.portfolio_offers TO authenticated;
GRANT UPDATE ON public.portfolio_companies, public.portfolio_leads, public.portfolio_interests TO authenticated;
