-- RyannReceipt initial schema (from ryannreceipt_specification.md §4).
-- All objects use the receipt_ prefix so they never collide with RyannPace / RyannPlan.

-- ============================================================================
-- 1. RECEIPT MAIN TABLE
-- ============================================================================
create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Receipt',
  merchant_name text not null,
  merchant_address text,
  merchant_phone text,
  receipt_no text,
  receipt_date timestamp with time zone default timezone('utc'::text, now()) not null,
  currency text not null default 'MYR',
  subtotal numeric(12, 2) not null default 0.00 check (subtotal >= 0),
  tax_rate numeric(5, 2) not null default 0.00 check (tax_rate >= 0),
  tax_amount numeric(12, 2) not null default 0.00 check (tax_amount >= 0),
  discount_amount numeric(12, 2) not null default 0.00 check (discount_amount >= 0),
  total numeric(12, 2) not null check (total >= 0),
  payment_method text not null default 'CASH',
  category text not null default 'General',
  notes text,
  barcode_data text,
  qr_data text,
  items jsonb not null default '[]'::jsonb,
  style_config jsonb not null default '{
    "width": "80mm",
    "fontFamily": "mono",
    "paperTheme": "clean",
    "showBarcode": true,
    "showQr": false,
    "tearEdge": true,
    "monochromeDither": false
  }'::jsonb,
  warranty_until date,
  is_pinned boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_receipt_items_user_id on public.receipt_items(user_id);
create index if not exists idx_receipt_items_receipt_date on public.receipt_items(receipt_date desc);
create index if not exists idx_receipt_items_warranty on public.receipt_items(warranty_until) where warranty_until is not null;

-- Keep updated_at current on every edit (not in the spec; prefixed to stay isolated).
create or replace function public.receipt_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists receipt_items_set_updated_at on public.receipt_items;
create trigger receipt_items_set_updated_at
  before update on public.receipt_items
  for each row execute function public.receipt_set_updated_at();

-- ============================================================================
-- 2. PRESET TEMPLATES TABLE
-- ============================================================================
create table if not exists public.receipt_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  merchant_name text,
  merchant_address text,
  currency text default 'MYR',
  style_config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_receipt_presets_user_id on public.receipt_presets(user_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.receipt_items enable row level security;
alter table public.receipt_presets enable row level security;

-- Dropped first so this script is safe to re-run.
drop policy if exists "receipt_items_select" on public.receipt_items;
drop policy if exists "receipt_items_insert" on public.receipt_items;
drop policy if exists "receipt_items_update" on public.receipt_items;
drop policy if exists "receipt_items_delete" on public.receipt_items;
drop policy if exists "receipt_presets_select" on public.receipt_presets;
drop policy if exists "receipt_presets_insert" on public.receipt_presets;
drop policy if exists "receipt_presets_update" on public.receipt_presets;
drop policy if exists "receipt_presets_delete" on public.receipt_presets;

create policy "receipt_items_select" on public.receipt_items
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "receipt_items_insert" on public.receipt_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- WITH CHECK stops a user from reassigning a row to someone else.
create policy "receipt_items_update" on public.receipt_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "receipt_items_delete" on public.receipt_items
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "receipt_presets_select" on public.receipt_presets
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "receipt_presets_insert" on public.receipt_presets
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "receipt_presets_update" on public.receipt_presets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "receipt_presets_delete" on public.receipt_presets
  for delete to authenticated using ((select auth.uid()) = user_id);
