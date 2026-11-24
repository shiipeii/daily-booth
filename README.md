# daily booth

one photo a day, together or apart.

a private web app for two. once a day, at a random time, both phones get a
ping. you take one photo together, or a selfie each if you're apart. photos
get a film look and a printed date, and build up into an album. everything
can be exported at any time.

live at **https://shiipeii.github.io/daily-booth/** once set up.

## how it's built

```
web/                     the app (react + typescript + vite), installable on a phone
  src/lib/api.ts         every backend call lives here, and only here
  src/lib/film.ts        film looks + the printed border and date (all on-device)
  src/lib/push.ts        daily ping subscription
  src/lib/exportZip.ts   "export all photos"
  src/screens/           one file per screen
  src/components/        small shared pieces
  src/styles/tokens.css  colours and type for light and dark mode
  public/sw.js           shows the ping notification
supabase/
  migrations/            database tables, security rules, the every-minute job
  functions/tick/        picks each day's random ping time and sends it
  functions/notify/      tells the other person when a selfie is posted on an apart day
  functions/_shared/     push sending used by both
scripts/
  provision.sh           sets up / updates the backend (run by the deploy)
  backup.mjs             full backup of every table and photo
docs/
  data-model.md          what's stored where
  migrating.md           how to get everything out
.github/workflows/       push to main → backend updated, app published
```

free services only: **supabase** (database, photo storage, the ping job) and
**github pages** (hosting).

## set up (about 10 minutes, once)

1. **make a supabase project.** sign up at supabase.com (free), click
   *new project*, name it `daily-booth`, pick the singapore region, and save
   the database password somewhere.
   the project ref is the id in the dashboard url:
   `supabase.com/dashboard/project/<this-part>`.
2. **make a supabase access token** at supabase.com/dashboard/account/tokens.
3. **add three secrets to this repo**: settings → secrets and variables →
   actions → *new repository secret*:
   - `SUPABASE_PROJECT_REF`: the project ref
   - `SUPABASE_DB_PASSWORD`: the database password
   - `SUPABASE_ACCESS_TOKEN`: the access token
4. **turn on pages**: settings → pages → source: *github actions*.
5. **deploy**: actions → *deploy* → *run workflow*. after a few minutes
   it's live.

## start using it

1. on each iphone, open the link in **safari**, tap share → *add to home
   screen*, and open daily booth from the home screen (pings only work
   from there).
2. one of you creates an account and taps *start a booth*. the app shows a
   6-letter code.
3. the other creates an account, taps *i have a code* and enters it.
4. both: settings → daily ping → *turn on*.

## change things

- **ping hours:** in the app, settings → daily ping (default 10 am to 10 pm).
- **film looks:** `FILMS` in `web/src/lib/film.ts`.
- **colours:** `web/src/styles/tokens.css`.
- **notification text:** `PING_MESSAGE` in `supabase/functions/tick/index.ts`, selfie alerts in `supabase/functions/notify/index.ts`.

## local development

```sh
cd web
cp .env.example .env.local   # fill in your project url and anon key
npm install
npm run dev
```
