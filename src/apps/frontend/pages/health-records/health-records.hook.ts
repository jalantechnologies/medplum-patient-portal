import { getReferenceString, type WithId } from "@medplum/core";
import type {
  AllergyIntolerance,
  Condition,
  Observation,
  Procedure,
} from "@medplum/fhirtypes";
import { useMedplumProfile } from "@medplum/react-hooks";
import type { Key } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { HEALTH_RECORDS_TAB } from "../../constants/routes";
import {
  useAllergyIntoleranceContext,
  useConditionContext,
  useObservationContext,
  useProcedureContext,
  useRecordSourceContext,
} from "../../contexts";
import {
  useRecordFilter,
  useRecordListTab,
  useRecordSourceNames,
} from "../../hooks";
import type { RecordListFilter, RecordSourceNames } from "../../types";
import {
  buildHealthRecordsTabSearch,
  readHealthRecordsTabKey,
} from "../../utilities";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeProcedure,
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
  PROCEDURES: {
    ...HEALTH_RECORDS_TAB.PROCEDURES,
    emptyDescription: "No procedure information has been shared.",
    emptyTitle: "No procedures available",
  },
  MEASUREMENTS: {
    ...HEALTH_RECORDS_TAB.MEASUREMENTS,
    emptyDescription: "No measurement information has been shared.",
    emptyTitle: "No measurements available",
  },
} as const;

interface HealthRecordTabSource {
  activeTabKey: Key;
  patientReference: string | undefined;
  recordListFilter: RecordListFilter;
  recordSourceNames: RecordSourceNames;
}

const useConditionTab = ({
  activeTabKey,
  patientReference,
  recordListFilter,
  recordSourceNames,
}: HealthRecordTabSource) =>
  useRecordListTab({
    ...useConditionContext().conditions,
    ...recordListFilter,
    activeTabKey,
    patientReference,
    summarize: (condition: WithId<Condition>) =>
      summarizeCondition(condition, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.CONDITIONS,
  });

const useAllergyIntoleranceTab = ({
  activeTabKey,
  patientReference,
  recordListFilter,
  recordSourceNames,
}: HealthRecordTabSource) =>
  useRecordListTab({
    ...useAllergyIntoleranceContext().allergyIntolerances,
    ...recordListFilter,
    activeTabKey,
    patientReference,
    summarize: (allergyIntolerance: WithId<AllergyIntolerance>) =>
      summarizeAllergyIntolerance(allergyIntolerance, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.ALLERGIES,
  });

const useProcedureTab = ({
  activeTabKey,
  patientReference,
  recordListFilter,
  recordSourceNames,
}: HealthRecordTabSource) =>
  useRecordListTab({
    ...useProcedureContext().procedures,
    ...recordListFilter,
    activeTabKey,
    patientReference,
    summarize: (procedure: WithId<Procedure>) =>
      summarizeProcedure(procedure, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.PROCEDURES,
  });

const useVitalSignTab = ({
  activeTabKey,
  patientReference,
  recordListFilter,
  recordSourceNames,
}: HealthRecordTabSource) =>
  useRecordListTab({
    ...useObservationContext().vitalSigns,
    ...recordListFilter,
    activeTabKey,
    patientReference,
    summarize: (vitalSign: WithId<Observation>) =>
      summarizeVitalSign(vitalSign, recordSourceNames),
    text: HEALTH_RECORD_TAB_TEXT.MEASUREMENTS,
  });

const useHealthRecords = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const { hash, state } = useLocation();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const activeTabKey = readHealthRecordsTabKey(searchParameters);
  const { recordSourceNames, recordSourceRequest, recordSources } =
    useRecordSourceNames({
      ...useRecordSourceContext(),
      patientReference,
    });
  const { recordFilterChoices, recordListFilter } = useRecordFilter({
    hasRecordSourcesFailed: recordSourceRequest.error !== null,
    isSearchable: true,
    recordSources,
  });
  const tabSource = {
    activeTabKey,
    patientReference,
    recordListFilter,
    recordSourceNames,
  };
  const tabs = [
    useConditionTab(tabSource),
    useAllergyIntoleranceTab(tabSource),
    useProcedureTab(tabSource),
    useVitalSignTab(tabSource),
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

  return {
    activeTabKey,
    openTab,
    recordFilterChoices,
    recordSourceRequest,
    tabs,
  };
};

export default useHealthRecords;
