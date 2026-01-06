-- set_user_password_rpc.sql
-- Supabase Postgres function to set a user's password (admin only)
-- This function should be called from the admin panel to set a new password for a user

create or replace function public.set_user_password(
  p_user_id uuid,
  p_new_password text
) returns void as $$
begin
  update public.users
  set password_hash = crypt(p_new_password, gen_salt('bf')),
      password_changed_at = now(),
      must_change_password = false
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Grant execute to service role (adjust as needed)
grant execute on function public.set_user_password(uuid, text) to anon, authenticated, service_role;
