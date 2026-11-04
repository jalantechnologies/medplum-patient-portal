import type { SearchRequest } from "@medplum/core";
import type {
  Appointment,
  AppointmentParticipant,
  CarePlan,
  ResourceType,
} from "@medplum/fhirtypes";

export const RESOURCE_TYPE = {
  APPOINTMENT: "Appointment",
  CARE_PLAN: "CarePlan",
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

export const SEARCH_PARAMETER = {
  DATE: "date",
  PATIENT: "patient",
  STATUS: "status",
  SUBJECT: "subject",
} as const;

export const SEARCH_TOTAL = {
  ACCURATE: "accurate",
  ESTIMATE: "estimate",
  NONE: "none",
} as const satisfies Record<string, NonNullable<SearchRequest["total"]>>;
