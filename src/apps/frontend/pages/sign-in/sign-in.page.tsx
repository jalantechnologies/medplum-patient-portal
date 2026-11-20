import type { FC } from "react";

import { AuthenticationPageLayout } from "../../components";
import SignInForm from "./sign-in-form";

const SignIn: FC = () => (
  <AuthenticationPageLayout title="Sign in">
    <SignInForm />
  </AuthenticationPageLayout>
);

export default SignIn;
