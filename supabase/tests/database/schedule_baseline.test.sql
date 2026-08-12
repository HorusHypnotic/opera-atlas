begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

insert into public.tenants (id, nome) values
  ('31000000-0000-0000-0000-000000000001', 'Baseline Alpha'),
  ('32000000-0000-0000-0000-000000000002', 'Baseline Beta');
insert into auth.users (id, email) values
  ('31000000-0000-0000-0000-000000000011', 'baseline-admin@example.invalid'),
  ('31000000-0000-0000-0000-000000000012', 'baseline-gestor@example.invalid'),
  ('32000000-0000-0000-0000-000000000022', 'baseline-beta@example.invalid');
insert into public.profiles (id, email, full_name, tenant_id, is_super_admin) values
  ('31000000-0000-0000-0000-000000000011', 'baseline-admin@example.invalid', 'Admin Baseline', '31000000-0000-0000-0000-000000000001', false),
  ('31000000-0000-0000-0000-000000000012', 'baseline-gestor@example.invalid', 'Gestor Baseline', '31000000-0000-0000-0000-000000000001', false),
  ('32000000-0000-0000-0000-000000000022', 'baseline-beta@example.invalid', 'Admin Beta', '32000000-0000-0000-0000-000000000002', false)
on conflict (id) do update set tenant_id = excluded.tenant_id, is_super_admin = false;
insert into public.user_roles (user_id, role, tenant_id) values
  ('31000000-0000-0000-0000-000000000011', 'admin', '31000000-0000-0000-0000-000000000001'),
  ('31000000-0000-0000-0000-000000000012', 'gestor', '31000000-0000-0000-0000-000000000001'),
  ('32000000-0000-0000-0000-000000000022', 'admin', '32000000-0000-0000-0000-000000000002');
insert into public.obras (id, tenant_id, nome) values
  ('31000000-0000-0000-0000-000000000101', '31000000-0000-0000-0000-000000000001', 'Obra Baseline Alpha'),
  ('32000000-0000-0000-0000-000000000202', '32000000-0000-0000-0000-000000000002', 'Obra Baseline Beta');
insert into public.atividades (id, tenant_id, obra_id, nome, data_inicio, data_fim, ordem, responsavel) values
  ('31000000-0000-0000-0000-000000000302', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000101', 'Segunda', '2026-09-03', '2026-09-05', 2, null),
  ('31000000-0000-0000-0000-000000000301', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000101', 'Primeira', '2026-09-01', '2026-09-02', 1, 'Equipe A');
insert into public.atividade_dependencias
  (id, tenant_id, obra_id, predecessora_id, sucessora_id, tipo, lag_dias) values
  ('31000000-0000-0000-0000-000000000401', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000101', '31000000-0000-0000-0000-000000000301', '31000000-0000-0000-0000-000000000302', 'FS', 0);

select is(
  public.hash_cronograma_snapshot(public.build_cronograma_snapshot('31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000101')),
  public.hash_cronograma_snapshot(public.build_cronograma_snapshot('31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000101')),
  'same schedule snapshot produces the same hash'
);
select is(
  public.hash_cronograma_snapshot('{"b":2,"a":1}'::jsonb),
  public.hash_cronograma_snapshot('{"a":1,"b":2}'::jsonb),
  'JSON property order does not change the hash'
);
select is(
  public.build_cronograma_snapshot('31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000101')->'atividades'->0->>'id',
  '31000000-0000-0000-0000-000000000301',
  'database insertion order does not affect canonical activity ordering'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000011","role":"authenticated"}', true);
select lives_ok(
  $$select public.aprovar_baseline_cronograma('31000000-0000-0000-0000-000000000101')$$,
  'contextual admin approves the first baseline'
);
select is((select max(versao) from public.listar_baselines_cronograma('31000000-0000-0000-0000-000000000101')), 1, 'first approval is version 1');
select lives_ok(
  $$select public.aprovar_baseline_cronograma('31000000-0000-0000-0000-000000000101', 'Nova aprovação')$$,
  'second approval creates another baseline'
);
select is((select max(versao) from public.listar_baselines_cronograma('31000000-0000-0000-0000-000000000101')), 2, 'second approval is version 2');
select is((select count(*) from public.listar_baselines_cronograma('31000000-0000-0000-0000-000000000101')), 2::bigint, 'previous version remains preserved');
select is((select count(*) from public.listar_baselines_cronograma('31000000-0000-0000-0000-000000000101') where vigente), 1::bigint, 'exactly one version is current');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000012', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000012","role":"authenticated"}', true);
select throws_ok(
  $$select public.aprovar_baseline_cronograma('31000000-0000-0000-0000-000000000101')$$,
  '42501', null, 'non-admin cannot approve a baseline'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000022', true);
select set_config('request.jwt.claims', '{"sub":"32000000-0000-0000-0000-000000000022","role":"authenticated"}', true);
select throws_ok(
  $$select public.listar_baselines_cronograma('31000000-0000-0000-0000-000000000101')$$,
  '42501', null, 'cross-tenant user cannot list baselines'
);
select throws_ok(
  $$select public.aprovar_baseline_cronograma('31000000-0000-0000-0000-000000000101')$$,
  '42501', null, 'cross-tenant admin cannot approve a baseline'
);

reset role;
select throws_ok(
  $$update public.cronograma_baseline set motivo = 'tentativa' where obra_id = '31000000-0000-0000-0000-000000000101'$$,
  '55000', null, 'approved baseline cannot be updated even by table owner'
);
select throws_ok(
  $$delete from public.cronograma_baseline where obra_id = '31000000-0000-0000-0000-000000000101'$$,
  '55000', null, 'approved baseline cannot be deleted even by table owner'
);

select * from finish();
rollback;
