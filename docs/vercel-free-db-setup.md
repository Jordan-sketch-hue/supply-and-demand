# Free Vercel Database Setup (Postgres)

This project is pre-wired for Vercel Functions + `@vercel/postgres`.

## 1. Create free database on Vercel
1. Push this repo to GitHub.
2. Import project into Vercel.
3. In Vercel project: `Storage` -> `Create` -> `Postgres`.
4. Choose the free tier.
5. Vercel injects environment variables automatically (`POSTGRES_URL`, etc.).

## 2. Set bootstrap secret
1. In project settings -> `Environment Variables` add:
- `BOOTSTRAP_KEY` = long random string.

## 3. Deploy and initialize tables
1. Deploy the project.
2. Run bootstrap once:

```bash
curl -X POST https://<your-deployment>/api/admin/bootstrap -H "x-bootstrap-key: <BOOTSTRAP_KEY>"
```

3. You should receive `{ "ok": true, "message": "Bootstrap completed." }`.

## 4. Verify API
- `GET /api/health`
- `GET /api/demand-search?q=I%20need%20a%20plumber`
- `GET /api/trending-demands`
- `POST /api/demand-request`

## 5. Connected pages
- `pages/search-demand.html` uses `/api/demand-search` and `/api/trending-demands`.
- `pages/post-request.html` uses `/api/demand-request`.

## Optional direct SQL
If you prefer SQL editor migration instead of API bootstrap, run `db/bootstrap.sql` in Vercel Postgres SQL console.
