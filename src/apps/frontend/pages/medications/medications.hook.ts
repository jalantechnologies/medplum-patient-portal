import { getReferenceString, type WithId } from "@medplum/core";
import type { MedicationRequest } from "@medplum/fhirtypes";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useState, type Key } from "react";

import {
  useMedicationRequestContext,
  useRecordSourceContext,
} from "../../contexts";
import { useRecordListTab, useRecordSourceNames } from "../../hooks";
import type { MedicationRequestPage } from "../../types";
import { summarizeMedicationRequest } from "./medication-summary";

const MISSING_MEDICINE_NOTICE =
  "A missing medicine record does not confirm that you take no medicines.";

const MEDICATION_TAB_TEXT = {
  ALL: {
    emptyDescription: MISSING_MEDICINE_NOTICE,
    emptyTitle: "No medication records available",
    key: "all-medications",
    title: "All medications",
  },
  PAST: {
    emptyDescription: MISSING_MEDICINE_NOTICE,
    emptyTitle: "No past medicines available",
    key: "past-medications",
    title: "Past medications",
  },
} as const;

const useMedications = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const { allMedicationRequests, pastMedicationRequests } =
    useMedicationRequestContext();
  const [activeTabKey, setActiveTabKey] = useState<Key>(
    MEDICATION_TAB_TEXT.ALL.key,
  );
  const { recordSourceNames, recordSourceRequest } = useRecordSourceNames({
    ...useRecordSourceContext(),
    patientReference,
  });
  const summarize = (
    medicationRequest: WithId<MedicationRequest>,
    page: MedicationRequestPage,
  ) => summarizeMedicationRequest(medicationRequest, page, recordSourceNames);
  const tabs = [
    useRecordListTab({
      ...allMedicationRequests,
      activeTabKey,
      patientReference,
      summarize,
      text: MEDICATION_TAB_TEXT.ALL,
    }),
    useRecordListTab({
      ...pastMedicationRequests,
      activeTabKey,
      patientReference,
      summarize,
      text: MEDICATION_TAB_TEXT.PAST,
    }),
  ];

  return {
    activeTabKey,
    openTab: setActiveTabKey,
    recordSourceRequest,
    tabs,
  };
};

export default useMedications;
