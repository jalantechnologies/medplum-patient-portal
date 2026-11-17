const ADDRESS_FRAGMENT_SEPARATOR = "#";
const TRAILING_SLASHES = /\/+$/;

export interface ListRecordSourcesParameters {
  patientReference: string;
}

export class RecordSourceNames {
  private readonly namesByAddress = new Map<string, string>();

  constructor(
    sourceNames: Iterable<readonly [address: string, name: string]> = [],
  ) {
    for (const [address, name] of sourceNames) {
      const addressKey = RecordSourceNames.toAddressKey(address);
      if (!this.namesByAddress.has(addressKey)) {
        this.namesByAddress.set(addressKey, name);
      }
    }
  }

  findName(address: string | undefined): string {
    if (!address) {
      return "";
    }
    return (
      this.namesByAddress.get(RecordSourceNames.toAddressKey(address)) ?? ""
    );
  }

  // FHIR leaves the form of Meta.source to each server, and some servers, such as HAPI FHIR, add the request that wrote the record after a "#", so the same source can come with more than one form of its address.
  private static toAddressKey(address: string): string {
    const [addressWithoutFragment] = address.split(ADDRESS_FRAGMENT_SEPARATOR);
    return addressWithoutFragment.replace(TRAILING_SLASHES, "");
  }
}
