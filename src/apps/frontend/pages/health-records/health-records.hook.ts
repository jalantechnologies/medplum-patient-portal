import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import type { Key } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { HEALTH_RECORDS_TAB } from "../../constants/routes";
import {
  useAllergyIntoleranceContext,
  useConditionContext,
  useObservationContext,
} from "../../contexts";
import { useRecordListTab } from "../../hooks";
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
    summarize: summarizeCondition,
    text: HEALTH_RECORD_TAB_TEXT.CONDITIONS,
  });
};

const useAllergyIntoleranceTab = (
  activeTabKey: Key,
  patientReference: string | undefined,
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
    summarize: summarizeAllergyIntolerance,
    text: HEALTH_RECORD_TAB_TEXT.ALLERGIES,
  });
};

const useVitalSignTab = (
  activeTabKey: Key,
  patientReference: string | undefined,
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
    summarize: summarizeVitalSign,
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
  const tabs = [
    useConditionTab(activeTabKey, patientReference),
    useAllergyIntoleranceTab(activeTabKey, patientReference),
    useVitalSignTab(activeTabKey, patientReference),
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

  return { activeTabKey, openTab, tabs };
};

export default useHealthRecords;
