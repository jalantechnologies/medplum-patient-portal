import type { Appointment } from "@medplum/fhirtypes";
import { createContext, useContext } from "react";

import { useReader } from "../hooks";
import type { AsynchronousOperationError, Nullable } from "../types";

type AppointmentContextType = {
  addNextAppointmentReader: () => () => void;
  getNextAppointment: (
    patientReference: string,
  ) => Promise<Nullable<Appointment>>;
  isNextAppointmentLoading: boolean;
  nextAppointment: Nullable<Appointment>;
  nextAppointmentError: Nullable<AsynchronousOperationError>;
};

export const AppointmentContext =
  createContext<Nullable<AppointmentContextType>>(null);

export const useAppointmentContext = (): AppointmentContextType => {
  const appointmentContext = useContext(AppointmentContext);
  if (!appointmentContext) {
    throw new Error(
      "useAppointmentContext must be used inside AppointmentProvider",
    );
  }
  useReader(appointmentContext.addNextAppointmentReader);
  return appointmentContext;
};
