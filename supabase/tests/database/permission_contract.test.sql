begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  0::bigint,
  'every public table has RLS enabled'
);

select is(
  (
    with policy_commands as (
      select p.tablename, expanded.cmd
      from pg_policies p
      cross join lateral unnest(
        case
          when p.cmd = 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]
          else array[p.cmd]::text[]
        end
      ) as expanded(cmd)
      where p.schemaname = 'public'
        and p.roles && array['public', 'authenticated']::name[]
    )
    select count(*)
    from (
      select distinct tablename, cmd
      from policy_commands
    ) expected
    where not has_table_privilege(
      'authenticated',
      format('public.%I', expected.tablename),
      expected.cmd
    )
  ),
  0::bigint,
  'authenticated has table privileges for every applicable RLS command'
);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not has_table_privilege(
        'service_role',
        c.oid,
        'SELECT,INSERT,UPDATE,DELETE'
      )
  ),
  0::bigint,
  'service_role can execute server-side operations on every public table'
);

select * from finish();
rollback;
