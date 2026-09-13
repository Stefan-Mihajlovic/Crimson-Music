# Audius profile editing

Open **Account → Profile → Edit** to change the display name or photo. The shared editor also opens from the Home profile route on iOS, Android, and web. The handle remains read-only.

Photo selection only changes the draft preview. **Save changes** uploads a chosen photo to Audius storage, then sends the edited fields to the authenticated Audius `PUT /users/{id}` endpoint. The client uses the existing OAuth `write` session. A read-only session can reconnect through the existing Audius login flow.

Photos use the system picker on mobile and a file chooser on web, with a 10 MB application limit. Mobile offers square cropping; Audius's `img_square` template generates the profile sizes. Native uploads use an `expo-file-system` File: Expo 57's fetch cannot serialize React Native's older `{ uri, name, type }` multipart objects. Storage requests contain no OAuth token. Upload polling stays on the original storage node and upload ID, retries transient failures within a deadline, and does not automatically resend the photo.

After Audius confirms the write, Crimson persists the updated account, refreshes its displayed name/photo, and invalidates cached catalog data. It sends only changed profile fields, preserving the bio, cover, links, and handle. Session checks prevent a pending save from updating a different account, and older profile reads or token rotations cannot undo a confirmed edit.

The form retains the draft on failure and disables saving when offline, unchanged, invalid, or already busy. Cancel leaves the account unchanged.

## Validation

- Service integration tests cover native File and web File uploads, partial metadata updates, storage failures and polling, server confirmation, duplicate saves, and account changes during requests.
- Serializer regression tests pass the production multipart form through the installed Expo serializer, verify actual image bytes, and reproduce the rejected legacy URI format. Native file reads are mocked; the FormData implementation and serializer are real. A separate live smoke upload of the serialized generic app icon returned HTTP 200 with processing status `done`.
- Editor tests cover draft selection/cancellation, explicit saving, retry, offline/read-only states, account changes, and oversized photos.
- Session/auth tests cover stale refreshes and preference reads, token rotation overlapping a save, and account isolation.

These tests mock external writes; they do not change a real listener's public Audius profile.

## Protocol references

- [Audius user API and upload mapping](https://github.com/AudiusProject/apps/blob/main/packages/sdk/src/sdk/api/users/UsersApi.ts)
- [Audius OpenAPI schema](https://github.com/AudiusProject/apps/blob/main/packages/docs/docs/public/openapi.yaml)
- [Audius storage image uploads](https://github.com/OpenAudio/go-openaudio/blob/main/pkg/mediorum/server/serve_upload.go)
