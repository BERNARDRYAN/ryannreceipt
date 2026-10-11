-- RyannReceipt 0003: synced settings (budgets, recurring expenses) and receipt photos.
-- Safe to re-run. Everything stays on the Supabase free tier.

-- ============================================================================
-- 1. SETTINGS (one row per user)
-- ============================================================================
create table if not exists public.receipt_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint receipt_settings_size check (pg_column_size(data) <= 65536)
);

alter table public.receipt_settings enable row level security;

drop policy if exists "receipt_settings_select" on public.receipt_settings;
drop policy if exists "receipt_settings_insert" on public.receipt_settings;
drop policy if exists "receipt_settings_update" on public.receipt_settings;
drop policy if exists "receipt_settings_delete" on public.receipt_settings;

create policy "receipt_settings_select" on public.receipt_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "receipt_settings_insert" on public.receipt_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "receipt_settings_update" on public.receipt_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "receipt_settings_delete" on public.receipt_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================================
-- 2. RECEIPT PHOTOS (private Storage bucket, one folder per user)
--    Object path: <user id>/<receipt id>.jpg
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt-photos', 'receipt-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipt_photos_select" on storage.objects;
drop policy if exists "receipt_photos_insert" on storage.objects;
drop policy if exists "receipt_photos_update" on storage.objects;
drop policy if exists "receipt_photos_delete" on storage.objects;

create policy "receipt_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipt_photos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipt_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipt_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
