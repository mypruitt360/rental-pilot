create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  property_id uuid not null references public.properties(id),
  category text not null,
  amount numeric(12,2) check (amount > 0),
  due_day integer check (due_day between 1 and 31),
  start_on date not null,
  vendor text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(owner_id, property_id, category)
);
alter table public.recurring_expenses enable row level security;
create policy "owner recurring expenses" on public.recurring_expenses for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())
));
grant select, insert, update, delete on public.recurring_expenses to authenticated;
alter table public.expenses add column recurring_id uuid references public.recurring_expenses(id);
alter table public.expenses add column recurring_month date;
alter table public.expenses add constraint recurring_payment_pair check (
  (recurring_id is null and recurring_month is null) or
  (recurring_id is not null and recurring_month is not null and extract(day from recurring_month) = 1)
);
create unique index expenses_recurring_month_unique on public.expenses(recurring_id, recurring_month)
where recurring_id is not null;
create function public.check_recurring_expense_payment() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.recurring_id is not null and not exists (
    select 1 from public.recurring_expenses s
    where s.id = new.recurring_id and s.owner_id = new.owner_id and s.property_id = new.property_id
  ) then
    raise exception 'Recurring expense does not belong to this property and owner';
  end if;
  return new;
end;
$$;
create trigger validate_recurring_expense_payment before insert or update on public.expenses
for each row execute function public.check_recurring_expense_payment();

-- Confirmed internet bills. HOA remains unknown, even if older property estimates exist.
insert into public.recurring_expenses(owner_id,property_id,category,amount,due_day,start_on)
select owner_id,id,'Internet',100,10,date '2026-10-10' from public.properties
where short_name in ('Unit 140','Unit 310','Unit 610') and status <> 'Sold';
insert into public.recurring_expenses(owner_id,property_id,category,amount,due_day,start_on)
select owner_id,id,'HOA',null,null,date '2026-10-01' from public.properties
where short_name in ('Unit 140','Unit 310','Unit 610') and status <> 'Sold';
