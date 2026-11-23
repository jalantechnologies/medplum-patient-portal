import type { WithId } from "@medplum/core";
import type {
  CodeableConcept,
  Medication,
  MedicationIngredient,
  MedicationRequest,
  Resource,
} from "@medplum/fhirtypes";

import {
  CONTAINED_REFERENCE_PREFIX,
  MEDICATION_STATUS,
  RESOURCE_TYPE,
} from "../constants/fhir";
import type { ListRecordsParameters } from "./record-filter";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

const INGREDIENT_SEPARATOR = ", ";

export type MedicationsByReference = ReadonlyMap<string, Medication>;

export class PrescribedMedicine {
  readonly names: string[];

  constructor(
    prescription: MedicationRequest,
    medications: MedicationsByReference,
  ) {
    const { medicationCodeableConcept, medicationReference } = prescription;
    this.names = [
      ...PrescribedMedicine.listCodeNames(medicationCodeableConcept),
      medicationReference?.display,
      ...PrescribedMedicine.listMedicationNames(
        PrescribedMedicine.findMedication(prescription, medications),
      ),
    ].filter((name): name is string => Boolean(name));
  }

  private static findMedication(
    { contained, medicationReference }: MedicationRequest,
    medications: MedicationsByReference,
  ): Medication | undefined {
    const reference = medicationReference?.reference;
    if (!reference) {
      return undefined;
    }
    const medication =
      contained
        ?.filter(PrescribedMedicine.isMedication)
        .find(({ id }) => `${CONTAINED_REFERENCE_PREFIX}${id}` === reference) ??
      medications.get(reference);
    return medication?.status === MEDICATION_STATUS.ENTERED_IN_ERROR
      ? undefined
      : medication;
  }

  private static isMedication(resource: Resource): resource is Medication {
    return resource.resourceType === RESOURCE_TYPE.MEDICATION;
  }

  private static listMedicationNames(
    medication: Medication | undefined,
  ): (string | undefined)[] {
    const ingredients = medication?.ingredient ?? [];
    return [
      ...PrescribedMedicine.listCodeNames(medication?.code),
      PrescribedMedicine.nameByIngredients(ingredients),
      ...ingredients.flatMap(PrescribedMedicine.listIngredientNames),
    ];
  }

  private static nameByIngredients(
    ingredients: MedicationIngredient[],
  ): string {
    return ingredients
      .map((ingredient) =>
        PrescribedMedicine.listIngredientNames(ingredient).find(Boolean),
      )
      .filter(Boolean)
      .join(INGREDIENT_SEPARATOR);
  }

  private static listIngredientNames({
    itemCodeableConcept,
    itemReference,
  }: MedicationIngredient): (string | undefined)[] {
    return [
      ...PrescribedMedicine.listCodeNames(itemCodeableConcept),
      itemReference?.display,
    ];
  }

  private static listCodeNames(
    code: CodeableConcept | undefined,
  ): (string | undefined)[] {
    return [code?.text, ...(code?.coding ?? []).map(({ display }) => display)];
  }
}

export interface MedicationRequestPage extends SearchPage<
  WithId<MedicationRequest>
> {
  medications: MedicationsByReference;
}

export type MedicationRequestSearch = RecordSearch<
  WithId<MedicationRequest>,
  MedicationRequestPage
>;

export type ListMedicationRequestsParameters =
  ListRecordsParameters<MedicationRequestPage>;
