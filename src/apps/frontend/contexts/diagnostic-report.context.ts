import { createContext, useContext } from "react";

import type { DiagnosticReportSearch, Nullable } from "../types";

type DiagnosticReportContextType = {
  imagingReports: DiagnosticReportSearch;
  laboratoryReports: DiagnosticReportSearch;
  otherReports: DiagnosticReportSearch;
};

export const DiagnosticReportContext =
  createContext<Nullable<DiagnosticReportContextType>>(null);

export const useDiagnosticReportContext = (): DiagnosticReportContextType => {
  const diagnosticReportContext = useContext(DiagnosticReportContext);
  if (!diagnosticReportContext) {
    throw new Error(
      "useDiagnosticReportContext must be used inside DiagnosticReportProvider",
    );
  }
  return diagnosticReportContext;
};
