# 0011. How shared data behaves across pages

Status: Accepted
Date: 2026-11-11

## Context

Pages read the patient's record through providers and contexts ([AGENTS.md](../../AGENTS.md), "Data flows service → provider → context → page"). Each provider holds its results through `useAsynchronousResult`. What a page shows while a result loads, fails or comes back affects every page that reads it, and a rule that holds for one page can fail for the next page that reads the same provider. This record states the design in one place, so that new code is checked against it before review.

Facts that shape it:

- Three providers wrap the whole signed-in layout, because Home reads them and must not show "Loading…" on every return: `CarePlanProvider`, `AppointmentProvider` and `RecordSourceProvider`. They outlive the pages that read them, and other pages read them too, such as Health profile.
- The other providers (`ConditionProvider`, `AllergyIntoleranceProvider`, `ProcedureProvider`, `ObservationProvider`, `MedicationRequestProvider` and `DiagnosticReportProvider`) sit on their page's route, so they mount and unmount with it.
- React renders a page before it runs that page's effects, and runs the leaving page's effect cleanups after the next page's first render. Anything decided in an effect is one render too late for what the page shows first.
- A failure is not always a new error object: `AsynchronousOperationError.fromUnknown` passes an `AsynchronousOperationError` through unchanged, so a request that fails with an error object already seen looks like the earlier failure. Only the request tells two failures apart.

## Decision

1. **The last answer stays on screen.** While a provider asks again, and after that request fails, it keeps its last answer.
2. **Loading means no answer yet.** A result is loading until its first answer or a failure. An empty answer, such as no visit booked, is an answer (`hasAnswer`).
3. **A list fails only when nothing is listed.** A failed "Show more" keeps the records already listed and retries the page that failed.
4. **A page never shows a failure from before it arrived.** The decision is made while the page renders, not in an effect: `useAsynchronousResult` numbers each request it starts, and `useReader` keeps the number of the latest request at the page's first render and shows only the failures of requests numbered after it. So a page shows only the failures of requests made after it arrived, and its loading state follows from that and `hasAnswer`. Each page asks again when it arrives, so its own request always counts. A provider that outlives pages hands its context the result's state as it is (`AsynchronousResultState`), and only its context hook, through `useReader`, turns that into what a page shows; pages never forget a failure by hand.
5. **Only the latest request counts.** An answer or a failure from an earlier request is ignored once a newer one has started.
6. **"Try again" asks again only for what failed.**

## Consequences

- A new page can read a layout provider with no code of its own for stale failures, as Health profile does.
- A change to `useAsynchronousResult`, `useReader` or a provider is checked, before its pull request, against every page that reads it and against the next page planned to read it.
- Rule 4 relies on each page asking again when it arrives, as every page does. A component that reads a layout provider without asking, opened beside a page after that page's request failed, would show "Loading…" instead of the failure, because the failure came before it arrived. Telling it apart from a page that arrives after navigation takes an effect that counts readers, which rule 4 rules out.
- A component that stays mounted and reads a layout provider, such as the layout itself, shows every failure that comes after it mounted, until the next request clears it.

## Alternatives considered

- **Providers on each page's route.** Not chosen: Home would show "Loading…" on every return.
- **Counting readers in effects and forgetting the failure when the last one leaves.** Not chosen: the leaving page's cleanup runs after the next page's first render, so a page that reads the same provider shows the old failure once.
- **Forgetting in a layout effect.** Not chosen: it runs before the browser paints, but the old banner is still inserted into the page and removed again, which a screen reader or a test can catch.
- **Keeping the failure object the provider held at the page's first render, and comparing failures by identity.** Not chosen: it needs no number in the state, but a request that fails with an error object already seen is hidden as the earlier failure, and nothing in the code guarantees a new object. Request numbers add one field to the result's state and nothing to the contexts of providers on a page's route.
- **Each page forgetting failures by hand.** Not chosen: every new page would have to remember to do it, and a page that forgot would show a stale failure.
