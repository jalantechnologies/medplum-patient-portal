import type { SearchRequest } from "@medplum/core";
import type {
  Appointment,
  AppointmentParticipant,
  CarePlan,
  DiagnosticReport,
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
  DIAGNOSTIC_REPORT: "DiagnosticReport",
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

export const DIAGNOSTIC_REPORT_STATUS = {
  AMENDED: "amended",
  APPENDED: "appended",
  CANCELLED: "cancelled",
  CORRECTED: "corrected",
  ENTERED_IN_ERROR: "entered-in-error",
  FINAL: "final",
  PARTIAL: "partial",
  PRELIMINARY: "preliminary",
  REGISTERED: "registered",
  UNKNOWN: "unknown",
} as const satisfies Record<string, DiagnosticReport["status"]>;

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
  DIAGNOSTIC_SERVICE_SECTION: "http://terminology.hl7.org/CodeSystem/v2-0074",
  LOINC: "http://loinc.org",
  OBSERVATION_CATEGORY:
    "http://terminology.hl7.org/CodeSystem/observation-category",
  OBSERVATION_INTERPRETATION:
    "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
  OBSERVATION_INTERPRETATION_VERSION_TWO:
    "http://terminology.hl7.org/CodeSystem/v2-0078",
} as const;

export const CODE_SYSTEM_CONCEPT_PROPERTY = {
  NOT_SELECTABLE: "notSelectable",
  STATUS: "status",
} as const;

export const OBSERVATION_INTERPRETATION = {
  ABNORMAL: { code: "A", display: "Abnormal" },
  ABOVE_HIGH_THRESHOLD: { code: "HX", display: "Above high threshold" },
  ANTI_COMPLEMENTARY_SUBSTANCES_PRESENT: {
    code: "AC",
    display: "Anti-complementary substances present",
  },
  BELOW_LOW_THRESHOLD: { code: "LX", display: "Below low threshold" },
  BETTER: { code: "B", display: "Better" },
  CARRIER: { code: "CAR", display: "Carrier" },
  CRITICAL_ABNORMAL: { code: "AA", display: "Critical abnormal" },
  CRITICAL_HIGH: { code: "HH", display: "Critical high" },
  CRITICAL_LOW: { code: "LL", display: "Critical low" },
  CYTOTOXIC_SUBSTANCE_PRESENT: {
    code: "TOX",
    display: "Cytotoxic substance present",
  },
  DEPRECATED_CARRIER: { code: "Carrier", display: "Carrier" },
  DEPRECATED_SIGNIFICANTLY_HIGH: { code: "H>", display: "Significantly high" },
  DEPRECATED_SIGNIFICANTLY_LOW: { code: "L<", display: "Significantly low" },
  DETECTED: { code: "DET", display: "Detected" },
  EQUIVOCAL: { code: "E", display: "Equivocal" },
  EXPECTED: { code: "EXP", display: "Expected" },
  HIGH: { code: "H", display: "High" },
  HOLD_FOR_MEDICAL_REVIEW: { code: "HM", display: "Hold for Medical Review" },
  INDETERMINATE: { code: "IND", display: "Indeterminate" },
  INSUFFICIENT_EVIDENCE: { code: "IE", display: "Insufficient evidence" },
  INTERMEDIATE: { code: "I", display: "Intermediate" },
  LOW: { code: "L", display: "Low" },
  MODERATELY_SUSCEPTIBLE: { code: "MS", display: "Moderately susceptible" },
  NEGATIVE: { code: "NEG", display: "Negative" },
  NO_CLSI_DEFINED_BREAKPOINT: {
    code: "NCL",
    display: "No CLSI defined breakpoint",
  },
  NON_REACTIVE: { code: "NR", display: "Non-reactive" },
  NON_SUSCEPTIBLE: { code: "NS", display: "Non-susceptible" },
  NORMAL: { code: "N", display: "Normal" },
  NOT_DETECTED: { code: "ND", display: "Not detected" },
  OFF_SCALE_HIGH: { code: ">", display: "Off scale high" },
  OFF_SCALE_LOW: { code: "<", display: "Off scale low" },
  OUTSIDE_THRESHOLD: { code: "EX", display: "Outside threshold" },
  POSITIVE: { code: "POS", display: "Positive" },
  QUALIFIERS_IN_SEPARATE_SEGMENTS: {
    code: "OBX",
    display: "Interpretation qualifiers in separate OBX segments",
  },
  QUALITY_CONTROL_FAILURE: { code: "QCF", display: "Quality control failure" },
  REACTIVE: { code: "RR", display: "Reactive" },
  RESISTANT: { code: "R", display: "Resistant" },
  SIGNIFICANT_CHANGE_DOWN: { code: "D", display: "Significant change down" },
  SIGNIFICANT_CHANGE_UP: { code: "U", display: "Significant change up" },
  SIGNIFICANTLY_HIGH: { code: "HU", display: "Significantly high" },
  SIGNIFICANTLY_LOW: { code: "LU", display: "Significantly low" },
  SUSCEPTIBLE: { code: "S", display: "Susceptible" },
  SUSCEPTIBLE_DOSE_DEPENDENT: {
    code: "SDD",
    display: "Susceptible-dose dependent",
  },
  SYNERGY_RESISTANT: { code: "SYN-R", display: "Synergy - resistant" },
  SYNERGY_SUSCEPTIBLE: { code: "SYN-S", display: "Synergy - susceptible" },
  UNEXPECTED: { code: "UNE", display: "Unexpected" },
  VERY_SUSCEPTIBLE: { code: "VS", display: "Very susceptible" },
  WEAKLY_REACTIVE: { code: "WR", display: "Weakly reactive" },
  WORSE: { code: "W", display: "Worse" },
} as const satisfies Record<string, { code: string; display: string }>;

export const OBSERVATION_INTERPRETATION_VERSION_TWO = {
  NO_RANGE_DEFINED: {
    code: "null",
    display: "No range defined, or normal ranges don't apply",
  },
} as const satisfies Record<string, { code: string; display: string }>;

export const OBSERVATION_CATEGORY = {
  LABORATORY: "laboratory",
  VITAL_SIGNS: "vital-signs",
} as const;

export const DIAGNOSTIC_REPORT_KIND = {
  IMAGING: "imaging",
  LABORATORY: "laboratory",
  OTHER: "other",
} as const;

export const LABORATORY_SERVICE_SECTION = {
  BLOOD_BANK: "BLB",
  BLOOD_GASES: "BG",
  CHEMISTRY: "CH",
  CYTOGENETICS: "CG",
  CYTOPATHOLOGY: "CP",
  GENETICS: "GE",
  HEMATOLOGY: "HM",
  IMMUNOLOGY: "IMM",
  LABORATORY: "LAB",
  MICROBIOLOGY: "MB",
  MYCOBACTERIOLOGY: "MCB",
  MYCOLOGY: "MYC",
  OUTSIDE_LABORATORY: "OSL",
  PARASITOLOGY: "PAR",
  PATHOLOGY: "PAT",
  SEROLOGY: "SR",
  SURGICAL_PATHOLOGY: "SP",
  TOXICOLOGY: "TX",
  URINALYSIS: "URN",
  VIROLOGY: "VR",
} as const;

export const IMAGING_SERVICE_SECTION = {
  CARDIAC_ULTRASOUND: "CUS",
  CINERADIOGRAPH: "XRC",
  COMPUTERIZED_AXIAL_TOMOGRAPHY: "CT",
  DIAGNOSTIC_IMAGING: "IMG",
  NUCLEAR_MAGNETIC_RESONANCE: "NMR",
  NUCLEAR_MEDICINE_SCAN: "NMS",
  OBSTETRIC_ULTRASOUND: "OUS",
  RADIOGRAPH: "RX",
  RADIOLOGY: "RAD",
  RADIOLOGY_ULTRASOUND: "RUS",
  VASCULAR_ULTRASOUND: "VUS",
} as const;

export const DIAGNOSTIC_REPORT_NOTE_CATEGORY = {
  CARDIOLOGY: "LP29708-2",
  PATHOLOGY: "LP7839-6",
  RADIOLOGY: "LP29684-5",
} as const;

const SEARCH_TOKEN_SEPARATOR = "|";

const formatSearchTokens = (system: string, codes: string[]): string[] =>
  codes.map((code) => `${system}${SEARCH_TOKEN_SEPARATOR}${code}`);

export const DIAGNOSTIC_REPORT_CATEGORY = {
  IMAGING: [
    ...formatSearchTokens(
      CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
      Object.values(IMAGING_SERVICE_SECTION),
    ),
    ...formatSearchTokens(CODE_SYSTEM.LOINC, [
      DIAGNOSTIC_REPORT_NOTE_CATEGORY.RADIOLOGY,
    ]),
  ],
  LABORATORY: [
    ...formatSearchTokens(
      CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
      Object.values(LABORATORY_SERVICE_SECTION),
    ),
    ...formatSearchTokens(CODE_SYSTEM.LOINC, [
      DIAGNOSTIC_REPORT_NOTE_CATEGORY.PATHOLOGY,
    ]),
  ],
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

export const REFERENCE_HISTORY_SEGMENT = "_history";

export const SEARCH_TOTAL = {
  ACCURATE: "accurate",
  ESTIMATE: "estimate",
  NONE: "none",
} as const satisfies Record<string, NonNullable<SearchRequest["total"]>>;
