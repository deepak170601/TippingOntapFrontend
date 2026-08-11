# Fix: Stripe Terminal Location missing

Prompts for Claude Code in the **backend** repo (`tippingontapbackend`). Do tasks in order.

## Context

App fails at payment with `No Terminal location exists on this Stripe account.`

Tap to Pay requires every reader connection to attach to a **Terminal Location**.
The account our `/connection_token` is minted for has none. Locations are **per
account and per mode** — test-mode is invisible to a live token, platform is
invisible to a connected-account token.

**Do not change the mobile app.** It resolves the location at runtime via
`getLocations()`. Never reintroduce a hardcoded `tml_…` ID.

```bash
export SK=sk_test_xxx ACCT=acct_xxx
```

## Task 1 — Determine token scoping

Find the `/connection_token` handler. Report whether it mints on the **platform**
or a **connected** account (i.e. passes `StripeAccount`).

```bash
curl -G https://api.stripe.com/v1/terminal/locations -u $SK: -H "Stripe-Account: $ACCT"  # connected
curl -G https://api.stripe.com/v1/terminal/locations -u $SK:                             # platform
```

`{"data":[]}` = that account has no locations.

**Expected:** connected-scoped, since tips settle to each merchant's balance
(`/connect/balance`, `/connect/withdraw`). If it is platform-scoped, flag it —
that likely contradicts the payout model. Either fix the scoping, or drop
`Stripe-Account` everywhere below.

## Task 2 — Create one location (unblock testing)

```bash
curl https://api.stripe.com/v1/terminal/locations -u $SK: -H "Stripe-Account: $ACCT" \
  -d "display_name=Test Location" -d "address[line1]=123 Main St" \
  -d "address[city]=San Francisco" -d "address[state]=CA" \
  -d "address[postal_code]=94111" -d "address[country]=US"
```

**Done when:** response has `"id":"tml_…"` and `"livemode":false`. Do not copy the
ID anywhere — the app finds it. Tell me, and I will retry a tip.

## Task 3 — Automate per merchant

Task 2 fixes one account. Every merchant needs their own, or each hits this on
their first tip.

1. Add nullable `StripeLocationId` (string) to the user entity + migration.
2. `EnsureTerminalLocationAsync(user)`:
   - return `user.StripeLocationId` if set
   - else list locations on the connected account; reuse the first if any
   - else create from the merchant's stored address; store it
3. Call it where onboarding is marked complete (`/connect/status` or the
   `account.updated` webhook).

```csharp
var opts = new RequestOptions { StripeAccount = user.StripeAccountId };
var svc  = new Stripe.Terminal.LocationService();
var existing = await svc.ListAsync(new() { Limit = 1 }, opts);   // reuse if present
var loc = await svc.CreateAsync(new Stripe.Terminal.LocationCreateOptions {
    DisplayName = user.CompanyName ?? $"{user.FirstName} {user.LastName}",
    Address = new AddressOptions { Line1 = user.Address1, City = user.City,
        State = user.State, PostalCode = user.Zip, Country = "US" },
}, opts);
```

**Requirements:**
- **Idempotent** — safe on every status check/webhook, no duplicates. The
  list-first step is what guarantees this.
- Reuse the address collected at registration. No new user input.
- A location failure must not crash onboarding — log it; the next check retries.

**Done when:** a second test merchant onboards and gets a location, no manual step.

## Task 4 — Verify

1. Backend on test keys: `fly secrets list -a tippingontapbackend`
2. Location exists (Task 1 command; non-empty, `livemode:false`)
3. I retry a tip — location error gone
4. Same amount in all three: Stripe Dashboard → Payments (`succeeded`), app
   Wallet, app Home total

**If Stripe shows the payment but the wallet does not:** the location issue is
fixed and the bug moved to `/capture_payment_intent` not persisting. Report that
separately — not part of this task.

## Notes

- Test-mode locations do not carry to live. Repeat Task 2 with `sk_live_…`, or
  let Task 3 handle it.
- Backend assumed ASP.NET Core + Stripe.net + EF Core (from `ToDo.md`). If wrong,
  the curl still stands; translate the C#.
- Country assumed `US`. Verify all assumptions against the repo.
