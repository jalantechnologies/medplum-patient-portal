import type { Appointment } from "@medplum/fhirtypes";
import { createContext, useContext, useMemo } from "react";

import { useReader } from "../hooks";
import type { AsynchronousResultState, Nullable } from "../types";

type AppointmentContextType = {
  getNextAppointment: (
    patientReference: string,
  ) => Promise<Nullable<Appointment>>;
  nextAppointmentState: AsynchronousResultState<Appointment>;
};

export const AppointmentContext =
  createContext<Nullable<AppointmentContextType>>(null);

export const useAppointmentContext = () => {
  const appointmentContext = useContext(AppointmentContext);
  if (!appointmentContext) {
    throw new Error(
      "useAppointmentContext must be used inside AppointmentProvider",
    );
  }
  const { getNextAppointment, nextAppointmentState } = appointmentContext;
  const { error, isLoading, result } = useReader(nextAppointmentState);
  return useMemo(
    () => ({
      getNextAppointment,
      isNextAppointmentLoading: isLoading,
      nextAppointment: result,
      nextAppointmentError: error,
    }),
    [error, getNextAppointment, isLoading, result],
  );
};
