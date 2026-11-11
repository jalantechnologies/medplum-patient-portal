import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { AppointmentContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { AppointmentService } from "../services";

export const AppointmentProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const appointmentService = useMemo(
    () => new AppointmentService(medplum),
    [medplum],
  );

  const { error, hasAnswer, isRequesting, load, requestNumber, result } =
    useAsynchronousResult(appointmentService.getNextAppointment);

  const value = useMemo(
    () => ({
      getNextAppointment: load,
      nextAppointmentState: {
        error,
        hasAnswer,
        isRequesting,
        requestNumber,
        result,
      },
    }),
    [error, hasAnswer, isRequesting, load, requestNumber, result],
  );

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
};
