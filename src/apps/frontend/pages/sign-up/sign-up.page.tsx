import type { FC } from "react";

import { AuthenticationPageLayout } from "../../components";
import SignUpForm from "./sign-up-form";

const SignUp: FC = () => (
  <AuthenticationPageLayout title="Create your account">
    <SignUpForm />
  </AuthenticationPageLayout>
);

export default SignUp;
