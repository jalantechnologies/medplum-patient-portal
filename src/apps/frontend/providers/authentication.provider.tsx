import { useMedplumContext } from "@medplum/react-hooks";
import {
  useEffect,
  useMemo,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";

import constant from "../constants";
import { AuthenticationContext } from "../contexts";
import { useAsynchronous } from "../hooks";
import { AuthenticationService } from "../services";

export const AuthenticationProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum, profile, loading } = useMedplumContext();
  const authenticationService = useMemo(
    () => new AuthenticationService(medplum),
    [medplum],
  );
  const [isSessionRestoring, setIsSessionRestoring] = useState(loading);

  useEffect(() => {
    const finishSessionRestore = async () => {
      await authenticationService.restoreSession();
      setIsSessionRestoring(false);
    };
    void finishSessionRestore();
  }, [authenticationService]);

  const { asynchronousCallback: signIn, isLoading: isSignInLoading } =
    useAsynchronous(authenticationService.signIn);

  const { asynchronousCallback: signOut, isLoading: isSignOutLoading } =
    useAsynchronous(authenticationService.signOut);

  const isUserAuthenticated =
    profile?.resourceType === constant.PATIENT_RESOURCE_TYPE;

  const value = useMemo(
    () => ({
      isSessionRestoring,
      isSignInLoading,
      isSignOutLoading,
      isUserAuthenticated,
      signIn,
      signOut,
    }),
    [
      isSessionRestoring,
      isSignInLoading,
      isSignOutLoading,
      isUserAuthenticated,
      signIn,
      signOut,
    ],
  );

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
};
