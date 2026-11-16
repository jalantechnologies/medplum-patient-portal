import type { WithId } from "@medplum/core";
import type { MedicationRequest } from "@medplum/fhirtypes";
import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { MedicationRequestContext } from "../contexts";
import { useAsynchronousResult, useRecordSearch } from "../hooks";
import { MedicationRequestService } from "../services";
import type { MedicationRequestPage } from "../types";

export const MedicationRequestProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { medplum } = useMedplumContext();
  const medicationRequestService = useMemo(
    () => new MedicationRequestService(medplum),
    [medplum],
  );
  const allMedicationRequests = useRecordSearch<
    WithId<MedicationRequest>,
    MedicationRequestPage
  >(medicationRequestService.listMedicationRequests);
  const pastMedicationRequests = useRecordSearch<
    WithId<MedicationRequest>,
    MedicationRequestPage
  >(medicationRequestService.listPastMedicationRequests);

  const {
    error: activePrescriptionCountError,
    isLoading: isActivePrescriptionCountLoading,
    load: countActivePrescriptions,
    result: activePrescriptionCount,
  } = useAsynchronousResult(medicationRequestService.countActivePrescriptions);

  const value = useMemo(
    () => ({
      activePrescriptionCount,
      activePrescriptionCountError,
      allMedicationRequests,
      countActivePrescriptions,
      isActivePrescriptionCountLoading,
      pastMedicationRequests,
    }),
    [
      activePrescriptionCount,
      activePrescriptionCountError,
      allMedicationRequests,
      countActivePrescriptions,
      isActivePrescriptionCountLoading,
      pastMedicationRequests,
    ],
  );

  return (
    <MedicationRequestContext.Provider value={value}>
      {children}
    </MedicationRequestContext.Provider>
  );
};
