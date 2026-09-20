import { HazardTypeId } from "@/types/hazard";

/**
 * Deterministic "why this matters" consequence chains, keyed by the
 * reporter's chosen hazard category — the same controlled vocabulary the
 * risk engine uses for sensitivity, kept separate from any AI-generated
 * text so this never drifts with model phrasing.
 */
export const ENVIRONMENTAL_CONSEQUENCES: Record<HazardTypeId, string[]> = {
  "drainage-obstruction": [
    "Localized flooding as water can no longer pass through the drain",
    "Contaminated runoff spreading into streets and low-lying areas",
    "Accelerated erosion around the blocked inlet",
    "Downstream properties and infrastructure exposed once capacity is exceeded",
  ],
  "blocked-runoff-channel": [
    "Street flooding as the channel overflows its banks",
    "Sediment and debris redistributed further downstream",
    "Reduced channel capacity for the next rainfall event",
    "Downstream flooding risk shifted rather than resolved if left unmanaged",
  ],
  "flood-prone-obstruction": [
    "Flash flooding in a location already prone to it",
    "Faster water rise with less warning time for nearby residents",
    "Compounded risk if this obstruction sits upstream of other hazards",
  ],
  "illegal-waste-dumping": [
    "Soil and groundwater contamination at the dump site",
    "Runoff transporting contaminants into nearby drainage or waterways",
    "Attraction of further illegal dumping if left unaddressed",
  ],
  "plastic-accumulation": [
    "Waterway blockage as plastic migrates into drains and channels",
    "Wildlife harm from ingestion or entanglement",
    "Microplastic breakdown into the water supply over time",
  ],
  "waste-near-waterway": [
    "Direct contamination of the waterway on the next rainfall",
    "Transport of waste further downstream, spreading the impact",
    "Compounded risk for any hazard downstream of this waterway",
  ],
  "water-pollution": [
    "Contaminated water supply for downstream users",
    "Ecological harm to aquatic life at and below the discharge point",
    "Spread of contamination during rainfall-driven runoff",
  ],
  other: [
    "Environmental degradation specific to this site",
    "Potential for the impact to worsen if conditions change",
  ],
};

export function consequencesFor(hazardCategoryId: HazardTypeId): string[] {
  return ENVIRONMENTAL_CONSEQUENCES[hazardCategoryId] ?? ENVIRONMENTAL_CONSEQUENCES.other;
}
