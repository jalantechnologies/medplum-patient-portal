import { getReferenceString, type WithId } from "@medplum/core";
import type {
  AllergyIntolerance,
  Condition,
  Observation,
} from "@medplum/fhirtypes";
import { useMedplumProfile } from "@medplum/react-hooks";
import type { Key } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { HEALTH_RECORDS_TAB } from "../../constants/routes";
import {
  useAllergyIntoleranceContext,
  useConditionContext,
  useObservationContext,
  useRecordSourceContext,
} from "../../contexts";
import { useRecordListTab, useRecordSourceNames } from "../../hooks";
import type { RecordSourceNames } from "../../types";
import {
  buildHealthRecordsTabSearch,
  readHealthRecordsTabKey,
} from "../../utilities";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeVitalSign,
} from "./health-record-summary";

const HEALTH_RECORD_TAB_TEXT = {
  CONDITIONS: {
    ...HEALTH_RECORDS_TAB.CONDITIONS,
    emptyDescription: "No condition information has been shared.",
    emptyTitle: "No conditions available",
  },
  ALLERGIES: {
    ...HEALTH_RECORDS_TAB.ALLERGIES,
    emptyDescription: "No allergy information has been shared.",
    emptyTitle: "No allergies available",
  },
  MEASUREMENTS: {
    ...HEALTH_RECORDS_TAB.MEASUREMENTS,
    emptyDescription: "No measurement information has been shared.",
    emptyTitle: "No measurements available",
  },
} as const;

const useConditionTab = (
  activeTabKey: Key,
  patientReference: string | undefined,
  recordSourceNames: RecordSourceNames,
) => {
  const {
    conditionPage,
    conditionPageError,
    isConditionPageLoading,
    isConditionPageRequesting,
    listConditions,
  } = useConditionContext();
  return useRecordListTab({
    activeTabKey,
    error: conditionPageError,
    isLoading: isConditionPageLoading,
    isRequesting: isConditionPageRequesting,
    list: listConditions,
    page: conditionPage,
    patientReference,
    summarize: (condition: WithId<Condition>) =>
      summarizeCondition(condition, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.CONDITIONS,
  });
};

const useAllergyIntoleranceTab = (
  activeTabKey: Key,
  patientReference: string | undefined,
  recordSourceNames: RecordSourceNames,
) => {
  const {
    allergyIntolerancePage,
    allergyIntolerancePageError,
    isAllergyIntolerancePageLoading,
    isAllergyIntolerancePageRequesting,
    listAllergyIntolerances,
  } = useAllergyIntoleranceContext();
  return useRecordListTab({
    activeTabKey,
    error: allergyIntolerancePageError,
    isLoading: isAllergyIntolerancePageLoading,
    isRequesting: isAllergyIntolerancePageRequesting,
    list: listAllergyIntolerances,
    page: allergyIntolerancePage,
    patientReference,
    summarize: (allergyIntolerance: WithId<AllergyIntolerance>) =>
      summarizeAllergyIntolerance(allergyIntolerance, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.ALLERGIES,
  });
};

const useVitalSignTab = (
  activeTabKey: Key,
  patientReference: string | undefined,
  recordSourceNames: RecordSourceNames,
) => {
  const {
    isVitalSignPageLoading,
    isVitalSignPageRequesting,
    listVitalSigns,
    vitalSignPage,
    vitalSignPageError,
  } = useObservationContext();
  return useRecordListTab({
    activeTabKey,
    error: vitalSignPageError,
    isLoading: isVitalSignPageLoading,
    isRequesting: isVitalSignPageRequesting,
    list: listVitalSigns,
    page: vitalSignPage,
    patientReference,
    summarize: (vitalSign: WithId<Observation>) =>
      summarizeVitalSign(vitalSign, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.MEASUREMENTS,
  });
};

const useHealthRecords = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const { hash, state } = useLocation();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const activeTabKey = readHealthRecordsTabKey(searchParameters);
  const { recordSourceNames, recordSourceRequest } = useRecordSourceNames({
    ...useRecordSourceContext(),
    patientReference,
  });
  const tabs = [
    useConditionTab(activeTabKey, patientReference, recordSourceNames),
    useAllergyIntoleranceTab(activeTabKey, patientReference, recordSourceNames),
    useVitalSignTab(activeTabKey, patientReference, recordSourceNames),
  ];

  const openTab = (tabKey: Key) =>
    navigate(
      {
        hash,
        search: buildHealthRecordsTabSearch(
          tabKey,
          searchParameters,
        ).toString(),
      },
      { replace: true, state },
    );

  return { activeTabKey, openTab, recordSourceRequest, tabs };
};

export default useHealthRecords;
