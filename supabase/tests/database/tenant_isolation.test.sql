begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into public.tenants (id, nome)
values
  ('10000000-0000-0000-0000-000000000001', 'Tenant Alpha'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant Beta');

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000011', 'admin-alpha@example.invalid'),
  ('20000000-0000-0000-0000-000000000022', 'admin-beta@example.invalid'),
  ('90000000-0000-0000-0000-000000000099', 'super-admin@example.invalid');

insert into public.profiles (id, email, full_name, tenant_id, is_super_admin)
values
  (
    '10000000-0000-0000-0000-000000000011',
    'admin-alpha@example.invalid',
    'Admin Alpha',
    '10000000-0000-0000-0000-000000000001',
    false
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    'admin-beta@example.invalid',
    'Admin Beta',
    '20000000-0000-0000-0000-000000000002',
    false
  ),
  (
    '90000000-0000-0000-0000-000000000099',
    'super-admin@example.invalid',
    'Super Admin',
    null,
    true
  )
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  tenant_id = excluded.tenant_id,
  is_super_admin = excluded.is_super_admin;

insert into public.user_roles (user_id, role, tenant_id)
values
  (
    '10000000-0000-0000-0000-000000000011',
    'admin',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    'admin',
    '20000000-0000-0000-0000-000000000002'
  );

insert into public.obras (id, tenant_id, nome)
values
  (
    '10000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
    'Obra Alpha'
  ),
  (
    '20000000-0000-0000-0000-000000000202',
    '20000000-0000-0000-0000-000000000002',
    'Obra Beta'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated","email":"admin-alpha@example.invalid"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000011',
  true
);

select is(
  (select count(*) from public.tenants),
  1::bigint,
  'admin Alpha sees only its tenant'
);
select is(
  (select count(*) from public.tenants where id = '20000000-0000-0000-0000-000000000002'),
  0::bigint,
  'admin Alpha cannot read tenant Beta'
);
select is(
  (select count(*) from public.obras),
  1::bigint,
  'admin Alpha sees only obras from tenant Alpha'
);
select is(
  (select count(*) from public.obras where id = '20000000-0000-0000-0000-000000000202'),
  0::bigint,
  'admin Alpha cannot read obra Beta'
);

select throws_ok(
  $$
    insert into public.obras (tenant_id, nome)
    values ('20000000-0000-0000-0000-000000000002', 'Cross-tenant insert')
  $$,
  '42501',
  null,
  'admin Alpha cannot insert an obra in tenant Beta'
);
select lives_ok(
  $$
    insert into public.obras (
      id,
      tenant_id,
      nome
    ) values (
      '10000000-0000-0000-0000-000000000102',
      '10000000-0000-0000-0000-000000000001',
      'Obra Alpha 2'
    )
  $$,
  'admin Alpha can insert an obra in tenant Alpha'
);
select is(
  (select count(*) from public.obras),
  2::bigint,
  'admin Alpha reads the newly inserted obra'
);

select results_eq(
  $$
    with changed as (
      update public.obras
      set nome = 'Cross-tenant update'
      where id = '20000000-0000-0000-0000-000000000202'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  array[0::bigint],
  'admin Alpha cannot update obra Beta'
);
select results_eq(
  $$
    with changed as (
      update public.obras
      set nome = 'Obra Alpha atualizada'
      where id = '10000000-0000-0000-0000-000000000101'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  array[1::bigint],
  'admin Alpha can update obra Alpha'
);
select results_eq(
  $$
    with removed as (
      delete from public.obras
      where id = '20000000-0000-0000-0000-000000000202'
      returning 1
    )
    select count(*)::bigint from removed
  $$,
  array[0::bigint],
  'admin Alpha cannot delete obra Beta'
);
select results_eq(
  $$
    with removed as (
      delete from public.obras
      where id = '10000000-0000-0000-0000-000000000102'
      returning 1
    )
    select count(*)::bigint from removed
  $$,
  array[1::bigint],
  'admin Alpha can delete obra Alpha'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000022","role":"authenticated","email":"admin-beta@example.invalid"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000022',
  true
);

select is(
  (select count(*) from public.obras where tenant_id = '10000000-0000-0000-0000-000000000001'),
  0::bigint,
  'admin Beta cannot read obras from tenant Alpha'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000099","role":"authenticated","email":"super-admin@example.invalid"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000099',
  true
);

select is(
  (select count(*) from public.tenants),
  2::bigint,
  'super-admin can read both tenants'
);
select is(
  (select count(*) from public.obras),
  2::bigint,
  'super-admin can read obras from both tenants'
);

select * from finish();
rollback;
