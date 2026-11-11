import type { SearchRequest } from "@medplum/core";
import type {
  Appointment,
  AppointmentParticipant,
  CarePlan,
  MedicationRequest,
  Observation,
  ResourceType,
  TimingRepeat,
} from "@medplum/fhirtypes";

export const RESOURCE_TYPE = {
  ALLERGY_INTOLERANCE: "AllergyIntolerance",
  APPOINTMENT: "Appointment",
  CARE_PLAN: "CarePlan",
  CONDITION: "Condition",
  MEDICATION: "Medication",
  MEDICATION_REQUEST: "MedicationRequest",
  OBSERVATION: "Observation",
  PATIENT: "Patient",
} as const satisfies Record<string, ResourceType>;

export const APPOINTMENT_STATUS = {
  ARRIVED: "arrived",
  BOOKED: "booked",
  CANCELLED: "cancelled",
  CHECKED_IN: "checked-in",
  ENTERED_IN_ERROR: "entered-in-error",
  FULFILLED: "fulfilled",
  NO_SHOW: "noshow",
  PENDING: "pending",
  PROPOSED: "proposed",
  WAITLIST: "waitlist",
} as const satisfies Record<string, Appointment["status"]>;

export const APPOINTMENT_PARTICIPANT_STATUS = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
  NEEDS_ACTION: "needs-action",
  TENTATIVE: "tentative",
} as const satisfies Record<string, AppointmentParticipant["status"]>;

export const CARE_PLAN_INTENT = {
  OPTION: "option",
  ORDER: "order",
  PLAN: "plan",
  PROPOSAL: "proposal",
} as const satisfies Record<string, CarePlan["intent"]>;

export const CARE_PLAN_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  DRAFT: "draft",
  ENTERED_IN_ERROR: "entered-in-error",
  ON_HOLD: "on-hold",
  REVOKED: "revoked",
  UNKNOWN: "unknown",
} as const satisfies Record<string, CarePlan["status"]>;

export const MEDICATION_REQUEST_INTENT = {
  FILLER_ORDER: "filler-order",
  INSTANCE_ORDER: "instance-order",
  OPTION: "option",
  ORDER: "order",
  ORIGINAL_ORDER: "original-order",
  PLAN: "plan",
  PROPOSAL: "proposal",
  REFLEX_ORDER: "reflex-order",
} as const satisfies Record<string, MedicationRequest["intent"]>;

export const MEDICATION_REQUEST_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  DRAFT: "draft",
  ENTERED_IN_ERROR: "entered-in-error",
  ON_HOLD: "on-hold",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
} as const satisfies Record<string, MedicationRequest["status"]>;

export const MEDICATION_REQUEST_ELEMENT = {
  DO_NOT_PERFORM: "doNotPerform",
} as const satisfies Record<string, keyof MedicationRequest>;

export const OBSERVATION_STATUS = {
  AMENDED: "amended",
  CANCELLED: "cancelled",
  CORRECTED: "corrected",
  ENTERED_IN_ERROR: "entered-in-error",
  FINAL: "final",
  PRELIMINARY: "preliminary",
  REGISTERED: "registered",
  UNKNOWN: "unknown",
} as const satisfies Record<string, Observation["status"]>;

export const CODE_SYSTEM = {
  ALLERGY_INTOLERANCE_CLINICAL:
    "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  ALLERGY_INTOLERANCE_VERIFICATION:
    "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
  CONDITION_CLINICAL:
    "http://terminology.hl7.org/CodeSystem/condition-clinical",
  CONDITION_VERIFICATION:
    "http://terminology.hl7.org/CodeSystem/condition-ver-status",
  OBSERVATION_CATEGORY:
    "http://terminology.hl7.org/CodeSystem/observation-category",
} as const;

export const OBSERVATION_CATEGORY = {
  LABORATORY: "laboratory",
  VITAL_SIGNS: "vital-signs",
} as const;

export const CONDITION_CLINICAL_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  RECURRENCE: "recurrence",
  RELAPSE: "relapse",
  REMISSION: "remission",
  RESOLVED: "resolved",
} as const;

export const CONDITION_VERIFICATION_STATUS = {
  CONFIRMED: "confirmed",
  DIFFERENTIAL: "differential",
  ENTERED_IN_ERROR: "entered-in-error",
  PROVISIONAL: "provisional",
  REFUTED: "refuted",
  UNCONFIRMED: "unconfirmed",
} as const;

export const ALLERGY_INTOLERANCE_CLINICAL_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  RESOLVED: "resolved",
} as const;

export const ALLERGY_INTOLERANCE_VERIFICATION_STATUS = {
  CONFIRMED: "confirmed",
  ENTERED_IN_ERROR: "entered-in-error",
  REFUTED: "refuted",
  UNCONFIRMED: "unconfirmed",
} as const;

export const SEARCH_PARAMETER = {
  AUTHORED_ON: "authoredon",
  CATEGORY: "category",
  CLINICAL_STATUS: "clinical-status",
  DATE: "date",
  ID: "_id",
  INTENT: "intent",
  PATIENT: "patient",
  RECORDED_DATE: "recorded-date",
  STATUS: "status",
  SUBJECT: "subject",
  VERIFICATION_STATUS: "verification-status",
} as const;

export const TIMING_PERIOD_UNIT = {
  DAY: "d",
} as const satisfies Record<string, TimingRepeat["periodUnit"]>;

export const SEARCH_VALUE_SEPARATOR = ",";

export const BUNDLE_LINK_RELATION = {
  NEXT: "next",
} as const;

export const CONTAINED_REFERENCE_PREFIX = "#";

export const SEARCH_TOTAL = {
  ACCURATE: "accurate",
  ESTIMATE: "estimate",
  NONE: "none",
} as const satisfies Record<string, NonNullable<SearchRequest["total"]>>;
