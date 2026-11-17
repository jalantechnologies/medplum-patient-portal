import type { WithId } from "@medplum/core";
import type { CarePlan } from "@medplum/fhirtypes";

import type { Nullable, RecordSourceNames } from "../../types";
import {
  formatRecordDate,
  humanizeCode,
  nameCodeableConcept,
} from "../../utilities";

export interface CarePlanSummary {
  author: string;
  date: string;
  identifier: string;
  source: string;
  status: string;
  title: string;
}

export const summarizeCarePlan = (
  carePlan: WithId<CarePlan>,
  recordSourceNames: Nullable<RecordSourceNames>,
): CarePlanSummary => ({
  author: carePlan.author?.display ?? "",
  date: formatRecordDate(carePlan.period?.start ?? carePlan.period?.end),
  identifier: carePlan.id,
  source: recordSourceNames?.findName(carePlan.meta?.source) ?? "",
  status: humanizeCode(carePlan.status),
  title:
    carePlan.title ||
    carePlan.category?.map(nameCodeableConcept).find(Boolean) ||
    "Care plan",
});
