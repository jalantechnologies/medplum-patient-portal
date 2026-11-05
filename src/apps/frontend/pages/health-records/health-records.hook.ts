import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useState, type Key } from "react";

import {
  useAllergyIntoleranceContext,
  useConditionContext,
  useObservationContext,
} from "../../contexts";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeVitalSign,
} from "./health-record-summary";
import useHealthRecordTab, {
  HEALTH_RECORD_TAB_TEXT,
} from "./health-record-tab.hook";

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
  return useHealthRecordTab({
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
  return useHealthRecordTab({
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
  return useHealthRecordTab({
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
  const healthRecordTabs = [
    useConditionTab(activeTabKey, patientReference),
    useAllergyIntoleranceTab(activeTabKey, patientReference),
    useVitalSignTab(activeTabKey, patientReference),
  ];
  const failedTabs = healthRecordTabs.filter(({ error }) => error !== null);

  const retryFailedTabs = async () => {
    await Promise.all(failedTabs.map(({ retry }) => retry()));
  };

  return {
    activeTabKey,
    errorMessage: failedTabs[0]?.error?.message,
    openTab: setActiveTabKey,
    retryFailedTabs,
    tabs: healthRecordTabs.map(({ tab }) => tab),
  };
};

export default useHealthRecords;
