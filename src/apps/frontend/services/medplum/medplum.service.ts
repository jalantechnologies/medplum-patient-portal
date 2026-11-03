import { MedplumClient } from "@medplum/core";

import { configuration } from "../../configuration";

export default class MedplumService {
  medplumClient: MedplumClient;

  constructor(medplumClient: MedplumClient) {
    this.medplumClient = medplumClient;
  }

  static createMedplumClient(): MedplumClient {
    return new MedplumClient({
      baseUrl: configuration.medplumServerAddress,
    });
  }
}
