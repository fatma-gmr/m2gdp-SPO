-- Ajoute le sport principal (un seul par utilisateur) à user_sports.
-- Idempotent : peut être relancé sans erreur. À appliquer dans Supabase (SQL Editor)
-- avant de déployer le Worker, dont USER_SELECT lit la colonne is_primary.
alter table user_sports
  add column if not exists is_primary boolean not null default false;
create unique index if not exists user_sports_one_primary on user_sports(user_id) where is_primary;
