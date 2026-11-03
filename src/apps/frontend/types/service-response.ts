import type { AsynchronousResult } from "./asynchronous-operation";

export class ServiceResponse<Data> implements AsynchronousResult<Data> {
  data?: Data;

  constructor(data?: Data) {
    this.data = data;
  }
}
