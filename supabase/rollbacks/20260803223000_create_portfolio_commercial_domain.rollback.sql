-- Executar somente em rollback aprovado e após preservar/exportar dados comerciais.
-- Ordem: policies/triggers -> funções -> tabelas dependentes -> tabelas-base.

DROP TRIGGER IF EXISTS portfolio_20_archive_interest_revision ON public.portfolio_interests;
DROP TRIGGER IF EXISTS portfolio_10_preserve_funnel_progress ON public.portfolio_interests;

DROP FUNCTION IF EXISTS public.archive_portfolio_interest_revision();
DROP FUNCTION IF EXISTS public.preserve_portfolio_funnel_progress();
DROP FUNCTION IF EXISTS public.get_portfolio_public_metrics();

DROP TABLE IF EXISTS public.portfolio_daily_metrics;
DROP TABLE IF EXISTS public.portfolio_interest_history;
DROP TABLE IF EXISTS public.portfolio_events;
DROP TABLE IF EXISTS public.portfolio_interests;
DROP TABLE IF EXISTS public.portfolio_diagnoses;
DROP TABLE IF EXISTS public.portfolio_offers;
DROP TABLE IF EXISTS public.portfolio_product_versions;
DROP TABLE IF EXISTS public.portfolio_products;
DROP TABLE IF EXISTS public.portfolio_leads;
DROP TABLE IF EXISTS public.portfolio_companies;
