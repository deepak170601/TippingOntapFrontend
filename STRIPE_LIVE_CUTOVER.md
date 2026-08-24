# Cutover: Stripe test → live

Prompts for Claude Code in the **backend** repo (`tippingontapbackend`). Do
tasks in order.

## Context

Tap to Pay now works end to end. The last tap failed with `Your request used a
real card while testing.` — the SDK read the card and reached Stripe, but the
backend mints connection tokens on test keys and Stripe refuses live cards in
test mode. A physical tap can only be tested in live mode.

**Do not change the mobile app.** It embeds no Stripe key, and resolves the
Terminal location at runtime via `getLocations()`. Flipping the backend's keys
flips the app.

The app side is already cut over (2026-08-23), so nothing below needs an app
change to work:

- `src/hooks/usePayment.ts` has no live mock and no simulated-reader path.
  Both are commented out and marked `DISABLED (test only)`. Every build, debug
  or release, now goes through real NFC hardware and a real tap.
- The release build type signs with a real keystore supplied through
  `TIPPING_RELEASE_STORE_FILE` (see `android/app/build.gradle`).
- Release builds refuse cleartext traffic and drop Terminal SDK logging from
  `verbose` to `error`.

Live mode is a separate universe. Every `acct_`, `tml_`, `cus_`, `pi_` minted
in test mode is invisible to a live key. Most of the work below is finding
test-mode ids the backend has already persisted, not writing new logic.

```bash
export SK_TEST=sk_test_xxx SK_LIVE=sk_live_xxx
```

## Task 1 — Inventory what is mode-scoped

Report, do not change yet:

1. Every place a Stripe secret key is read (config, env, DI registration).
2. Every persisted Stripe id — entity fields and columns. Expect at least
   `StripeAccountId` and `StripeLocationId` on the user entity.
3. Every webhook handler, and where its signing secret comes from.

**Expected:** a single key read from config, and ids stored per user. If a key
is hardcoded anywhere, flag it — that blocks the cutover.

## Task 2 — Clear mode-tainted records

The cleanest option is a separate database for live, leaving test data intact.
If the deployment cannot support that, the fallback is to null the test-mode
ids in place so onboarding re-provisions them.

Recommend one, then implement it. For the in-place path:

```csharp
await db.Users.ExecuteUpdateAsync(s => s
    .SetProperty(u => u.StripeAccountId,   (string?)null)
    .SetProperty(u => u.StripeLocationId,  (string?)null)
    .SetProperty(u => u.OnboardingComplete, false));
```

**Requirements:**
- Verify the field names against the repo — the list above comes from
  `STRIPE_TERMINAL_LOCATION_SETUP.md`, not from reading the entity.
- Leave tip/earnings history alone. It is app data, not Stripe data.
- Do not delete rows. Users keep their logins.

**Done when:** no user row holds an id that was minted in test mode.

## Task 3 — Register a live webhook endpoint

Webhook endpoints are per mode, and so are their signing secrets. A test-mode
endpoint fires nothing in live mode — onboarding completion would silently
never record.

```bash
curl https://api.stripe.com/v1/webhook_endpoints -u $SK_LIVE: \
  -d "url=https://tippingontapbackend.fly.dev/webhooks/stripe" \
  -d "enabled_events[]=account.updated" \
  -d "enabled_events[]=payment_intent.succeeded"
```

Use the real path from Task 1, and the real event list the handler switches on.
The response `secret` (`whsec_…`) is the **live** signing secret.

**Done when:** the handler verifies against whichever secret matches the active
mode, and rejects a bad signature.

## Task 4 — Flip the secrets

```bash
fly secrets set STRIPE_SECRET_KEY=$SK_LIVE STRIPE_WEBHOOK_SECRET=whsec_live_xxx \
  -a tippingontapbackend
fly secrets list -a tippingontapbackend
```

Use the real secret names from Task 1. Record the test values first — Rollback
below depends on it.

## Task 5 — Re-onboard and provision a live location

1. Sign in on the app and run Connect onboarding again. Live onboarding needs
   genuine business details and a real bank account; test data is rejected.
2. `/connect/status` must report complete.
3. `EnsureTerminalLocationAsync` should then create a live location on its own.
   If Task 3 of `STRIPE_TERMINAL_LOCATION_SETUP.md` was never implemented,
   create one by hand with `$SK_LIVE` and the connected account id.

**Blocked if** the platform account has not completed its own Stripe activation
or does not have Connect enabled in live mode. Neither is a code fix — report
it and stop.

### Set the location's `display_name` to the merchant, not the platform

Whatever `EnsureTerminalLocationAsync` puts in `display_name` is what the
customer sees on the Tap to Pay screen while their card is being read. If it
is a platform-wide constant, every merchant's customers are shown the
platform's name at the moment they hand over their card.

This has to be done here. The React Native SDK's `connectReader` accepts a
`merchantDisplayName`, but that parameter is read **only** by the iOS native
layer (`ios/StripeTerminalReactNative.swift:376`). It appears in zero Kotlin
files in `@stripe/stripe-terminal-react-native@0.0.1-beta.32`, and the Android
`TapToPayConnectionConfiguration` accepts only `locationId`,
`autoReconnectOnUnexpectedDisconnect`, and a listener. Passing it from the app
on Android does nothing. Same for `onBehalfOf` and `tosAcceptancePermitted`.

**Done when:** each connected account's Terminal location carries that
merchant's own business name.

## Task 6 — Verify

```bash
export ACCT_LIVE=acct_xxx
curl -G https://api.stripe.com/v1/terminal/locations -u $SK_LIVE: \
  -H "Stripe-Account: $ACCT_LIVE"
```

**Expected:** non-empty, `"livemode": true`.

Then one real tap, smallest amount the flow allows:

1. Stripe Dashboard → Payments shows `succeeded`, `livemode` badge absent
2. App Wallet shows the same amount
3. App Home total shows the same amount
4. Refund it from the Dashboard

**If Stripe shows the payment but the wallet does not:** the cutover is done and
the bug is `/capture_payment_intent` not persisting. Report separately.

## Rollback

Re-set the test secrets from Task 4 and re-run Task 2 against the live ids. If
Task 2 chose a separate database, point back at the test one instead — nothing
else to undo.

## Notes

- Real money moves. Use the smallest amount, and refund it immediately.
- Live Tap to Pay enforces device and app integrity attestation more strictly
  than test mode. The release build now signs with a real keystore, but only
  once `TIPPING_RELEASE_STORE_FILE` and its three companions are set in
  `~/.gradle/gradle.properties`. Without them the build falls back to the debug
  keystore and prints a `DEBUG-SIGNED` warning; such a build may fail
  attestation. That is an app problem, not a backend one — if the tap fails
  attestation, do not look for a backend cause.
- Backend assumed ASP.NET Core + Stripe.net + EF Core, per the existing doc. If
  wrong, the curl still stands; translate the C#.
- Verify every assumption here against the repo before acting on it.
