import type { WithId } from "@medplum/core";
import type { DiagnosticReport } from "@medplum/fhirtypes";
import { useMedplumContext } from "@medplum/react-hooks";
import { useCallback, useMemo, type FC, type PropsWithChildren } from "react";

import { DIAGNOSTIC_REPORT_KIND } from "../constants/fhir";
import { DiagnosticReportContext } from "../contexts";
import { useRecordSearch } from "../hooks";
import { DiagnosticReportService } from "../services";
import type {
  DiagnosticReportKind,
  DiagnosticReportPage,
  DiagnosticReportSearch,
  Nullable,
} from "../types";

const useDiagnosticReportSearch = (
  diagnosticReportService: DiagnosticReportService,
  kind: DiagnosticReportKind,
): DiagnosticReportSearch => {
  const listReportsOfKind = useCallback(
    (
      patientReference: string,
      previousPage: Nullable<DiagnosticReportPage> = null,
    ) =>
      diagnosticReportService.listReports({
        kind,
        patientReference,
        previousPage,
      }),
    [diagnosticReportService, kind],
  );
  return useRecordSearch<WithId<DiagnosticReport>, DiagnosticReportPage>(
    listReportsOfKind,
  );
};

export const DiagnosticReportProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { medplum } = useMedplumContext();
  const diagnosticReportService = useMemo(
    () => new DiagnosticReportService(medplum),
    [medplum],
  );
  const laboratoryReports = useDiagnosticReportSearch(
    diagnosticReportService,
    DIAGNOSTIC_REPORT_KIND.LABORATORY,
  );
  const imagingReports = useDiagnosticReportSearch(
    diagnosticReportService,
    DIAGNOSTIC_REPORT_KIND.IMAGING,
  );
  const otherReports = useDiagnosticReportSearch(
    diagnosticReportService,
    DIAGNOSTIC_REPORT_KIND.OTHER,
  );

  const value = useMemo(
    () => ({ imagingReports, laboratoryReports, otherReports }),
    [imagingReports, laboratoryReports, otherReports],
  );

  return (
    <DiagnosticReportContext.Provider value={value}>
      {children}
    </DiagnosticReportContext.Provider>
  );
};
