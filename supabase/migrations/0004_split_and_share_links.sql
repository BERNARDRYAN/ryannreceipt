-- RyannReceipt 0004: room for split bills, and view-only share links.
-- Safe to re-run.

-- ============================================================================
-- 1. Split bills live in receipt_items.meta; allow it to grow.
-- ============================================================================
alter table public.receipt_items drop constraint if exists receipt_items_payload_size;
alter table public.receipt_items add constraint receipt_items_payload_size check (
  pg_column_size(items) <= 65536
  and pg_column_size(style_config) <= 196608
  and pg_column_size(meta) <= 65536
);

-- ============================================================================
-- 2. Share links: a frozen, view-only copy of one receipt behind a random token.
--    Owners manage their links through RLS. Anyone with the token can read
--    that one snapshot via get_receipt_share(); the table itself is never
--    readable by others, so links can't be listed or guessed in bulk.
-- ============================================================================
create table if not exists public.receipt_shares (
  token text primary key check (char_length(token) between 20 and 64),
  user_id uuid references auth.users(id) on delete cascade not null,
  receipt_id uuid not null,
  snapshot jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint receipt_shares_one_per_receipt unique (user_id, receipt_id),
  constraint receipt_shares_size check (pg_column_size(snapshot) <= 262144)
);

alter table public.receipt_shares enable row level security;

drop policy if exists "receipt_shares_select" on public.receipt_shares;
drop policy if exists "receipt_shares_insert" on public.receipt_shares;
drop policy if exists "receipt_shares_update" on public.receipt_shares;
drop policy if exists "receipt_shares_delete" on public.receipt_shares;

create policy "receipt_shares_select" on public.receipt_shares
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "receipt_shares_insert" on public.receipt_shares
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "receipt_shares_update" on public.receipt_shares
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "receipt_shares_delete" on public.receipt_shares
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.get_receipt_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select snapshot from public.receipt_shares where token = p_token;
$$;

revoke all on function public.get_receipt_share(text) from public;
grant execute on function public.get_receipt_share(text) to anon, authenticated;
