import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useState, type Key } from "react";

import {
  useAllergyIntoleranceContext,
  useConditionContext,
  useObservationContext,
} from "../../contexts";
import { useRecordListTab } from "../../hooks";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeVitalSign,
} from "./health-record-summary";

const HEALTH_RECORD_TAB_TEXT = {
  CONDITIONS: {
    emptyDescription: "No condition information has been shared.",
    emptyTitle: "No conditions available",
    key: "conditions",
    title: "Conditions",
  },
  ALLERGIES: {
    emptyDescription: "No allergy information has been shared.",
    emptyTitle: "No allergies available",
    key: "allergies",
    title: "Allergies",
  },
  MEASUREMENTS: {
    emptyDescription: "No measurement information has been shared.",
    emptyTitle: "No measurements available",
    key: "measurements",
    title: "Measurements",
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
  const [activeTabKey, setActiveTabKey] = useState<Key>(
    HEALTH_RECORD_TAB_TEXT.CONDITIONS.key,
  );
  const tabs = [
    useConditionTab(activeTabKey, patientReference),
    useAllergyIntoleranceTab(activeTabKey, patientReference),
    useVitalSignTab(activeTabKey, patientReference),
  ];

  return { activeTabKey, openTab: setActiveTabKey, tabs };
};

export default useHealthRecords;
