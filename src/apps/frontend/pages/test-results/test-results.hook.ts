import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useState, type Key } from "react";

import { DIAGNOSTIC_REPORT_KIND } from "../../constants/fhir";
import { useDiagnosticReportContext } from "../../contexts";
import { useRecordListTab } from "../../hooks";
import { summarizeDiagnosticReport } from "./test-report-summary";

const summarizeLaboratoryReport = summarizeDiagnosticReport(
  DIAGNOSTIC_REPORT_KIND.LABORATORY,
);
const summarizeImagingReport = summarizeDiagnosticReport(
  DIAGNOSTIC_REPORT_KIND.IMAGING,
);
const summarizeOtherReport = summarizeDiagnosticReport(
  DIAGNOSTIC_REPORT_KIND.OTHER,
);

const MISSING_REPORT_NOTICE =
  "The source may not have shared a report, or this type of test may not have been ordered.";

const TEST_RESULTS_TAB_TEXT = {
  LABORATORY: {
    emptyDescription: MISSING_REPORT_NOTICE,
    emptyTitle: "No lab results available",
    key: "laboratory-results",
    title: "Lab results",
  },
  IMAGING: {
    emptyDescription: MISSING_REPORT_NOTICE,
    emptyTitle: "No imaging available",
    key: "imaging",
    title: "Imaging",
  },
  OTHER: {
    emptyDescription: MISSING_REPORT_NOTICE,
    emptyTitle: "No other reports available",
    key: "other-reports",
    title: "Other reports",
  },
} as const;

const useTestResults = () => {
  const profile = useMedplumProfile();
  const patientReference = profile && getReferenceString(profile);
  const { imagingReports, laboratoryReports, otherReports } =
    useDiagnosticReportContext();
  const [activeTabKey, setActiveTabKey] = useState<Key>(
    TEST_RESULTS_TAB_TEXT.LABORATORY.key,
  );
  const tabs = [
    useRecordListTab({
      ...laboratoryReports,
      activeTabKey,
      patientReference,
      summarize: summarizeLaboratoryReport,
      text: TEST_RESULTS_TAB_TEXT.LABORATORY,
    }),
    useRecordListTab({
      ...imagingReports,
      activeTabKey,
      patientReference,
      summarize: summarizeImagingReport,
      text: TEST_RESULTS_TAB_TEXT.IMAGING,
    }),
    useRecordListTab({
      ...otherReports,
      activeTabKey,
      patientReference,
      summarize: summarizeOtherReport,
      text: TEST_RESULTS_TAB_TEXT.OTHER,
    }),
  ];

  return { activeTabKey, openTab: setActiveTabKey, tabs };
};

export default useTestResults;
