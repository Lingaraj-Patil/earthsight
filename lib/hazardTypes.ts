import { HazardTypeId, HazardTypeOption } from "@/types/hazard";

// Central catalog of hazard types the reporter chooses from. rainSensitivity
// determines how strongly upcoming rainfall should push up the projected
// risk score for this category — this is a deliberate, controlled-vocabulary
// input to the risk engine, independent of the AI's freeform hazardType text.
export const HAZARD_TYPES: HazardTypeOption[] = [
  { id: "drainage-obstruction", label: "Drainage Obstruction", rainSensitivity: 0.95 },
  { id: "illegal-waste-dumping", label: "Illegal Waste Dumping", rainSensitivity: 0.4 },
  { id: "plastic-accumulation", label: "Plastic Accumulation", rainSensitivity: 0.55 },
  { id: "blocked-runoff-channel", label: "Blocked Runoff Channel", rainSensitivity: 0.95 },
  { id: "water-pollution", label: "Water Pollution", rainSensitivity: 0.5 },
  { id: "waste-near-waterway", label: "Waste Near Waterway", rainSensitivity: 0.85 },
  { id: "flood-prone-obstruction", label: "Flood-Prone Obstruction", rainSensitivity: 0.9 },
  { id: "other", label: "Other", rainSensitivity: 0.25 },
];

export function getHazardTypeById(id: HazardTypeId): HazardTypeOption {
  return HAZARD_TYPES.find((h) => h.id === id) ?? HAZARD_TYPES[HAZARD_TYPES.length - 1];
}

/** Matches a hazard category label (e.g. the reporter's dropdown selection,
 * stored verbatim on HazardReport.type) back to its HazardTypeId. Used only
 * for display-time lookups such as recommended actions — the risk engine
 * itself always receives the id directly, never re-derives it from text. */
export function getHazardTypeIdFromLabel(label: string): HazardTypeId {
  const match = HAZARD_TYPES.find((h) => h.label.toLowerCase() === label.toLowerCase());
  return match?.id ?? "other";
}
