## Frontend

**Code TODOs:**
- `usePayment.ts` — replace `'your_stripe_location_id'` with real value from client
- `api.ts` — replace `BASE_URL` with production backend URL

**Testing pending:**
- Real NFC tap test on physical Android device
- End to end payment flow with real card

---

## Backend


---

## Client Action Required
- Send Stripe Location ID (`tml_xxxxx`) from Stripe Dashboard → Terminal → Locations
- Confirm backend production URL so `BASE_URL` can be set

---

## Order to tackle

```
1. Run migrations
2. Register services in Program.cs
3. Test all backend endpoints with Postman
4. Replace all mock data on frontend screens with real API calls
5. Set BASE_URL + Location ID + MOCK_MODE = false
6. Test full NFC flow on real device
```