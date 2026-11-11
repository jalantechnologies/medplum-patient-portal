import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useCallback, useEffect } from "react";

import {
  useAllergyIntoleranceContext,
  useCarePlanContext,
  useMedicationRequestContext,
} from "../../contexts";
import type { AsynchronousOperationError, Fact, Nullable } from "../../types";
import { describeActiveCarePlans } from "../../utilities";
import {
  describeActiveAllergies,
  describeActivePrescriptions,
} from "./health-profile-text";

type RowLoad = (patientReference: string) => Promise<unknown>;

interface HealthProfileRow {
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
  load: RowLoad;
  value: string;
}

const hasRowFailed = ({ error }: HealthProfileRow) => error !== null;

const toFact = (row: HealthProfileRow): Fact => ({
  hasFailed: hasRowFailed(row),
  isLoading: row.isLoading,
  value: row.value,
});

const useActiveCarePlanRow = (): HealthProfileRow => {
  const {
    activeCarePlanCount,
    activeCarePlanCountError,
    countActiveCarePlans,
    isActiveCarePlanCountLoading,
  } = useCarePlanContext();
  return {
    error: activeCarePlanCountError,
    isLoading: isActiveCarePlanCountLoading,
    load: countActiveCarePlans,
    value: describeActiveCarePlans(activeCarePlanCount),
  };
};

const useActivePrescriptionRow = (): HealthProfileRow => {
  const {
    activePrescriptionCount,
    activePrescriptionCountError,
    countActivePrescriptions,
    isActivePrescriptionCountLoading,
  } = useMedicationRequestContext();
  return {
    error: activePrescriptionCountError,
    isLoading: isActivePrescriptionCountLoading,
    load: countActivePrescriptions,
    value: describeActivePrescriptions(activePrescriptionCount),
  };
};

const useActiveAllergyRow = (): HealthProfileRow => {
  const {
    activeAllergyIntolerancePreview,
    activeAllergyIntolerancePreviewError,
    isActiveAllergyIntolerancePreviewLoading,
    previewActiveAllergyIntolerances,
  } = useAllergyIntoleranceContext();
  return {
    error: activeAllergyIntolerancePreviewError,
    isLoading: isActiveAllergyIntolerancePreviewLoading,
    load: previewActiveAllergyIntolerances,
    value: describeActiveAllergies(activeAllergyIntolerancePreview),
  };
};

const useHealthProfile = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const activeCarePlans = useActiveCarePlanRow();
  const activePrescriptions = useActivePrescriptionRow();
  const activeAllergies = useActiveAllergyRow();

  const loadRows = useCallback(
    async (loads: RowLoad[]) => {
      if (!patientReference) {
        return;
      }
      await Promise.allSettled(loads.map((load) => load(patientReference)));
    },
    [patientReference],
  );

  useEffect(() => {
    void loadRows([
      activeCarePlans.load,
      activePrescriptions.load,
      activeAllergies.load,
    ]);
  }, [
    activeAllergies.load,
    activeCarePlans.load,
    activePrescriptions.load,
    loadRows,
  ]);

  const failedRows = [
    activeCarePlans,
    activePrescriptions,
    activeAllergies,
  ].filter(hasRowFailed);

  return {
    activeAllergies: toFact(activeAllergies),
    activeCarePlans: toFact(activeCarePlans),
    activePrescriptions: toFact(activePrescriptions),
    healthProfileErrorMessage: failedRows[0]?.error?.message,
    retryFailedRows: () => loadRows(failedRows.map(({ load }) => load)),
  };
};

export default useHealthProfile;
