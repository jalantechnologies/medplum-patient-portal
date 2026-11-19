import { getReferenceString } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { useState, type Key } from "react";

import { DIAGNOSTIC_REPORT_KIND } from "../../constants/fhir";
import {
  useDiagnosticReportContext,
  useRecordSourceContext,
} from "../../contexts";
import {
  useRecordFilter,
  useRecordListTab,
  useRecordSourceNames,
} from "../../hooks";
import { summarizeDiagnosticReport } from "./test-report-summary";

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
  const { recordSourceNames, recordSourceRequest, recordSources } =
    useRecordSourceNames({
      ...useRecordSourceContext(),
      patientReference,
    });
  const { recordFilterChoices, recordListFilter } = useRecordFilter({
    hasRecordSourcesFailed: recordSourceRequest.error !== null,
    isSearchable: true,
    recordSources,
  });
  const tabs = [
    useRecordListTab({
      ...laboratoryReports,
      ...recordListFilter,
      activeTabKey,
      patientReference,
      summarize: summarizeDiagnosticReport(
        DIAGNOSTIC_REPORT_KIND.LABORATORY,
        recordSourceNames,
      ),
      text: TEST_RESULTS_TAB_TEXT.LABORATORY,
    }),
    useRecordListTab({
      ...imagingReports,
      ...recordListFilter,
      activeTabKey,
      patientReference,
      summarize: summarizeDiagnosticReport(
        DIAGNOSTIC_REPORT_KIND.IMAGING,
        recordSourceNames,
      ),
      text: TEST_RESULTS_TAB_TEXT.IMAGING,
    }),
    useRecordListTab({
      ...otherReports,
      ...recordListFilter,
      activeTabKey,
      patientReference,
      summarize: summarizeDiagnosticReport(
        DIAGNOSTIC_REPORT_KIND.OTHER,
        recordSourceNames,
      ),
      text: TEST_RESULTS_TAB_TEXT.OTHER,
    }),
  ];

  return {
    activeTabKey,
    openTab: setActiveTabKey,
    recordFilterChoices,
    recordSourceRequest,
    tabs,
  };
};

export default useTestResults;
