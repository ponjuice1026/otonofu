-- フォロー通知
-- notifications テーブルに 'follow' タイプを追加し、
-- 遷移先（フォロワーの公開ユーザーページ）解決用に actor_id を持たせる。
-- Supabase Dashboard → SQL Editor で実行（add_notifications.sql の後）

-- 1. type の check 制約に 'follow' を追加
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'thread_reply', 'post_reply', 'review_comment',
      'comment_reply', 'reaction', 'follow'
    )
  );

-- 2. アクター（通知の発生源ユーザー）のID。
--    フォロー通知の遷移先 /users/{actor_id} を解決するために使う。
--    既存の通知タイプでは null のまま。
alter table public.notifications
  add column if not exists actor_id uuid;

-- 3. create_notification を actor_id 対応版に置き換える。
--    引数を増やしても既存呼び出し（target_actor_id 省略）は default null で動く。
create or replace function public.create_notification(
  target_user_id uuid,
  notification_type text,
  actor_name text,
  target_thread_id uuid default null,
  target_review_id text default null,
  target_post_id uuid default null,
  target_comment_id uuid default null,
  target_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 宛先不明・自分自身宛はスキップ
  if target_user_id is null then
    return;
  end if;
  if target_user_id = auth.uid() then
    return;
  end if;

  insert into public.notifications (
    user_id, type, actor_name,
    thread_id, review_id, post_id, comment_id, actor_id
  ) values (
    target_user_id, notification_type, actor_name,
    target_thread_id, target_review_id, target_post_id, target_comment_id,
    target_actor_id
  );
end;
$$;

grant execute on function public.create_notification(
  uuid, text, text, uuid, text, uuid, uuid, uuid
) to anon, authenticated;
