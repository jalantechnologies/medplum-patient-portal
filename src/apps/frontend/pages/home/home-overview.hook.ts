import { getReferenceString } from "@medplum/core";
import type { Appointment } from "@medplum/fhirtypes";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useCallback, useEffect } from "react";

import constant from "../../constants";
import {
  useAppointmentContext,
  useCarePlanContext,
  useRecordSourceContext,
} from "../../contexts";
import type { Fact, Nullable } from "../../types";
import { describeActiveCarePlans, describeCount } from "../../utilities";
import { summarizeCarePlan } from "./care-plan-summary";

const SOURCE_COUNT_WORDS = {
  none: "No sources",
  plural: "sources",
  singular: "source",
};

const describeNextVisit = (appointment: Nullable<Appointment>) => {
  if (!appointment?.start) {
    return "None booked";
  }
  const start = new Date(appointment.start);
  const day = start.toLocaleDateString(constant.LOCALE, {
    month: "short",
    day: "numeric",
  });
  const time = start.toLocaleTimeString(constant.LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
};

interface HomeReads {
  appointment: ReturnType<typeof useAppointmentContext>;
  carePlan: ReturnType<typeof useCarePlanContext>;
  recordSource: ReturnType<typeof useRecordSourceContext>;
}

const describeFacts = ({
  appointment,
  carePlan,
  recordSource,
}: HomeReads): Record<
  "activeCarePlans" | "availableSources" | "nextVisit",
  Fact
> => ({
  activeCarePlans: {
    hasFailed: carePlan.activeCarePlanCountError !== null,
    isLoading: carePlan.isActiveCarePlanCountLoading,
    value: describeActiveCarePlans(carePlan.activeCarePlanCount),
  },
  availableSources: {
    hasFailed:
      recordSource.recordSourceNamesError !== null &&
      !recordSource.hasRecordSourceNamesAnswer,
    isLoading: recordSource.isRecordSourceNamesLoading,
    value: describeCount(
      recordSource.recordSourceNames?.sourceCount ?? null,
      SOURCE_COUNT_WORDS,
    ),
  },
  nextVisit: {
    hasFailed: appointment.nextAppointmentError !== null,
    isLoading: appointment.isNextAppointmentLoading,
    value: describeNextVisit(appointment.nextAppointment),
  },
});

const describeSections = ({ carePlan, recordSource }: HomeReads) => ({
  connectedRecords: {
    hasFailed:
      recordSource.lastReceivedError !== null &&
      !recordSource.hasLastReceivedAnswer,
    isLoading: recordSource.isLastReceivedLoading,
    lastReceived: recordSource.lastReceived,
  },
  currentCare: {
    carePlans: (carePlan.carePlanPreview ?? []).map((plan) =>
      summarizeCarePlan(plan, recordSource.recordSourceNames),
    ),
    hasFailed:
      carePlan.carePlanPreviewError !== null &&
      !carePlan.hasCarePlanPreviewAnswer,
    isLoading: carePlan.isCarePlanPreviewLoading,
  },
});

const findOverviewError = ({
  appointment,
  carePlan,
  recordSource,
}: HomeReads) =>
  carePlan.activeCarePlanCountError ??
  recordSource.recordSourceNamesError ??
  appointment.nextAppointmentError ??
  carePlan.carePlanPreviewError ??
  recordSource.lastReceivedError;

const useHomeOverview = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const appointment = useAppointmentContext();
  const carePlan = useCarePlanContext();
  const recordSource = useRecordSourceContext();
  const { countActiveCarePlans, listCarePlanPreview } = carePlan;
  const { getNextAppointment } = appointment;
  const { findLastReceived, listRecordSourceNames } = recordSource;

  const loadOverview = useCallback(async () => {
    if (!patientReference) {
      return;
    }
    await Promise.allSettled([
      countActiveCarePlans(patientReference),
      getNextAppointment(patientReference),
      listRecordSourceNames({ patientReference }),
      listCarePlanPreview({ patientReference }),
      findLastReceived({ patientReference }),
    ]);
  }, [
    countActiveCarePlans,
    findLastReceived,
    getNextAppointment,
    listCarePlanPreview,
    listRecordSourceNames,
    patientReference,
  ]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const reads: HomeReads = { appointment, carePlan, recordSource };
  return {
    ...describeSections(reads),
    loadOverview,
    overview: describeFacts(reads),
    overviewErrorMessage: findOverviewError(reads)?.message,
  };
};

export default useHomeOverview;
