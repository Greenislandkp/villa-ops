-- Villa Ops — migration for: 5 villas, English category labels, Contract
-- Renewal category, reservation checkout date.
-- Run once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ohmercemusyijkipquld/sql/new

-- 1. Reservation departure date (arrival date is entries.event_date)
alter table reservations add column if not exists check_out_date date;

-- 2. Rename existing category labels to English (Reservation/Maintenance/
--    Note were already English words, only "Menage" needs changing)
update categories set label = 'Cleaning' where label = 'Menage';

-- 3. New category: Contract Renewal
insert into categories (label, color, is_default)
select 'Contract Renewal', '#5B7FA6', false
where not exists (select 1 from categories where label = 'Contract Renewal');

-- 4. The 3 missing villas (Nour and Breath of Paradise already exist)
insert into villas (name, color)
select v.name, v.color
from (values
  ('Villa Kiran', '#8B5FBF'),
  ('Villa Issanka', '#4A9B8E'),
  ('Villa Azhara', '#C2703D')
) as v(name, color)
where not exists (select 1 from villas where villas.name = v.name);
