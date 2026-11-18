# 0007. Authentication

Status: Accepted
Date: 2026-11-03

## Context

Source: Medplum's [Authentication Decision Guide](https://www.medplum.com/docs/decision-guides/authentication) and [Embedded Login](https://www.medplum.com/docs/auth/embedded-login). Population: patients.

- The guide names Medplum-managed authentication the best fit for patient-facing applications without an existing identity system.
- Medplum's own sample patient portal, Foo Medical, embeds the sign-in form in the app.
- Patient accounts belong to one project, so the sign-in request names the project. Every patient of the platform belongs to its one project ([0013](0013-one-account-many-sources.md)).
- With `resourceType: "Patient"` in the sign-in request, Medplum only considers patient memberships. A staff account gets "User not found" and no sign-in code (checked on a local Medplum server).
- Medplum's client keeps `isLoading()` true for good once a profile request fails: `refreshProfile` never clears `profilePromise` on failure ([`client.ts`](https://github.com/medplum/medplum/blob/main/packages/core/src/client.ts), 5.2.13 and `main`). An app that shows its loading screen whenever `loading` is true leaves a patient with an expired session, or a failed profile request after sign-in, on "Loading…" forever.
- Without the `offline_access` scope Medplum issues no refresh token ([`oauth/utils.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/oauth/utils.ts)), and its access tokens last one hour by default ([`oauth/keys.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/oauth/keys.ts)).

## Decision

- Medplum-managed email and password, embedded in the app: `startLogin` with the email, password, project and `resourceType: "Patient"`, then `processCode`. The SDK handles PKCE.
- Medplum, not the app, decides who may sign in.
- The SDK keeps the session in browser storage and restores it on reload. The app shows its loading screen only while that first restore runs, waiting on `getProfileAsync` rather than `loading`. A session that cannot be restored, because it expired or the server cannot be reached, leaves the patient on the sign-in page.
- While a sign-in is in progress, the sign-in page stays on screen, so an error at any step is shown. A sign-in that fails after the password is accepted leaves no session behind.
- Sign out with `signOut`, which revokes the token on the server. The session ends on this device even when the server cannot be reached to revoke it.
- No refresh token is requested, so a session lasts as long as Medplum's access token, one hour by default. After that the patient signs in again.
- Not supported: multi-factor authentication, email verification and choosing between several memberships. When Medplum asks for one of these steps, the app says that the account needs a sign-in step the portal does not support.

## Consequences

- The app is configured with the Medplum server's address and the platform project's identifier.
- Patients create their own accounts through open sign-up ([0013](0013-one-account-many-sources.md)), which uses the same email and password.
- Password recovery and multi-factor authentication each need their own decision before they are built.
- How long a patient stays signed in is a separate decision: a refresh token (`offline_access`) for longer sessions, and an idle timeout for shared computers.

## Alternatives considered

- **Redirect to a page Medplum hosts.** Not chosen: the sign-in screen would not follow the prototype's design. It stays the safer option for a deployment that requires the app never to handle passwords.
