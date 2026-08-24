# Let merchants collect tips before payouts are enabled

Prompts for Claude Code in the **mobile app** repo. The backend changes described
here have already landed in `tippingontapbackend`. Do tasks in order.

## Context

The client reported that merchants take a long time to get verified in Stripe. Part
of that is regulation and cannot be fixed. But a meaningful part was **self-inflicted
by this app**, and the backend has now been changed to remove it.

Stripe sets two independent flags on a connected account:

| Flag | Means | Arrives |
|---|---|---|
| `charges_enabled` | can take a card | as soon as identity is verified — often same day |
| `payouts_enabled` | can move money to a bank | later, after the bank account is verified separately |

`onboardingComplete` is **both of them together**. Gating on it means a merchant that
Stripe is perfectly willing to let trade is refused, and told to go finish paperwork,
while a customer stands in front of them waiting to tip.

**What changed on the backend:**

| Endpoint | Before | After |
|---|---|---|
| `POST /create_payment_intent` | required `onboardingComplete` | requires `charges_enabled` only |
| `GET /connect/balance` | required `onboardingComplete` | requires an account only; also returns `payoutsEnabled` |
| `POST /connect/withdraw` | required `onboardingComplete` **and** `payoutsEnabled` | requires `payoutsEnabled` (the redundant check was dropped) |
| `GET /connect/status` | returned 3 flags | also returns **`canCollectTips`** |

`onboardingComplete` still exists, still means "fully finished", and is still returned
by `/auth/*`, `/profile` and `/connect/status`. Its meaning has **not** changed — this
is backward compatible. Nothing below is required for the app to keep working; it is
required for the app to get the benefit.

**Money collected before payouts open is not lost.** Stripe holds it in the merchant's
balance and releases it when the bank account clears. That fact is the whole basis for
this change — and the reason Task 3 is not optional.

---

## The one thing that actually blocks this

`src/navigation/AppNavigator.tsx:134`

```tsx
{isAuthenticated && !onboardingComplete && <OnboardingNavigator />}
{isAuthenticated &&  onboardingComplete && <AuthenticatedNavigator />}
```

The **entire authenticated app** is behind `onboardingComplete`. A merchant with
`charges_enabled: true` and `payouts_enabled: false` never reaches the dashboard at
all, so it does not matter what any screen inside it checks.

Worth noting: `src/screens/dashboard/ActiveEventScreen.tsx:144` **already** gates on
`status.chargesEnabled` and already carries a comment explaining that
`payoutsEnabled` only gates withdrawal. That reasoning was correct. It is simply
unreachable, because the navigator refuses entry first.

So this is largely a one-line problem with a state-management tail.

---

## Task 1 — Track "can collect" separately from "fully onboarded"

`onboardingComplete` currently lives on the user object in `AuthContext`, is persisted
to AsyncStorage via `storage.saveUser`, and is set by `updateOnboardingStatus(true)`.

Add a second flag alongside it — `canCollectTips` — following the same pattern.

**The wrinkle to solve first:** `canCollectTips` comes from `GET /connect/status`. It
is **not** in the user payload returned by `/auth/*` or `/profile`, so on a cold start
the app does not know it yet. Two ways to handle that:

- **(a) App-side, no backend change.** Persist `canCollectTips` to AsyncStorage exactly
  as `onboardingComplete` already is, so a cold start renders from the stored value
  with no flicker, then call `/connect/status` on login and on resume to correct it.
  This mirrors the existing pattern and needs nothing new from the backend.

- **(b) Backend adds the flag to the auth payload.** Cleaner — the navigator would
  have the truth immediately on cold start with no extra round trip and no stored
  value to go stale. Requires a backend change that has **not** been made.

**Recommendation: (a).** It is a small extension of a pattern already in this file,
and `/connect/status` is cached server-side for 60s so the extra call is cheap. Ask
for (b) if the stored-value staleness turns out to matter in practice.

Files: `src/context/AuthContext.tsx` (state, `updateOnboardingStatus`, storage),
`src/services/storage.ts` if the persisted user shape is typed there.

## Task 2 — Let them into the app

`src/navigation/AppNavigator.tsx`

Switch the navigator gate from `onboardingComplete` to `canCollectTips`. There are now
three states, not two:

| State | Where they go |
|---|---|
| no account, or charges disabled | `OnboardingNavigator` — genuinely cannot trade |
| charges enabled, payouts disabled | `AuthenticatedNavigator` **+ the banner from Task 3** |
| both enabled | `AuthenticatedNavigator`, nothing special |

Do **not** delete `onboardingComplete` from context. Task 3 and Task 4 both need it,
and it is what distinguishes state 2 from state 3.

Also update the two places that flip the flag, so they react to the earlier signal
rather than waiting for full completion:

- `src/components/DeepLinkHandler.tsx:19` — `if (status.onboardingComplete)` fires when
  the merchant returns from Stripe. It should now also let them in on
  `status.canCollectTips`, or they bounce straight back to the onboarding screen at
  the exact moment they became able to trade.
- `src/screens/dashboard/OnboardingScreen.tsx:46` — the "Check My Status" handler has
  the same problem. `Setup not yet complete. Please finish in the browser.` is wrong
  and discouraging for someone who can already take money. Give them a third message:
  they are ready to collect, and the bank account is the remaining step.

## Task 3 — Tell them their money is being held

**This task is not optional.** Do not ship Task 2 without it.

Without it, a merchant taps ten cards, sees nothing they can withdraw, and no
explanation. That is a worse outcome than the slow signup this is meant to fix — we
would have traded a delay for an angry merchant who thinks the money vanished.

While `canCollectTips && !payoutsEnabled`, the app must persistently show:

1. that tips **are** being collected and are safe,
2. the balance being held,
3. that a verified bank account is the one remaining step,
4. a button that goes straight back into `POST /connect/onboard`.

A dismissible toast is not enough — it needs to still be there tomorrow. A standing
banner on the dashboard and the wallet screen is the obvious shape.

## Task 4 — Wallet screen

`src/screens/dashboard/WalletScreen.tsx`

Three changes:

- **Line 48** — `const balancePromise = onboardingComplete ? api.getConnectBalance() : ...`
  Fetch on `canCollectTips` instead. The merchant who most needs to see this number is
  precisely the one currently blocked from seeing it. The backend no longer refuses
  this call.
- **Line 158** — `{onboardingComplete ? ( ... balance card ... )}`. Render the card on
  `canCollectTips`. Do not hide a real balance.
- **Withdraw button** — keep it gated, but on `payoutsEnabled`, and make the disabled
  state explain itself rather than just greying out. `GET /connect/balance` now returns
  `payoutsEnabled` alongside `available` and `pending`, so the screen does not need to
  cross-reference another call.

## Task 5 — Update the API types

`src/services/api.ts`

- `getConnectStatus` (line ~365) — add `canCollectTips: boolean` to the return type.
- `getConnectBalance` (line ~371) — add `payoutsEnabled: boolean`.

Both are additive; nothing existing changes shape.

---

## Related quick win, while you are in there

`src/screens/dashboard/ActiveEventScreen.tsx:32`

```ts
const MERCHANT_FEE_PERCENT = 5;
```

The app hardcodes the platform fee and computes its own totals from it (lines 209 and
341). The backend is the authority on this and has returned `applicationFeePercent` on
`GET /connect/status` for a while now — the app just is not reading it.

The two numbers happen to agree today, so nothing is visibly broken. They will disagree
the moment the rate is changed on the backend, and the merchant will be shown a total
that is not what was charged. Since Tasks 1–5 already touch `getConnectStatus`, this is
close to free to fix now.

Strictly separate from the work above. Skip it if you want the change set narrow.

---

## Testing this

The awkward part: you cannot easily reach the "charges enabled, payouts disabled" state
on demand — it is a transient state of a real Stripe account.

Easiest is to fake the status response at the API layer while building the UI, then
confirm against a real account once one is mid-onboarding. In Stripe **test** mode you
can also create an account that has `card_payments` active with no external account
attached, which produces the same flag combination.

Check specifically:

- [ ] Cold start with a stored `canCollectTips: true` lands in the app, no flicker
      through the onboarding screen
- [ ] A merchant with charges only can complete a tip end to end
- [ ] The held-balance banner is visible on both dashboard and wallet, and survives a
      restart
- [ ] The withdraw button is disabled and **says why**
- [ ] `payouts_enabled` flipping true removes the banner and enables withdraw
- [ ] A merchant with no account still lands on `OnboardingNavigator`

---

## What this does not fix

Identity verification itself. There is no way to skip it — collecting card payments and
paying out to a bank account brings KYC/AML obligations that Stripe cannot waive and
neither can we. A merchant whose details do not match government records still goes
into document review, and that still takes days.

What this change does is stop **us** adding delay on top of Stripe's. Set the client's
expectations accordingly: the fast cases get much faster, the slow cases get better
explained but not much faster.

See `STRIPE_ONBOARDING_FRICTION.txt` in the backend repo for the full analysis,
including the prefill work already done server-side and the options that were
considered and rejected.
