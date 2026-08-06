# Firebase credentials

Prefer setting these in `.env` (never commit real values):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (quoted, with `\n` escapes)

Optional fallback: `FIREBASE_SERVICE_ACCOUNT_PATH` pointing to a local
`*-firebase-adminsdk-*.json` file (gitignored).
