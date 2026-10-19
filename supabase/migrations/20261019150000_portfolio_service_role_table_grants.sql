-- Restore explicit server-side access to the ten portfolio tables created in
-- 20260803223000_create_portfolio_commercial_domain.sql.
-- This migration is a repository-only candidate; do not apply to hosted Lovable DB
-- without schema inspection, review and explicit approval.
-- It does not disable RLS or grant privileges to anon/authenticated.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.portfolio_companies,
  public.portfolio_leads,
  public.portfolio_products,
  public.portfolio_product_versions,
  public.portfolio_offers,
  public.portfolio_diagnoses,
  public.portfolio_interests,
  public.portfolio_events,
  public.portfolio_interest_history,
  public.portfolio_daily_metrics
TO service_role;
