alter table public.users enable row level security;
alter table public.dtr enable row level security;

create policy "Admins can manage user profiles" on public.users
  for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create policy "Users can select their own profile" on public.users
  for select
  using (auth.uid() = id);

create policy "Users can update their own profile" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and new.role = old.role and new.email = old.email);

create policy "Select own records" on public.dtr
  for select
  using (auth.uid() = user_id);

create policy "Admins can select all records" on public.dtr
  for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create policy "Insert own records" on public.dtr
  for insert
  with check (auth.uid() = user_id);

create policy "Update own records or admin" on public.dtr
  for update
  using (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create policy "Delete own records or admin" on public.dtr
  for delete
  using (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
