# getting your data out

there are three ways, from easiest to most complete.

## 1. in the app

settings → your photos → export all photos. you get one zip:

```
daily-booth-export/
  days.json     every day: date, mode, status, caption, and its photos
  days.csv      the same, one row per photo, for spreadsheets
  photos/<date>/<id>-film.jpg
  photos/<date>/<id>-original.jpg
```

`days.json` is plain data with relative file paths, so any future format
(printed book, video, slideshow, another app) can be built from it.

## 2. full backup script

backs up every table and every file for the whole project:

```sh
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key from project settings → api> \
node scripts/backup.mjs ./backup
```

## 3. moving the backend

- **database:** `supabase db dump --data-only > data.sql` gives standard
  postgres sql. the schema is in `supabase/migrations/`, so any postgres
  host works.
- **code:** all backend calls in the web app go through
  `web/src/lib/api.ts`. to move off supabase, rewrite that one file.
- **pings:** web push is a standard. `supabase/functions/tick/index.ts` uses
  the `web-push` library, which runs on any node or deno server. keep the
  same vapid keys (in the project's function secrets) and phones won't need
  to re-subscribe.
