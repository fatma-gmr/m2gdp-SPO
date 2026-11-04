-- BINOFIT — Suppression de toutes les données du seed massif (specs/seed-massif.sql).
--
-- Ne touche qu'aux lignes dont l'id (ou l'id du user / de la conversation de rattachement)
-- commence par « seed- ». Les vraies données ne sont pas concernées.
-- À lancer dans Supabase > SQL Editor (rôle postgres, qui n'est pas soumis à la RLS).
-- Relançable : sans données « seed- », chaque delete supprime 0 ligne.
--
-- Ordre imposé par les clés étrangères :
--   - favorites.target_id n'est pas une clé étrangère : on les supprime explicitement ;
--   - messages.sender_id et activities.created_by / guest_id n'ont pas de cascade :
--     on les supprime avant les users ;
--   - user_sports, user_availability et participants partent en cascade avec
--     leur user ou leur conversation.

begin;

delete from favorites where user_id like 'seed-%' or target_id like 'seed-%';
delete from messages where conversation_id like 'seed-%' or sender_id like 'seed-%';
delete from conversations where id like 'seed-%';
delete from activities where id like 'seed-%' or created_by like 'seed-%' or guest_id like 'seed-%';
delete from users where id like 'seed-%';

commit;

-- Vérification (doit renvoyer 0 partout) :
-- select
--   (select count(*) from users where id like 'seed-%') as users,
--   (select count(*) from user_sports where user_id like 'seed-%') as user_sports,
--   (select count(*) from user_availability where user_id like 'seed-%') as user_availability,
--   (select count(*) from activities where id like 'seed-%') as activities,
--   (select count(*) from conversations where id like 'seed-%') as conversations,
--   (select count(*) from participants where user_id like 'seed-%') as participants,
--   (select count(*) from messages where id like 'seed-%') as messages;
