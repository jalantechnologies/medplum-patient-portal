import type { WithId } from "@medplum/core";
import type { MedicationRequest } from "@medplum/fhirtypes";
import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { MedicationRequestContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { MedicationRequestService } from "../services";
import type {
  Nullable,
  RecordSearch,
  SearchPage,
  ServiceResponse,
} from "../types";

type MedicationRequestPage = SearchPage<WithId<MedicationRequest>>;

const useMedicationRequestSearch = (
  listMedicationRequests: (
    patientReference: string,
    previousPage?: Nullable<MedicationRequestPage>,
  ) => Promise<ServiceResponse<MedicationRequestPage>>,
): RecordSearch<WithId<MedicationRequest>> => {
  const { error, isLoading, isRequesting, load, result } =
    useAsynchronousResult(listMedicationRequests);
  return useMemo(
    () => ({ error, isLoading, isRequesting, list: load, page: result }),
    [error, isLoading, isRequesting, load, result],
  );
};

export const MedicationRequestProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { medplum } = useMedplumContext();
  const medicationRequestService = useMemo(
    () => new MedicationRequestService(medplum),
    [medplum],
  );
  const allMedicationRequests = useMedicationRequestSearch(
    medicationRequestService.listMedicationRequests,
  );
  const pastMedicationRequests = useMedicationRequestSearch(
    medicationRequestService.listPastMedicationRequests,
  );

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
