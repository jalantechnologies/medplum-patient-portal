import { formatGivenName, formatHumanName } from "@medplum/core";
import type { HumanName } from "@medplum/fhirtypes";
import { useMedplumProfile } from "@medplum/react-hooks";

import { HUMAN_NAME_USE } from "../constants/fhir";

const findNameByUse = (names: HumanName[], use: HumanName["use"]) =>
  names.find((name) => name.use === use);

const isCurrentName = ({ use }: HumanName) =>
  use !== HUMAN_NAME_USE.OLD && use !== HUMAN_NAME_USE.MAIDEN;

const choosePatientName = (names: HumanName[]): HumanName | undefined =>
  findNameByUse(names, HUMAN_NAME_USE.OFFICIAL) ??
  findNameByUse(names, HUMAN_NAME_USE.USUAL) ??
  names.find(isCurrentName);

const usePatientName = () => {
  const name = choosePatientName(useMedplumProfile()?.name ?? []);
  const fullName = name ? formatHumanName(name) : "";

  return {
    fullName,
    givenName: name ? formatGivenName(name) : "",
    recordOwner: fullName ? `Your record · ${fullName}` : "Your record",
  };
};

export default usePatientName;
