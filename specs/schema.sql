create table users (
  id text primary key, email text, first_name text not null, last_name text not null,
  bio text, avatar_url text, city text, lat double precision not null, lng double precision not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table user_sports (
  user_id text not null references users(id) on delete cascade,
  sport text not null, level text not null, primary key (user_id, sport)
);
create table user_availability (
  id bigint generated always as identity primary key,
  user_id text not null references users(id) on delete cascade,
  day_of_week text not null, start_time text not null, end_time text not null
);
create table activities (
  id text primary key default gen_random_uuid()::text,
  created_by text not null references users(id), guest_id text not null references users(id),
  sport text not null, start_at timestamptz not null,
  lieu_nom text not null, lieu_lat double precision not null, lieu_lng double precision not null,
  message text not null,
  status text not null default 'en_attente' check (status in ('en_attente','acceptee','refusee','terminee')),
  media_url text, media_type text check (media_type in ('image','video')),
  created_at timestamptz not null default now(), check (created_by <> guest_id)
);
create table conversations (
  id text primary key default gen_random_uuid()::text,
  activity_id text references activities(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table participants (
  conversation_id text not null references conversations(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create table messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references conversations(id) on delete cascade,
  sender_id text not null references users(id), text text not null,
  sent_at timestamptz not null default now()
);
create table favorites (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('user','activity')),
  target_id text not null, created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
