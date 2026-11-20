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
- Medplum creates a patient's own account in two requests ([`auth/newuser.ts`](https://github.com/medplum/medplum/blob/v5.2.18/packages/server/src/auth/newuser.ts), [`auth/newpatient.ts`](https://github.com/medplum/medplum/blob/v5.2.18/packages/server/src/auth/newpatient.ts)). `startNewUser` creates the user, from a first and a last name of 1 to 128 characters each, which Medplum requires, an email and a password. `startNewPatient` then creates their `Patient` and their project membership, with the project's `Patient` default access policy, and returns a sign-in code. Medplum's own `RegisterForm` takes the same steps. From Medplum 5.2.18, a project allows this only when its `openPatientRegistration` setting is on ([0010](0010-patient-access-policy.md)).
- When the second request fails, the user exists without a patient record. Asking again from the start only gets "Email already registered", and signing in finds no patient membership. Medplum's client sends a request that cannot reach the server up to three times before it gives up (`maxRetries`, 2 by default, in [`client.ts`](https://github.com/medplum/medplum/blob/v5.2.18/packages/core/src/client.ts)), so this happens only when the server stays out of reach or refuses.
- `startNewPatient` names the patient from the first and last name stored with the user, not from its own request. For a login that already has its patient record, it answers "Login already has a membership". Medplum's client can get that answer to its own retry, when the server created the record but its first answer was lost.
- Medplum checks the email and the password (at least 8 characters, and not in a list of breached passwords), and names the field that each reason belongs to.
- A Medplum server with a reCAPTCHA secret, such as Medplum's hosted service, refuses `startNewUser` without a reCAPTCHA token. Checked on the hosted service with a project that does not exist, which creates nothing. A local server has no secret unless one is configured.

## Decision

- Medplum-managed email and password, embedded in the app: `startLogin` with the email, password, project and `resourceType: "Patient"`, then `processCode`. The SDK handles PKCE.
- Medplum, not the app, decides who may sign in.
- The SDK keeps the session in browser storage and restores it on reload. The app shows its loading screen only while that first restore runs, waiting on `getProfileAsync` rather than `loading`. A session that cannot be restored, because it expired or the server cannot be reached, leaves the patient on the sign-in page.
- While a sign-in is in progress, the sign-in page stays on screen, so an error at any step is shown. A sign-in that fails after the password is accepted leaves no session behind.
- Sign out with `signOut`, which revokes the token on the server. The session ends on this device even when the server cannot be reached to revoke it.
- No refresh token is requested, so a session lasts as long as Medplum's access token, one hour by default. After that the patient signs in again.
- Not supported: multi-factor authentication, email verification and choosing between several memberships. When Medplum asks for one of these steps, the app says that the account needs a sign-in step the portal does not support.
- A person creates their own account on "Create your account", linked from the sign-in page: a first name, a last name, an email and a password. The portal calls `startNewUser` and `startNewPatient`, then signs the person in with the code as sign-in does, and the public route guard takes them to Home.
- The portal checks only that each field is filled in and that the email is well formed. Medplum's own reasons, such as a password that is too short or found in a breach, are shown under the field they name, and any other reason in the alert above the form.
- Once Medplum has created the user, the form keeps the identifier Medplum gave it, in the page only and never stored, and its fields become read-only, since the user already holds those details. When any later step fails, the alert says that the account is created but the person is not signed in yet, with the reason. Every later "Continue" creates only the patient record. When Medplum answers that the login already has a membership, the record exists, so the portal signs the person in with the email and password on the form.
- Sign-up is shown only when the portal's `VITE_SIGN_UP_ENABLED` setting is `true`. It is off by default, as open registration is off by default in Medplum, and a link that Medplum refuses would lead nowhere.
- The portal sends no reCAPTCHA token yet; adding one is its own change.

## Consequences

- The app is configured with the Medplum server's address and the platform project's identifier.
- Patients create their own accounts through open sign-up ([0013](0013-one-account-many-sources.md)), which uses the same email and password.
- Password recovery and multi-factor authentication each need their own decision before they are built.
- How long a patient stays signed in is a separate decision: a refresh token (`offline_access`) for longer sessions, and an idle timeout for shared computers.
- Sign-up does not work on a Medplum server that requires reCAPTCHA, Medplum's hosted service included, until the portal sends a token.
- Anyone who knows the project's identifier can create an account, also through Medplum's API, and no one confirms that the email belongs to them.
- A person who leaves the page before their patient record exists cannot finish signing up: "Continue" answers "Email already registered", and signing in finds no patient membership. Only a project admin can fix the account in Medplum.
- A name typed wrong cannot be corrected once the user exists, since Medplum names the patient from the user.

## Alternatives considered

- **Redirect to a page Medplum hosts.** Not chosen: the sign-in screen would not follow the prototype's design. It stays the safer option for a deployment that requires the app never to handle passwords.
- **Medplum's `RegisterForm`** from `@medplum/react`. Not chosen: it is built on Mantine, not Base Web ([0002](0002-base-web-for-the-ui.md)), and it leaves a new user without a patient record when the second request fails.
- **A second password field to type it again**, as Better's template has. Not chosen: the prototype shows the password with a button to reveal it instead.
- **Comparing the details on each "Continue" after a failure, and starting over when they changed.** Not chosen: Medplum keeps the names stored with the user, so a corrected name would be dropped without a word, and it refuses a second user for the same email, so a changed password or email would lock the person out of an account without a patient record.
