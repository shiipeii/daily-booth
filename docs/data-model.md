# data model

everything lives in one supabase project: a postgres database and a private
storage bucket called `photos`. the schema is in `supabase/migrations/`.

## tables

| table | one row per | key columns |
|---|---|---|
| `couples` | booth (two people) | `invite_code`, `timezone`, `ping_window_start`, `ping_window_end` (local hours) |
| `members` | person | `user_id`, `couple_id`, `display_name` |
| `days` | couple per local calendar day | `local_date`, `ping_at` (random), `ping_sent_at`, `mode` (`together` / `apart`, null = together), `caption` |
| `photos` | photo taken | `day_id`, `taken_by`, `taken_at`, `film`, `date_stamp`, `original_path`, `film_path` |
| `push_subscriptions` | phone that gets pings | `endpoint`, `user_id`, keys |
| `app_config` | public setting | `vapid_public_key` |

## files

```
photos/<couple_id>/<yyyy-mm-dd>/<photo_id>-original.jpg   untouched camera image, cropped to 4:5
photos/<couple_id>/<yyyy-mm-dd>/<photo_id>-film.jpg       developed print: film look, paper border, date
```

both versions are always kept, whatever was saved to the camera roll, so the
look can be re-done later from the originals.

## day status

status is never stored. the `day_summary` view works it out:

| status | meaning |
|---|---|
| `pending` | today, no photo yet |
| `together` | together day with a photo |
| `apart` | apart day, both selfies in |
| `waiting` | apart day, one selfie so far (today) |
| `half` | apart day that ended with one selfie |
| `missed` | a past day with no photo |

## the daily ping

1. `pg_cron` calls the `tick` edge function every minute.
2. `tick` makes sure each couple has a `days` row for today. a new row gets a
   random `ping_at` inside the couple's window.
3. once `ping_at` passes, `tick` marks the day `ping_sent_at` and sends a web
   push to both members' phones, skipping anyone who already posted. on a
   together day, any photo means no ping at all.
4. the photo can be taken any time that day, before or after the ping,
   until midnight (your timezone). an empty day shows as missed.

## selfie alerts

on an apart day, when someone posts their first selfie, a database trigger
(`photos_notify_partner`) calls the `notify` edge function, which tells the
other person: "ian took today's selfie. your turn…", or, if they'd already
posted, "ian posted. today's strip is done." retakes don't notify again.
