// Actual migrations and ownership tests in disposable PostgreSQL, never production.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.CARDSTASHY_PGLITE_MODULE)throw Error('Set CARDSTASHY_PGLITE_MODULE to the disposable test runtime.');
const {PGlite}=await import(pathToFileURL(process.env.CARDSTASHY_PGLITE_MODULE).href),db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of ['20261012000000_cardforge_accounts.sql','20261012000100_account_privileges.sql','20261017222715_community_friends_profiles.sql','20261017223526_community_snapshot_key_fix.sql','20261018014537_community_shared_deck_details.sql','20261018041746_community_showcase_appearance.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const result=await db.exec(readFileSync('supabase/tests/community_access.sql','utf8'));console.log(JSON.stringify(result.flatMap(r=>r.rows||[]).filter(r=>r.result)));
 console.log('PASS: real shared snapshot SQL, immutable owner boundary, accepted friend read-only access, private-field stripping and deck section preservation');
}finally{await db.close();}
