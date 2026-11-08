# Meetwise client

React/Vite frontend for the existing Meeting Action API. The client uses the backend's bearer-token contract and does not define refresh-token or additional backend routes.

## Run locally

Start the existing Node API on port 5000. From this directory:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL (`http://localhost:5173`). `VITE_API_URL` defaults to `http://localhost:5000/api`. Keep the dev origin as `localhost` to match the backend's default CORS origin. For a production bundle, run `npm run build`; use `npm run preview` to serve the generated `dist` folder locally.

## Existing API contracts used

- `POST /auth/register`: `{ name, email, password }` → `{ user, token }`
- `POST /auth/login`: `{ email, password }` → `{ user, token }`
- `GET /auth/me`: bearer token → `{ user }`
- `GET /meetings?page=1&limit=5` → `{ pagination, meetings }`
- `GET /tasks?page=1&limit=5` → `{ pagination, tasks }`
- `GET /tasks/stats` → `{ stats }`

The backend requires `Authorization: Bearer <token>`. The client stores that token in `localStorage`, checks it against `/auth/me` on page load, and clears it on a 401. There is no refresh-token endpoint. Dashboard figures and recent records come from the authenticated list/stat endpoints; empty states are shown when the account has no data.

## Browser authentication checks

1. Ensure MongoDB Atlas is reachable and the API is running.
2. Open `/register`, create an account, and confirm the dashboard opens.
3. Refresh the page; the app should request `/auth/me` and restore the session.
4. Open `/login` in a private/incognito window or sign out first, then sign in with the same credentials.
5. In DevTools Network, confirm protected requests include `Authorization: Bearer …` and that `/auth/me` returns `{ "user": ... }`.
6. Sign out from the sidebar; the app clears the token and redirects to `/login`. A rejected/expired token is also cleared on the next protected request.
