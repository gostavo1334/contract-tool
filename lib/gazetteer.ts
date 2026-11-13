export interface VillageItem {
  val: string;
  label: string;
}

export interface CommuneItem {
  en: string;
  villages: VillageItem[];
}

export interface DistrictItem {
  en: string;
  communes: Record<string, CommuneItem>;
}

export interface ProvinceItem {
  en: string;
  districts: Record<string, DistrictItem>;
}

export type GazetteerType = Record<string, ProvinceItem>;

// Strip prefix helper for flexible matching
export function stripAddressPrefix(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .replace(/^(រាជធានី|ខេត្ត|ស្រុក|ក្រុង|ខណ្ឌ|ឃុំ|សង្កាត់|ភូមិ)\s*/, "")
    .trim();
}

// Find matching key in record or array by exact or stripped match
export function findMatchingItem(items: string[], query: string): string | null {
  if (!query) return null;
  const qClean = query.trim();
  const qStripped = stripAddressPrefix(qClean);

  // 1. Exact match
  if (items.includes(qClean)) return qClean;

  // 2. Exact match on stripped
  for (const it of items) {
    if (it === qClean || it === qStripped) return it;
    if (stripAddressPrefix(it) === qStripped) return it;
  }

  // 3. Substring match
  for (const it of items) {
    if (it.includes(qStripped) || qStripped.includes(stripAddressPrefix(it))) {
      return it;
    }
  }

  return null;
}
