import type { ProfileResource } from "@medplum/core";
import { createContext, useContext } from "react";

import type { Nullable } from "../types";

type AuthenticationContextType = {
  isSessionRestoring: boolean;
  isSignInLoading: boolean;
  isSignOutLoading: boolean;
  isUserAuthenticated: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<Nullable<ProfileResource>>;
  signOut: () => Promise<Nullable<void>>;
};

export const AuthenticationContext =
  createContext<Nullable<AuthenticationContextType>>(null);

export const useAuthenticationContext = (): AuthenticationContextType => {
  const authenticationContext = useContext(AuthenticationContext);
  if (!authenticationContext) {
    throw new Error(
      "useAuthenticationContext must be used inside AuthenticationProvider",
    );
  }
  return authenticationContext;
};
