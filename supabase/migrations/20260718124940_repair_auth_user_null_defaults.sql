-- Supabase Auth expects state-token columns created through the Auth API to be
-- empty strings, not NULL. Older manual auth.users inserts can therefore make
-- every password sign-in for the affected record fail with HTTP 500:
-- "Database error querying schema".
--
-- This repair is deliberately non-destructive: it only fills missing defaults
-- and never changes emails, passwords, confirmation dates, IDs, or sessions.
do $repair_auth_users$
declare
  auth_column text;
begin
  foreach auth_column in array array[
    'confirmation_token',
    'recovery_token',
    'email_change_token_new',
    'email_change',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns as schema_column
      where schema_column.table_schema = 'auth'
        and schema_column.table_name = 'users'
        and schema_column.column_name = auth_column
    ) then
      execute format(
        'update auth.users set %1$I = '''' where %1$I is null',
        auth_column
      );
    end if;
  end loop;

  update auth.users
  set aud = coalesce(nullif(aud, ''), 'authenticated'),
      role = coalesce(nullif(role, ''), 'authenticated'),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
      is_super_admin = coalesce(is_super_admin, false);

  foreach auth_column in array array['is_sso_user', 'is_anonymous']
  loop
    if exists (
      select 1
      from information_schema.columns as schema_column
      where schema_column.table_schema = 'auth'
        and schema_column.table_name = 'users'
        and schema_column.column_name = auth_column
    ) then
      execute format(
        'update auth.users set %1$I = false where %1$I is null',
        auth_column
      );
    end if;
  end loop;
end
$repair_auth_users$;
