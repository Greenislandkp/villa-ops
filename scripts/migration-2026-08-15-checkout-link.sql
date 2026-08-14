-- Villa Ops — links the auto-generated "Checkout" task back to the
-- reservation entry it belongs to, so editing a stay's dates keeps the
-- checkout task's due date in sync automatically.
-- Run once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ohmercemusyijkipquld/sql/new

alter table entries
  add column if not exists related_entry_id uuid references entries(id) on delete set null;
