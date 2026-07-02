-- 既存 DB に Spotify ID 列を追加（SQL Editor で実行）
alter table public.artists add column if not exists spotify_id text;
alter table public.albums add column if not exists spotify_id text;

update public.artists set spotify_id = '1LQQtqc1vQ1neUgZrjYlEU' where id = 'yumi-arai';
update public.artists set spotify_id = '1g8HCTiMwBtFtpRR9JXAZR' where id = 'fishmans';
update public.artists set spotify_id = '2vJObElaIZWYDLpiXiJMo9' where id = 'cornelius';
update public.artists set spotify_id = '2XjqKvB2Xz9IdyjWPIHaXi' where id = 'ringo-shiina';

update public.albums set spotify_id = '4EX1fAypgQC9wDjGI5QzbZ' where id = '2';
update public.albums set spotify_id = '0jWKPSADCOdw4Ez5KmJ7zE' where id = '8';
update public.albums set spotify_id = '6orQve3m8UVGK3H91ZLm7a' where id = '3';
update public.albums set spotify_id = '4XH9KiaS5k5oZEpPRTZqNp' where id = '9';
update public.albums set spotify_id = '0QWI6wd3QBiQscVpBu6kUE' where id = '10';
