export interface ListRecordSourcesParameters {
  patientReference: string;
}

export interface FindLastReceivedParameters {
  patientReference: string;
}

export interface RecordSource {
  addresses: string[];
  identifier: string;
  name?: string;
}

export class RecordSourceNames {
  private readonly namesByAddress = new Map<string, string>();

  constructor(
    sourceNames: Iterable<readonly [address: string, name: string]> = [],
  ) {
    for (const [address, name] of sourceNames) {
      if (!this.namesByAddress.has(address)) {
        this.namesByAddress.set(address, name);
      }
    }
  }

  // Medplum's _source search compares an address exactly, so a name compares it exactly too: a record named for a source is then among that source's records when the patient chooses it.
  findName(address: string | undefined): string {
    if (!address) {
      return "";
    }
    return this.namesByAddress.get(address) ?? "";
  }
}

export class ListedRecordSourceNames extends RecordSourceNames {
  readonly sourceCount: number;

  readonly sources: readonly RecordSource[];

  constructor(sources: readonly RecordSource[]) {
    super(
      sources.flatMap(({ addresses, name }) =>
        name ? addresses.map((address) => [address, name] as const) : [],
      ),
    );
    this.sourceCount = sources.length;
    this.sources = sources;
  }
}
