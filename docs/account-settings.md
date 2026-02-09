# Account settings policy

## Logout

Logging out clears the session cookie and removes any local client state. Tokens are not reusable after logout because the cookie is invalidated server-side.

## Account deletion

When a user deletes their account, we apply the following data retention policy:

1. **Private artifacts** are permanently deleted, including their version history and media.
2. **Public artifacts** are **unpublished** (visibility switched to private) and de-identified:
   - titles/descriptions are scrubbed,
   - chat history is removed,
   - source session metadata is cleared.
3. **Profiles** are removed.
4. **User PII** (email, display name, auth providers) is scrubbed and a `deleted_at` timestamp is recorded.

This approach preserves safety for shared public content while ensuring that user identity and private artifacts are removed.

## Preferences

Preference updates (e.g., newsletter opt-in) are stored on the user record and returned with the account profile payload.
