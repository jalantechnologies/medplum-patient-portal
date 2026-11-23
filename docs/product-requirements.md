# Product requirements

This document describes what the Patient Portal does, for whom, and how each part is accepted as done. How it is built is recorded in the [decision records](decisions/README.md). Work is planned as GitHub issues, and each issue names the requirement it delivers, such as FR5.

## 1. Introduction

A patient's health record is split across every hospital and clinic they have visited. Each one has its own portal, its own sign-in, and only its own part of the record. A new doctor sees none of the rest, and the patient has no easy way to see it either.

The Patient Portal gives a patient one account for their whole record. The patient connects the hospitals and clinics they have visited, then sees their conditions, allergies, medicines, test results, visits, care plans, documents and bills in one place. Every record shows which hospital or clinic sent it, and when.

The portal is open source under the Apache License 2.0 and runs on [Medplum](https://www.medplum.com/), an open source platform for health data in the [FHIR](https://hl7.org/fhir/R4/) standard. A developer can run it, fork it and extend it. A clinic on Medplum can be one of the sources a patient connects.

The [design prototype](https://patientportal.jjalan.chatgpt.site/) shows the intended scope, screens and wording. Where this document and the prototype differ, this document applies.

## 2. Objectives

1. **One account.** A patient signs up once and signs in once to see records from every source they connect.
2. **Every record shows its source.** Each record names the hospital or clinic that sent it and when the portal received it. A test report also says when its source last updated it.
3. **The whole record.** Home, health profile, health records, medications, test results, appointments, care plans, documents, messages, bills and insurance, and the people who help with the patient's care.
4. **Clear for anyone.** Plain language, on a small phone or a computer, with a keyboard or a screen reader.
5. **Easy to run and extend.** A developer runs the portal locally with synthetic data in minutes and understands the code quickly.

## 3. Assumptions

- Patients live in the United States and read English.
- A patient uses a current web browser on a phone or a computer. Nothing is installed.
- A patient has an email address.
- Hospitals on certified electronic health record systems offer a patient-facing FHIR API, which an app the patient chooses may use at no charge to the app ([ONC (g)(10)](https://www.healthit.gov/test-method/standardized-api-patient-and-population-services), [45 CFR 170.404](https://www.law.cornell.edu/cfr/text/45/170.404)). These APIs let the patient read records. Booking and messages are available only where a clinic's own system allows them.
- Records arrive as FHIR R4. The portal shows what each source recorded. It does not merge records from different sources or change what a source recorded.
- One Medplum project holds every patient's account and records. Medplum's access policies keep each patient to their own records. Work that runs on a server, such as fetching records from a hospital, runs as [Medplum Bots](https://www.medplum.com/docs/bots).
- Demos, tests and screenshots use synthetic data only.

## 4. Personas

- **Patient (key persona).** Example: Eleanor Walsh, the synthetic patient used in this document and in the portal's example data. She is treated for eczema by Dr. Mira Chen at Oak Dermatology, has blood tests at Harbor Laboratory, sees Dr. Lena Park at Maple Dental, and had a flu vaccine at Pine Family Clinic. That is four places with four separate records. She wants to see everything in one place, know what is current, and prepare for her next visit. Medical terms and partial lists make that hard today.
- **Caregiver.** A person who helps with someone else's care, such as a parent managing a child's care or an adult helping an older parent. They need to see the record they are allowed to see, and nothing more.
- **Clinic.** A clinic on Medplum that is one of the patient's sources. It may offer booking and messages. Its clinical work stays in its own system.
- **Developer.** A developer who runs, forks or extends the portal. They need clear setup steps, synthetic data and code they can follow.

## 5. Use cases

### Scenario 1: Eleanor creates her account and finds her records

- **Persona:** Patient.
- **Context:** Eleanor opens the portal for the first time. Her records are at four places.
- **Steps:**
  1. She creates an account with her email and a password.
  2. She enters the details used to match her records: legal name, date of birth, sex recorded for matching, and address with ZIP code. No Social Security number is asked for.
  3. She authorizes the request for her records.
  4. She sees what was found, with a note that the record may not be complete or current.
  5. She adds her insurance details, or skips this step.
- **Expected outcome:** Home shows her records from the sources that were found, and each record names its source.

### Scenario 2: Eleanor prepares for a dermatology visit

- **Persona:** Patient.
- **Context:** Eleanor has a care review with Dr. Mira Chen at Oak Dermatology in a few days.
- **Steps:**
  1. Home shows the visit as her next step, with "Prepare for visit".
  2. She opens her eczema care plan and reads the plan and next steps.
  3. She sees that triamcinolone 0.1% cream is an active prescription at Oak Dermatology, and that her current use has not been confirmed with her.
  4. She writes her main concern and her questions for the visit.
- **Expected outcome:** Her preparation is saved and shared with the clinic where the clinic accepts it.

### Scenario 3: Eleanor reads a lab result

- **Persona:** Patient.
- **Context:** Harbor Laboratory has sent a vitamin D result.
- **Steps:**
  1. She opens Test results, then Lab results.
  2. She sees vitamin D at 24 ng/mL, the source's reference range of 30 to 100 ng/mL, and the source's flag "Low".
  3. She sees when the sample was collected, which laboratory sent the report, when the laboratory last updated it, and when the portal received it.
  4. She asks her care team about the result.
- **Expected outcome:** She understands the value and where it came from. The portal explains the reference range and does not diagnose.

### Scenario 4: Eleanor finds one record among many

- **Persona:** Patient.
- **Context:** Eleanor wants her dental records only, then her allergy record.
- **Steps:**
  1. In Health records, she picks Maple Dental under "All sources", and the list shows only records from Maple Dental.
  2. She searches for "penicillin" and finds her penicillin allergy, recorded by Oak Dermatology and not yet confirmed.
- **Expected outcome:** She finds a record by its source or by its name in a few seconds.

### Scenario 5: Eleanor connects a hospital

- **Persona:** Patient.
- **Context:** Eleanor was treated at a hospital whose records the portal does not have yet.
- **Steps:**
  1. In "Manage connections", she finds the hospital by name.
  2. She signs in at the hospital's own patient sign-in page and approves the portal's access.
  3. The hospital's records appear in her record, each with the hospital as its source.
  4. Later, she refreshes the connection, or disconnects it.
- **Expected outcome:** Her record includes the hospital's records, and she controls the connection.

### Scenario 6: A caregiver helps Eleanor

- **Persona:** Caregiver.
- **Context:** Eleanor wants a family member to help her book appointments.
- **Steps:**
  1. Eleanor invites the family member as a caregiver who helps with booking.
  2. The caregiver books a visit for Eleanor but cannot open her health record.
  3. Eleanor ends the caregiver's access.
- **Expected outcome:** The caregiver has the access Eleanor granted and nothing more, and loses it when Eleanor ends it.

### Scenario 7: A developer runs the portal

- **Persona:** Developer.
- **Context:** A developer wants to try the portal or build on it.
- **Steps:**
  1. They [run Medplum locally](https://www.medplum.com/docs/contributing/run-the-stack).
  2. They install the portal, load the example patient with `npm run load:example`, and start it with `npm run serve`.
  3. They sign in as Eleanor Walsh.
- **Expected outcome:** Eleanor's records from four sources appear on every page, each with its source.

## 6. Functional requirements

### Every page

These apply to every requirement below.

- **Source on every record.** Each record shows its source's name and when the portal received it ("Received"). A test report also shows when its source last updated it ("Source updated"); FHIR has no field for this on other kinds of record ([decision 0015](decisions/0015-naming-each-record-source.md)).
- **Narrow and find.** Every list of records offers "All sources", which narrows the list to one source. Health records, Medications and Test results also offer "Search records", which finds a record by its name.
- **Plain language.** Statuses say what they mean to a patient, such as "Active prescription in source" or "Not confirmed with you", not a code.
- **A record may be incomplete.** Wherever records are summed up, the page says that the record may not be complete or current.
- **Not medical advice.** The portal explains records and does not diagnose, prescribe or promise insurance coverage. Pages where a patient writes to someone say: "For a medical emergency, call 911."
- **Accessible.** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. Every page works with a keyboard and a screen reader.
- **Small screens.** Every page works from 320 pixels wide.
- **Times.** Every time is shown in the time zone of the patient who reads it.
- **Privacy.** A patient sees only their own records and the records they have been granted. Medplum's access policy enforces this, not filtering in the app. No patient data goes to logs, analytics or error reports.

### FR1: Account

- **Description:** A person creates their own account and signs in to it.
- **User flow:** "Create your account" with their name, an email and a password. Afterwards, sign in with the same email and password.
- **Options and sub-features:**
  - Password reset by email.
  - Multi-factor sign-in.
  - Sign-out after a period without activity.
- **Acceptance criteria:**
  - AC1: A new person signs up and lands on Home, which invites them to connect their records.
  - AC2: A patient signs in with their email and password, and a wrong password shows an error that does not say whether the email exists.
  - AC3: A patient who forgot their password resets it by email.
  - AC4: Each account sees only its own record.
- **Technical considerations:** Medplum's open patient registration, with the portal's access policy for patients ([decision 0007](decisions/0007-authentication.md), [decision 0010](decisions/0010-patient-access-policy.md), [decision 0013](decisions/0013-one-account-many-sources.md)).

### FR2: Connected records

- **Description:** The patient brings their records into the portal from each hospital and clinic, and manages those connections.
- **User flow:**
  1. "Match your records": legal name, date of birth, sex recorded for matching, and address with ZIP code.
  2. "Your permission": the patient authorizes the request and is told that the result may be incomplete. They can skip this step.
  3. "Available records": what was found.
  4. Later, from Home's "Connected records", "Manage connections" lists each source with when its records were last received, and lets the patient refresh or disconnect it.
- **Options and sub-features:**
  - A hospital the patient names: the patient signs in at the hospital and approves access. The first systems are Epic, then Oracle Health.
  - Records the patient does not know about, found through a national network. Option A is [TEFCA](https://rce.sequoiaproject.org/tefca/) Individual Access Services through a Qualified Health Information Network such as Health Gorilla. Option B is a records aggregator such as Metriport or Particle. The network is chosen before this work starts.
- **Acceptance criteria:**
  - AC1: A test patient in Epic's sandbox connects their hospital and sees its records, each with the hospital as its source.
  - AC2: Records from Epic's and Oracle Health's sandboxes show side by side.
  - AC3: Refreshing a connection brings in the source's new and changed records without copying any record twice.
  - AC4: After the patient disconnects a source, the portal sends that source no further requests. The records already received from it stay, each still naming its source, because the source stays on the patient's list of sources ([decision 0015](decisions/0015-naming-each-record-source.md)).
  - AC5: A patient finds records from a hospital they did not name, through the chosen network.
- **Technical considerations:** [SMART App Launch](https://hl7.org/fhir/smart-app-launch/) standalone patient launch to each system's patient API, with endpoints from the vendors' published lists ([Epic](https://open.epic.com/MyApps/Endpoints), [ONC Lantern](https://lantern.healthit.gov/)). A Bot fetches [US Core](https://hl7.org/fhir/us/core/) records and refreshes them. Each record keeps its source as [decision 0013](decisions/0013-one-account-many-sources.md) describes. Where connection tokens are kept is recorded in a decision before the first connection is built. Individual Access Services require identity proofing ([Epic on TEFCA Individual Access Services](https://open.epic.com/Home/Interoperate/TEFCA/IAS)).

### FR3: Home

- **Description:** One page that tells the patient where they stand and what to do next.
- **User flow:** After sign-in, Home shows, from top to bottom:
  1. A greeting with a one-line status, such as "Your skin-care review is next. One medicine needs confirmation.", and "Book appointment".
  2. Three summaries: current care (ongoing care plans), available sources, and the next visit.
  3. Next steps: "Prepare for visit" and "Review medication".
  4. Current care: each care plan with its clinic, date, clinician and status.
  5. The health profile, with a link to browse records.
  6. "Understand your records": questions for the assistant (FR14).
  7. Connected records: when records were last received, a note that the record may be incomplete, and "Manage connections".
- **Acceptance criteria:**
  - AC1: Eleanor sees "1 ongoing plan", "4 sources", and her next visit at Oak Dermatology.
  - AC2: Current care lists Eczema care (Oak Dermatology, Dr. Mira Chen, Active) and Dental checkup (Maple Dental, Dr. Lena Park, Completed).
  - AC3: Each next step opens the page where the patient completes it.

### FR4: Health profile

- **Description:** A summary of the patient's health, with a way into each kind of record.
- **User flow:**
  - "About you": the patient, whose record this is, the number of sources, and when records were last received.
  - "At a glance": current treatment, medicines whose current use needs confirmation, and allergies with whether each is confirmed.
  - "Health history": links to conditions, allergies, procedures, immunizations, measurements, family history and devices.
  - "What this summary means": a short explanation that a recorded status, a change the patient reported, and missing information are different things.
- **Acceptance criteria:**
  - AC1: Eleanor sees "4 available sources" and her penicillin allergy marked as unconfirmed.
  - AC2: Each link under "Health history" opens that kind of record in Health records.

### FR5: Health records

- **Description:** Every record, by kind, each with its source and dates.
- **User flow:** Tabs for All records, Conditions, Allergies, Procedures, Immunizations, Measurements, Family history and Devices, with "All sources" and "Search records". Each record shows its title, source, date, author and status, and "View record" opens its details.
- **Acceptance criteria:**
  - AC1: Allergies shows penicillin from Oak Dermatology as "Unconfirmed".
  - AC2: Immunizations shows the influenza vaccine from Pine Family Clinic.
  - AC3: Picking Maple Dental under "All sources" shows only Maple Dental's records.
  - AC4: Searching for "biopsy" finds the skin biopsy from Oak Dermatology.
- **Technical considerations:** "All sources" narrows a search with Medplum's `_source` search parameter ([advanced search parameters](https://www.medplum.com/docs/search/advanced-search-parameters)), given every address of the chosen source's `Organization`. A `_source` search matches the whole address exactly ([FHIR search](https://hl7.org/fhir/R4/search.html#uri)), which finds every record from that source because each import writes the source's address exactly ([decision 0013](decisions/0013-one-account-many-sources.md), rule 5).

### FR6: Medications

- **Description:** What each clinician prescribed, and what the patient actually takes, kept apart. The clinician confirms any change.
- **User flow:** Tabs for All medications, Current use to confirm and Past medications, with "All sources" and "Search records". Each prescription shows the medicine, the prescriber and clinic, its status at the source, the instructions, when it was prescribed, whether current use has been confirmed with the patient, and when it was received. Actions: "Report a change", "Original prescription" and "Help me understand".
- **Acceptance criteria:**
  - AC1: Eleanor sees triamcinolone 0.1% cream from Dr. Mira Chen at Oak Dermatology, "Active prescription in source", with "Current use: Not confirmed with you".
  - AC2: "Report a change" sends the change to the clinic's care team where the clinic accepts messages (FR11), and changes nothing in the source's record.
  - AC3: Searching for "cetiri" finds Eleanor's cetirizine from Pine Family Clinic and from Oak Dermatology, whose prescription names the medicine in a separate medicine record ([decision 0017](decisions/0017-searching-medications-in-the-browser.md)).

### FR7: Test results

- **Description:** Lab, imaging and other reports, with the source's own reference ranges.
- **User flow:** Tabs for Lab results, Imaging and Other reports, with "All sources" and "Search records". Each report shows its name, when it was collected, its source and status, and a table of results with the test, the result, the source's reference range and the flag. Actions: "Open source report", "Explain this result" and "Ask my care team".
- **Acceptance criteria:**
  - AC1: Eleanor sees vitamin D at 24 ng/mL, reference range 30 to 100 ng/mL, flagged "Low", from Harbor Laboratory, Final.
  - AC2: The page explains that a flag alone does not diagnose a condition, and that a result in range does not rule out all illness.

### FR8: Appointments

- **Description:** Visits from every source, and booking where a clinic allows it.
- **User flow:** Tabs for Upcoming, Past visits and Booking assistance. Each visit shows its kind, date and time with the time zone, clinician, clinic, address and status, and "Details & preparation". "Book appointment" asks: new or returning patient, who the visit is for, the reason, a time, the patient's details, then a confirmation.
- **Acceptance criteria:**
  - AC1: Eleanor sees her care review with Dr. Mira Chen at Oak Dermatology, with its address, as "Scheduled".
  - AC2: A patient books a visit at a synthetic clinic on Medplum and sees it under Upcoming.
  - AC3: A clinic that does not allow booking offers no booking.

### FR9: Care plans and referrals

- **Description:** What each care team recorded, the next steps, and earlier care.
- **User flow:** Tabs for Current plans, Past plans, Goals, Referrals & orders and Care team. Each plan shows its title, clinic, clinician and status, its plan and next steps, its dates and source, "Ask about this plan" and "View record".
- **Acceptance criteria:**
  - AC1: Eleanor sees Eczema care from Oak Dermatology under Current plans, and Dental checkup from Maple Dental under Past plans.
  - AC2: Care team lists Dr. Mira Chen at Oak Dermatology and Dr. Lena Park at Maple Dental.

### FR10: Documents

- **Description:** Original notes, reports and imported documents.
- **User flow:** Tabs for All documents, Visit notes, Reports and Imported, with "All sources". Each document shows its title, source, date, author and status, and opens the original.
- **Acceptance criteria:**
  - AC1: A patient opens a document from each source and sees its source, date and author.

### FR11: Messages and visit preparation

- **Description:** Questions for a care team, kept apart from the assistant, and forms to prepare for a visit.
- **User flow:** "New message" writes to the care team at a clinic that accepts messages, about a plan, visit, result or bill. Replies arrive in the same conversation. "Forms & visit preparation" asks for the main concern and any questions for the visit.
- **Acceptance criteria:**
  - AC1: A patient sends a message to a synthetic clinic and sees the reply.
  - AC2: A clinic that does not accept messages offers no way to write to it.
  - AC3: A patient saves their preparation for a visit and finds it again from the visit.

### FR12: Bills and insurance

- **Description:** What each practice says the patient owes, and the patient's insurance. The portal collects no payments.
- **User flow:** Tabs for Bills, Insurance, Claims & benefits and Payments. Bills shows the total due to practices and each practice's statements with the statement number, service date, amount due and status. Insurance details may be added at sign-up or later, by checking a known plan with its payer and member ID.
- **Acceptance criteria:**
  - AC1: A patient sees the amount due to each practice and the statement behind it.
  - AC2: The page explains that an insurer's explanation of benefits is not a bill, and that eligibility is not a guarantee of payment.
  - AC3: A patient finishes sign-up without insurance details.

### FR13: People and access

- **Description:** The account owner, the patient and the people who help with the patient's care are kept apart.
- **User flow:** The account owner and their access, "Invite a caregiver", "Manage a child's care", and the access rules. A patient switcher in the header, such as "Eleanor Walsh · My record", moves between the records the account may open.
- **Acceptance criteria:**
  - AC1: A caregiver opens a patient's record when the patient has granted it, and only then.
  - AC2: Help with booking does not give access to the record.
  - AC3: When access ends, the caregiver loses it at once.
- **Technical considerations:** Who may open a child's record depends on context, such as the child's age and the state's law. The rules are recorded in a decision before this work starts.

### FR14: Assistant

- **Description:** The patient asks about their own record and sees the records and dates behind each answer.
- **User flow:** "Ask assistant" in the header, and suggested questions on Home such as "What is my current treatment plan?", "Explain my latest lab result" and "What should I ask my doctor?". Each answer lists the records it used, and the assistant shows how many records it can see and when they were last received.
- **Acceptance criteria:**
  - AC1: Eleanor asks "What is my current treatment plan?" and the answer names Eczema care and triamcinolone 0.1% cream, each with its date and a link to the record.
  - AC2: The assistant states that it does not diagnose, prescribe or guarantee coverage, that no care team reads it, and that a medical emergency needs a call to 911.
- **Technical considerations:** The model, where it runs and what patient data it may receive are recorded in a decision before this work starts.

## 7. Out of scope

- Collecting payments.
- Native mobile apps. The web app works on phones.
- Screens for clinicians, who work in their own systems.
- Changing a source's records. A patient reports a change, and the source decides.

## 8. Glossary

- **Source:** a hospital, clinic or laboratory that sent a record.
- **FHIR:** the standard format for health records that the portal reads ([FHIR R4](https://hl7.org/fhir/R4/)).
- **Medplum:** the open source platform the portal runs on. It stores the records and controls who may read them.
- **Bot:** a small program that runs on the Medplum server, such as one that fetches records from a hospital.
- **SMART App Launch:** the standard way a patient signs in at a hospital and lets an app read their records.
- **US Core:** the set of FHIR rules that US health record systems follow for patient records.
- **TEFCA:** the national framework through which health networks in the United States exchange records.
