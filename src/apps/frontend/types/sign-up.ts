import { AsynchronousOperationError } from "./asynchronous-operation";

export interface SignUpParameters {
  email: string;
  firstName: string;
  lastName: string;
  loginIdentifier?: string;
  password: string;
}

export class IncompleteSignUpError extends AsynchronousOperationError {
  readonly loginIdentifier: string;

  constructor(loginIdentifier: string, reason: AsynchronousOperationError) {
    super(reason.message, { cause: reason.cause });
    this.loginIdentifier = loginIdentifier;
  }
}
