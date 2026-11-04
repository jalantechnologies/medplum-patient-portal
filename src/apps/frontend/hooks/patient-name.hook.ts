import { formatGivenName, formatHumanName } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";

const usePatientName = () => {
  const name = useMedplumProfile()?.name?.[0];

  return {
    fullName: name ? formatHumanName(name) : "",
    givenName: name ? formatGivenName(name) : "",
  };
};

export default usePatientName;
