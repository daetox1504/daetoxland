alter table public.properties add column if not exists public_number text;
alter table public.customers add column if not exists public_number text;

with numbered as (
  select id,
    concat(case when market_type = 'rent' then 'R' else 'S' end, '-',
      to_char(created_at, 'YYYY'), '-',
      lpad(row_number() over (partition by user_id, market_type, date_part('year', created_at) order by created_at, id)::text, 5, '0')) as value
  from public.properties
  where public_number is null
)
update public.properties p set public_number = n.value
from numbered n where p.id = n.id;

with numbered as (
  select id,
    concat('C-', to_char(created_at, 'YYYY'), '-',
      lpad(row_number() over (partition by user_id, date_part('year', created_at) order by created_at, id)::text, 5, '0')) as value
  from public.customers
  where public_number is null
)
update public.customers c set public_number = n.value
from numbered n where c.id = n.id;

create unique index if not exists properties_user_public_number_idx
  on public.properties (user_id, public_number)
  where public_number is not null;

create unique index if not exists customers_user_public_number_idx
  on public.customers (user_id, public_number)
  where public_number is not null;
