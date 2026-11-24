#!/usr/bin/env bash
# sets up (or updates) the supabase backend. safe to run again and again.
#
# needs:  SUPABASE_ACCESS_TOKEN  SUPABASE_PROJECT_REF  SUPABASE_DB_PASSWORD
# optional: SITE_URL (where the web app lives, for auth redirects)
#           VAPID_SUBJECT (contact for push services, e.g. mailto:you@example.com)
# writes (when run in github actions): supabase_url and anon_key to $GITHUB_OUTPUT
#
# what it does:
#   1. applies database migrations
#   2. creates web push keys + the cron secret the first time, stores them in supabase
#   3. deploys the `tick` (daily ping) and `notify` (selfie alert) functions
#   4. points auth at the web app and turns off email confirmation (two-person app)

set -euo pipefail
export SUPABASE_YES=1   # supabase cli v3: answer yes to prompts in ci

: "${SUPABASE_ACCESS_TOKEN:?add the SUPABASE_ACCESS_TOKEN secret}"
: "${SUPABASE_PROJECT_REF:?add the SUPABASE_PROJECT_REF secret}"
: "${SUPABASE_DB_PASSWORD:?add the SUPABASE_DB_PASSWORD secret}"

REF="$SUPABASE_PROJECT_REF"
API="https://api.supabase.com/v1/projects/$REF"
PROJECT_URL="https://$REF.supabase.co"
cd "$(dirname "$0")/.."

api() { # method path [json]
  curl -fsS -X "$1" "$API$2" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    ${3:+-d "$3"}
}

sql() { # query -> json rows
  api POST /database/query "$(jq -n --arg q "$1" '{query: $q}')"
}

echo "› applying migrations"
supabase link --project-ref "$REF" --yes
supabase db push --remote --password "$SUPABASE_DB_PASSWORD" --yes

echo "› web push keys"
VAPID_PUBLIC=$(sql "select value from public.app_config where key = 'vapid_public_key'" | jq -r '.[0].value // empty')
if [ -z "$VAPID_PUBLIC" ]; then
  KEYS=$(npx --yes web-push@3.6.7 generate-vapid-keys --json)
  VAPID_PUBLIC=$(echo "$KEYS" | jq -r .publicKey)
  VAPID_PRIVATE=$(echo "$KEYS" | jq -r .privateKey)
  supabase secrets set --yes \
    "VAPID_PUBLIC_KEY=$VAPID_PUBLIC" \
    "VAPID_PRIVATE_KEY=$VAPID_PRIVATE" \
    "VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:hello@example.com}"
  sql "insert into public.app_config (key, value) values ('vapid_public_key', '$VAPID_PUBLIC')
       on conflict (key) do update set value = excluded.value" > /dev/null
  echo "  created new keys"
else
  echo "  already set"
fi

echo "› cron secret"
HAS_SECRET=$(sql "select count(*)::int as n from vault.secrets where name = 'cron_secret'" | jq -r '.[0].n')
if [ "$HAS_SECRET" = "0" ]; then
  CRON_SECRET=$(openssl rand -hex 32)
  supabase secrets set --yes "CRON_SECRET=$CRON_SECRET"
  sql "select vault.create_secret('$CRON_SECRET', 'cron_secret');
       select vault.create_secret('$PROJECT_URL', 'project_url')
       where not exists (select 1 from vault.secrets where name = 'project_url');" > /dev/null
  echo "  created"
else
  echo "  already set"
fi

echo "› deploying functions"
supabase functions deploy tick --no-verify-jwt --use-api --yes
supabase functions deploy notify --no-verify-jwt --use-api --yes

echo "› auth settings"
SITE="${SITE_URL:-http://localhost:5173}"
api PATCH /config/auth "$(jq -n --arg site "$SITE" '{
  site_url: $site,
  uri_allow_list: ($site + "**"),
  mailer_autoconfirm: true,
  disable_signup: false
}')" > /dev/null

ANON_KEY=$(api GET /api-keys | jq -r '[.[] | select(.name == "anon")][0].api_key // empty')
if [ -z "$ANON_KEY" ]; then
  ANON_KEY=$(api GET "/api-keys?reveal=true" | jq -r '[.[] | select(.type == "publishable")][0].api_key // empty')
fi
[ -n "$ANON_KEY" ] || { echo "couldn't read the project's public api key"; exit 1; }

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "supabase_url=$PROJECT_URL" >> "$GITHUB_OUTPUT"
  echo "anon_key=$ANON_KEY" >> "$GITHUB_OUTPUT"
fi

echo "✓ backend ready at $PROJECT_URL"
