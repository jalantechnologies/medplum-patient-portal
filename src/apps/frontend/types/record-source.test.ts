import { describe, expect, it } from "vitest";

import { mapleDental, oakDermatology } from "../test-medplum";
import { ListedRecordSourceNames, RecordSourceNames } from "./record-source";

describe("RecordSourceNames", () => {
  const recordSourceNames = new RecordSourceNames([
    [oakDermatology.address, oakDermatology.name],
    [mapleDental.address, mapleDental.name],
  ]);

  it("names the source at an address", () => {
    expect(recordSourceNames.findName(oakDermatology.address)).toBe(
      oakDermatology.name,
    );
    expect(recordSourceNames.findName(mapleDental.address)).toBe(
      mapleDental.name,
    );
  });

  it("names no source for an address it does not know, or for no address", () => {
    expect(
      recordSourceNames.findName("https://fhir.pine-family-clinic.example"),
    ).toBe("");
    expect(recordSourceNames.findName("")).toBe("");
    expect(recordSourceNames.findName(undefined)).toBe("");
  });

  it("names the source of an address written with the request after a '#', or with a trailing slash, as some servers write Meta.source", () => {
    expect(
      recordSourceNames.findName(
        `${oakDermatology.address}#4f6b8a71-2c3d-4e5f-9a0b-1c2d3e4f5a6b`,
      ),
    ).toBe(oakDermatology.name);
    expect(recordSourceNames.findName(`${oakDermatology.address}/`)).toBe(
      oakDermatology.name,
    );
    expect(
      new RecordSourceNames([
        [`${mapleDental.address}/`, mapleDental.name],
      ]).findName(mapleDental.address),
    ).toBe(mapleDental.name);
  });

  it("keeps the first name given for an address that a later source repeats", () => {
    expect(
      new RecordSourceNames([
        [oakDermatology.address, oakDermatology.name],
        [oakDermatology.address, "Oak Synthetic Billing"],
      ]).findName(oakDermatology.address),
    ).toBe(oakDermatology.name);
  });
});

describe("ListedRecordSourceNames", () => {
  const pineFamilyClinic = { addresses: [] };
  const unnamedClinic = { addresses: ["https://fhir.unnamed-clinic.example"] };
  const listedRecordSourceNames = new ListedRecordSourceNames([
    {
      addresses: [oakDermatology.address, `${oakDermatology.address}/v2`],
      name: oakDermatology.name,
    },
    { addresses: [mapleDental.address], name: mapleDental.name },
    { ...pineFamilyClinic, name: "Pine Synthetic Family Clinic" },
    unnamedClinic,
  ]);

  it("counts each source once, whatever number of addresses it has, and one with no address or no name", () => {
    expect(listedRecordSourceNames.sourceCount).toBe(4);
    expect(new ListedRecordSourceNames([]).sourceCount).toBe(0);
  });

  it("names a source at each of its addresses, and no source that has no name", () => {
    expect(
      listedRecordSourceNames.findName(`${oakDermatology.address}/v2`),
    ).toBe(oakDermatology.name);
    expect(listedRecordSourceNames.findName(mapleDental.address)).toBe(
      mapleDental.name,
    );
    expect(listedRecordSourceNames.findName(unnamedClinic.addresses[0])).toBe(
      "",
    );
  });
});
