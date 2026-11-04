import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useCallback, useEffect } from "react";

import { useAppointmentContext, useCarePlanContext } from "../../contexts";

const useHomeOverview = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const {
    activeCarePlanCount,
    activeCarePlanCountError,
    countActiveCarePlans,
    isActiveCarePlanCountLoading,
  } = useCarePlanContext();
  const {
    getNextAppointment,
    isNextAppointmentLoading,
    nextAppointment,
    nextAppointmentError,
  } = useAppointmentContext();

  const loadOverview = useCallback(async () => {
    if (!patientReference) {
      return;
    }
    await Promise.allSettled([
      countActiveCarePlans(patientReference),
      getNextAppointment(patientReference),
    ]);
  }, [countActiveCarePlans, getNextAppointment, patientReference]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return {
    activeCarePlanCount,
    hasActiveCarePlanCountFailed: activeCarePlanCountError !== null,
    hasNextAppointmentFailed: nextAppointmentError !== null,
    isActiveCarePlanCountLoading,
    isNextAppointmentLoading,
    loadOverview,
    nextAppointment,
    overviewErrorMessage: (activeCarePlanCountError ?? nextAppointmentError)
      ?.message,
  };
};

export default useHomeOverview;
