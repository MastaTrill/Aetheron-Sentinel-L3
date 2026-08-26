create extension if not exists pgcrypto;

create table if not exists sentinel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  stripe_customer_id text not null unique,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  customer_email text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentinel_api_keys (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references sentinel_subscriptions(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists sentinel_checkout_claims (
  claim_id uuid primary key,
  claim_secret_hash text not null unique,
  stripe_checkout_session_id text unique,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sentinel_billing_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_sentinel_subscriptions_customer
  on sentinel_subscriptions(stripe_customer_id);
create index if not exists idx_sentinel_api_keys_hash
  on sentinel_api_keys(key_hash);
create index if not exists idx_sentinel_api_keys_subscription
  on sentinel_api_keys(subscription_id);
create index if not exists idx_sentinel_checkout_claims_session
  on sentinel_checkout_claims(stripe_checkout_session_id);

alter table sentinel_subscriptions enable row level security;
alter table sentinel_api_keys enable row level security;
alter table sentinel_checkout_claims enable row level security;
alter table sentinel_billing_events enable row level security;

revoke all on table sentinel_subscriptions from anon, authenticated;
revoke all on table sentinel_api_keys from anon, authenticated;
revoke all on table sentinel_checkout_claims from anon, authenticated;
revoke all on table sentinel_billing_events from anon, authenticated;

create or replace function claim_sentinel_checkout_and_create_key(
  p_checkout_session_id text,
  p_claim_secret_hash text,
  p_subscription_id uuid,
  p_key_prefix text,
  p_key_hash text
)
returns table(api_key_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.sentinel_checkout_claims
     set claimed_at = now()
   where stripe_checkout_session_id = p_checkout_session_id
     and claim_secret_hash = p_claim_secret_hash
     and claimed_at is null
     and expires_at > now();

  if not found then
    return;
  end if;

  return query
    insert into public.sentinel_api_keys(subscription_id, key_prefix, key_hash)
    values (p_subscription_id, p_key_prefix, p_key_hash)
    returning sentinel_api_keys.id;
end;
$$;

revoke all on function claim_sentinel_checkout_and_create_key(text,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function claim_sentinel_checkout_and_create_key(text,text,uuid,text,text)
  to service_role;
