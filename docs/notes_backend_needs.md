# Backend Notes for Frontend

1. `GET /games/upcoming` is now available for upcoming match cards and team form context.
2. `POST /qa/ask` requires JWT auth; unauthenticated calls return `401`.
3. `GET /me` requires JWT auth; unauthenticated calls return `401`.
4. `POST /billing/create-checkout-session` and `POST /billing/checkout` still require JWT auth and return `401` when missing.
