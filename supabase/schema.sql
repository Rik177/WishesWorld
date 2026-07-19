-- WishesWorld schema
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- Profiles (optional mirror of auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Wishlists
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  slug text not null unique,
  mode text not null check (mode in ('items', 'link')),
  cart_url text,
  created_at timestamptz not null default now(),
  constraint cart_url_required_for_link check (
    (mode = 'link' and cart_url is not null and length(trim(cart_url)) > 0)
    or mode = 'items'
  )
);

create index if not exists wishlists_owner_id_idx on public.wishlists (owner_id);
create index if not exists wishlists_slug_idx on public.wishlists (slug);

-- Items
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  title text not null,
  url text,
  sort_order int not null default 0
);

create index if not exists wishlist_items_wishlist_id_idx on public.wishlist_items (wishlist_id);

-- Guests
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  emoji text not null,
  session_token text not null unique,
  created_at timestamptz not null default now(),
  unique (wishlist_id, emoji)
);

create index if not exists guests_wishlist_id_idx on public.guests (wishlist_id);

-- Item claims
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wishlist_items (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  unique (item_id)
);

create index if not exists claims_guest_id_idx on public.claims (guest_id);

-- Manual claims (link mode)
create table if not exists public.manual_claims (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  title text not null,
  confirmed_at timestamptz not null default now()
);

create index if not exists manual_claims_wishlist_id_idx on public.manual_claims (wishlist_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.guests enable row level security;
alter table public.claims enable row level security;
alter table public.manual_claims enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid());

-- Wishlists: public read, owner write
create policy "wishlists_select_all" on public.wishlists
  for select to anon, authenticated
  using (true);

create policy "wishlists_insert_own" on public.wishlists
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "wishlists_update_own" on public.wishlists
  for update to authenticated
  using (owner_id = auth.uid());

create policy "wishlists_delete_own" on public.wishlists
  for delete to authenticated
  using (owner_id = auth.uid());

-- Items: public read, owner write
create policy "items_select_all" on public.wishlist_items
  for select to anon, authenticated
  using (true);

create policy "items_insert_own" on public.wishlist_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = auth.uid()
    )
  );

create policy "items_update_own" on public.wishlist_items
  for update to authenticated
  using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = auth.uid()
    )
  );

create policy "items_delete_own" on public.wishlist_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = auth.uid()
    )
  );

-- Guests: anyone can read emoji occupancy; mutations via RPC
create policy "guests_select_all" on public.guests
  for select to anon, authenticated
  using (true);

-- Claims: guests see all claims on public board; owner does NOT via direct select
-- Hide from owner by denying select when user is owner (unless using RPC)
create policy "claims_select_non_owner" on public.claims
  for select to anon, authenticated
  using (
    not exists (
      select 1
      from public.wishlist_items i
      join public.wishlists w on w.id = i.wishlist_id
      where i.id = item_id and w.owner_id = auth.uid()
    )
  );

create policy "manual_claims_select_non_owner" on public.manual_claims
  for select to anon, authenticated
  using (
    not exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.owner_id = auth.uid()
    )
  );

-- ========== RPC ==========

-- Register guest with emoji
create or replace function public.register_guest(
  p_wishlist_id uuid,
  p_emoji text,
  p_session_token text
)
returns public.guests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
begin
  if not exists (select 1 from public.wishlists where id = p_wishlist_id) then
    raise exception 'Wishlist not found';
  end if;

  if p_emoji is null or length(trim(p_emoji)) = 0 then
    raise exception 'Emoji required';
  end if;

  if p_session_token is null or length(trim(p_session_token)) < 8 then
    raise exception 'Invalid session token';
  end if;

  -- Reuse existing session
  select * into v_guest from public.guests where session_token = p_session_token;
  if found then
    if v_guest.wishlist_id <> p_wishlist_id then
      raise exception 'Session belongs to another wishlist';
    end if;
    return v_guest;
  end if;

  if exists (
    select 1 from public.guests
    where wishlist_id = p_wishlist_id and emoji = p_emoji
  ) then
    raise exception 'Emoji already taken';
  end if;

  insert into public.guests (wishlist_id, emoji, session_token)
  values (p_wishlist_id, p_emoji, p_session_token)
  returning * into v_guest;

  return v_guest;
end;
$$;

-- Get guest by session
create or replace function public.get_guest_by_session(
  p_wishlist_id uuid,
  p_session_token text
)
returns public.guests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
begin
  select * into v_guest
  from public.guests
  where wishlist_id = p_wishlist_id and session_token = p_session_token;

  if not found then
    return null;
  end if;
  return v_guest;
end;
$$;

-- Public claims view for guests (items mode)
create or replace function public.get_public_item_claims(
  p_wishlist_id uuid,
  p_session_token text default null
)
returns table (
  claim_id uuid,
  item_id uuid,
  guest_id uuid,
  emoji text,
  is_mine boolean,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid;
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.wishlists where id = p_wishlist_id;
  if v_owner_id is null then
    raise exception 'Wishlist not found';
  end if;

  -- Owners must use reveal RPC
  if auth.uid() is not null and auth.uid() = v_owner_id then
    return;
  end if;

  if p_session_token is not null then
    select id into v_guest_id
    from public.guests
    where wishlist_id = p_wishlist_id and session_token = p_session_token;
  end if;

  return query
  select
    c.id as claim_id,
    c.item_id,
    c.guest_id,
    g.emoji,
    (c.guest_id = v_guest_id) as is_mine,
    c.confirmed_at
  from public.claims c
  join public.guests g on g.id = c.guest_id
  join public.wishlist_items i on i.id = c.item_id
  where i.wishlist_id = p_wishlist_id;
end;
$$;

-- Public manual claims for guests
create or replace function public.get_public_manual_claims(
  p_wishlist_id uuid,
  p_session_token text default null
)
returns table (
  claim_id uuid,
  title text,
  guest_id uuid,
  emoji text,
  is_mine boolean,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid;
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.wishlists where id = p_wishlist_id;
  if v_owner_id is null then
    raise exception 'Wishlist not found';
  end if;

  if auth.uid() is not null and auth.uid() = v_owner_id then
    return;
  end if;

  if p_session_token is not null then
    select id into v_guest_id
    from public.guests
    where wishlist_id = p_wishlist_id and session_token = p_session_token;
  end if;

  return query
  select
    mc.id as claim_id,
    mc.title,
    mc.guest_id,
    g.emoji,
    (mc.guest_id = v_guest_id) as is_mine,
    mc.confirmed_at
  from public.manual_claims mc
  join public.guests g on g.id = mc.guest_id
  where mc.wishlist_id = p_wishlist_id
  order by mc.confirmed_at;
end;
$$;

-- Claim items (confirm selection)
create or replace function public.claim_items(
  p_wishlist_id uuid,
  p_session_token text,
  p_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
  v_mode text;
  v_item_id uuid;
begin
  select * into v_guest
  from public.guests
  where wishlist_id = p_wishlist_id and session_token = p_session_token;

  if not found then
    raise exception 'Guest not found';
  end if;

  select mode into v_mode from public.wishlists where id = p_wishlist_id;
  if v_mode <> 'items' then
    raise exception 'Wishlist is not in items mode';
  end if;

  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception 'No items selected';
  end if;

  foreach v_item_id in array p_item_ids loop
    if not exists (
      select 1 from public.wishlist_items
      where id = v_item_id and wishlist_id = p_wishlist_id
    ) then
      raise exception 'Invalid item';
    end if;

    if exists (
      select 1 from public.claims
      where item_id = v_item_id and guest_id <> v_guest.id
    ) then
      raise exception 'Item already claimed';
    end if;

    insert into public.claims (item_id, guest_id)
    values (v_item_id, v_guest.id)
    on conflict (item_id) do nothing;
  end loop;
end;
$$;

-- Release my claims on specific items (or all mine if null)
create or replace function public.release_claims(
  p_wishlist_id uuid,
  p_session_token text,
  p_item_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
begin
  select * into v_guest
  from public.guests
  where wishlist_id = p_wishlist_id and session_token = p_session_token;

  if not found then
    raise exception 'Guest not found';
  end if;

  if p_item_ids is null then
    delete from public.claims c
    using public.wishlist_items i
    where c.item_id = i.id
      and i.wishlist_id = p_wishlist_id
      and c.guest_id = v_guest.id;
  else
    delete from public.claims c
    using public.wishlist_items i
    where c.item_id = i.id
      and i.wishlist_id = p_wishlist_id
      and c.guest_id = v_guest.id
      and c.item_id = any(p_item_ids);
  end if;
end;
$$;

-- Add manual claim
create or replace function public.add_manual_claim(
  p_wishlist_id uuid,
  p_session_token text,
  p_title text
)
returns public.manual_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
  v_mode text;
  v_claim public.manual_claims;
begin
  select * into v_guest
  from public.guests
  where wishlist_id = p_wishlist_id and session_token = p_session_token;

  if not found then
    raise exception 'Guest not found';
  end if;

  select mode into v_mode from public.wishlists where id = p_wishlist_id;
  if v_mode <> 'link' then
    raise exception 'Wishlist is not in link mode';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title required';
  end if;

  insert into public.manual_claims (wishlist_id, guest_id, title)
  values (p_wishlist_id, v_guest.id, trim(p_title))
  returning * into v_claim;

  return v_claim;
end;
$$;

-- Remove my manual claim
create or replace function public.remove_manual_claim(
  p_wishlist_id uuid,
  p_session_token text,
  p_claim_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
begin
  select * into v_guest
  from public.guests
  where wishlist_id = p_wishlist_id and session_token = p_session_token;

  if not found then
    raise exception 'Guest not found';
  end if;

  delete from public.manual_claims
  where id = p_claim_id
    and wishlist_id = p_wishlist_id
    and guest_id = v_guest.id;
end;
$$;

-- Owner reveal: item claims
create or replace function public.get_claims_for_owner(
  p_wishlist_id uuid
)
returns table (
  claim_id uuid,
  item_id uuid,
  item_title text,
  guest_id uuid,
  emoji text,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.wishlists
    where id = p_wishlist_id and owner_id = auth.uid()
  ) then
    raise exception 'Not the owner';
  end if;

  return query
  select
    c.id as claim_id,
    c.item_id,
    i.title as item_title,
    c.guest_id,
    g.emoji,
    c.confirmed_at
  from public.claims c
  join public.wishlist_items i on i.id = c.item_id
  join public.guests g on g.id = c.guest_id
  where i.wishlist_id = p_wishlist_id
  order by c.confirmed_at;
end;
$$;

-- Owner reveal: manual claims
create or replace function public.get_manual_claims_for_owner(
  p_wishlist_id uuid
)
returns table (
  claim_id uuid,
  title text,
  guest_id uuid,
  emoji text,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.wishlists
    where id = p_wishlist_id and owner_id = auth.uid()
  ) then
    raise exception 'Not the owner';
  end if;

  return query
  select
    mc.id as claim_id,
    mc.title,
    mc.guest_id,
    g.emoji,
    mc.confirmed_at
  from public.manual_claims mc
  join public.guests g on g.id = mc.guest_id
  where mc.wishlist_id = p_wishlist_id
  order by mc.confirmed_at;
end;
$$;

-- Grants
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.wishlists to authenticated;
grant select on public.wishlists to anon;
grant select, insert, update, delete on public.wishlist_items to authenticated;
grant select on public.wishlist_items to anon;
grant select on public.guests to anon, authenticated;
grant select on public.claims to anon, authenticated;
grant select on public.manual_claims to anon, authenticated;

grant execute on function public.register_guest(uuid, text, text) to anon, authenticated;
grant execute on function public.get_guest_by_session(uuid, text) to anon, authenticated;
grant execute on function public.get_public_item_claims(uuid, text) to anon, authenticated;
grant execute on function public.get_public_manual_claims(uuid, text) to anon, authenticated;
grant execute on function public.claim_items(uuid, text, uuid[]) to anon, authenticated;
grant execute on function public.release_claims(uuid, text, uuid[]) to anon, authenticated;
grant execute on function public.add_manual_claim(uuid, text, text) to anon, authenticated;
grant execute on function public.remove_manual_claim(uuid, text, uuid) to anon, authenticated;
grant execute on function public.get_claims_for_owner(uuid) to authenticated;
grant execute on function public.get_manual_claims_for_owner(uuid) to authenticated;
