-- RyannReceipt 0002: receipt extras + preset phone + size guards.
-- Safe to re-run.

-- Fields with no dedicated column (cashier, table, order type, service charge,
-- tax label/inclusive, cash rounding, tendered) live here as JSON.
alter table public.receipt_items
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.receipt_presets
  add column if not exists merchant_phone text;

-- Defence in depth on top of BFF validation: cap row payload sizes.
-- (style_config may carry a small dithered logo data URL.)
alter table public.receipt_items drop constraint if exists receipt_items_payload_size;
alter table public.receipt_items add constraint receipt_items_payload_size check (
  pg_column_size(items) <= 65536
  and pg_column_size(style_config) <= 196608
  and pg_column_size(meta) <= 8192
);

alter table public.receipt_presets drop constraint if exists receipt_presets_payload_size;
alter table public.receipt_presets add constraint receipt_presets_payload_size check (
  pg_column_size(style_config) <= 196608
);

-- History list sorts by pin, then date, per user.
create index if not exists idx_receipt_items_user_pinned_date
  on public.receipt_items(user_id, is_pinned desc, receipt_date desc);
