import { formatGivenName, formatHumanName } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";

const usePatientName = () => {
  const name = useMedplumProfile()?.name?.[0];
  const fullName = name ? formatHumanName(name) : "";

  return {
    fullName,
    givenName: name ? formatGivenName(name) : "",
    recordOwner: fullName ? `Your record · ${fullName}` : "Your record",
  };
};

export default usePatientName;
