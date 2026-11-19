import gazetteerDataRaw from "./gazetteer.json";
import { toLatinDigits } from "./khmer";

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

export const gazetteerData: GazetteerType = gazetteerDataRaw as GazetteerType;

// Strip prefix helper for flexible matching
export function stripAddressPrefix(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .replace(/^(រាជធានី|ខេត្ត|ស្រុក|ក្រុង|ខណ្ឌ|ឃុំ|សង្កាត់|ភូមិ)\s*/, "")
    .trim();
}

function normKhmer(s: string): string {
  return (s || "")
    .replace(/^(រាជធានី|ខេត្ត|ស្រុក|ក្រុង|ខណ្ឌ|ឃុំ|សង្កាត់|ភូមិ)\s*/, "")
    .replace(/[\s\u200B]+/g, "")
    .replace(/រ+/g, "រ")
    .trim();
}

export function findFuzzyGazetteerKey(items: string[], query: string): string | null {
  if (!query) return null;
  const qClean = query.trim();
  const qNorm = normKhmer(qClean);

  // 1. Exact or normalized exact
  for (const it of items) {
    if (it === qClean || normKhmer(it) === qNorm) return it;
  }
  // 2. Contains match
  for (const it of items) {
    const itNorm = normKhmer(it);
    if (itNorm.includes(qNorm) || qNorm.includes(itNorm)) return it;
  }
  return null;
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

export interface AddressInput {
  house_no?: string;
  street?: string;
  village?: string;
  commune?: string;
  district?: string;
  province?: string;
  address_full?: string;
}

export function parseKhmerAddressTokens(addr: string): AddressInput {
  if (!addr) return {};
  const parts: AddressInput = {};
  const tokens = addr.split(/(?=ផ្ទះ(?:លេខ)?|ផ្លូវ|ភូមិ|ឃុំ|សង្កាត់|ស្រុក|ក្រុង|ខណ្ឌ|ខេត្ត|រាជធានី)/g);
  for (const t of tokens) {
    const s = t.trim();
    if (s.startsWith("ផ្ទះ")) {
      parts.house_no = s.replace(/^ផ្ទះ(?:លេខ)?\s*/, "").replace(/,$/, "").trim();
    } else if (s.startsWith("ផ្លូវ")) {
      parts.street = s.replace(/^ផ្លូវ\s*/, "").replace(/,$/, "").trim();
    } else if (s.startsWith("ភូមិ")) {
      parts.village = s.replace(/^ភូមិ\s*/, "").replace(/,$/, "").trim();
    } else if (s.startsWith("ឃុំ") || s.startsWith("សង្កាត់")) {
      parts.commune = s.replace(/^(?:ឃុំ|សង្កាត់)\s*/, "").replace(/,$/, "").trim();
    } else if (s.startsWith("ស្រុក") || s.startsWith("ក្រុង") || s.startsWith("ខណ្ឌ")) {
      parts.district = s.replace(/^(?:ស្រុក|ក្រុង|ខណ្ឌ)\s*/, "").replace(/,$/, "").trim();
    } else if (s.startsWith("ខេត្ត") || s.startsWith("រាជធានី")) {
      parts.province = s.replace(/^(?:ខេត្ត|រាជធានី)\s*/, "").replace(/,$/, "").trim();
    }
  }
  return parts;
}

export function composeEnglishAddress(input: AddressInput): string {
  if (!input) return "";

  let { house_no, street, village, commune, district, province, address_full } = input;

  if (address_full && (!province || !district || !commune || !village)) {
    const parsed = parseKhmerAddressTokens(address_full);
    if (!house_no) house_no = parsed.house_no;
    if (!street) street = parsed.street;
    if (!village) village = parsed.village;
    if (!commune) commune = parsed.commune;
    if (!district) district = parsed.district;
    if (!province) province = parsed.province;
  }

  let provEn = "";
  let distEn = "";
  let commEn = "";
  let villEn = "";

  // 1. Province resolution
  let provObj: ProvinceItem | null = null;
  if (province) {
    const pKey = findFuzzyGazetteerKey(Object.keys(gazetteerData), province);
    if (pKey) {
      provObj = gazetteerData[pKey];
      provEn = provObj.en === "Phnom Penh" ? "Phnom Penh" : `${provObj.en} Province`;
    } else {
      for (const p of Object.values(gazetteerData)) {
        if (p.en.toLowerCase() === province.toLowerCase()) {
          provObj = p;
          provEn = p.en === "Phnom Penh" ? "Phnom Penh" : `${p.en} Province`;
          break;
        }
      }
      if (!provEn) provEn = `${province} Province`;
    }
  }

  // 2. District resolution
  let distObj: DistrictItem | null = null;
  if (provObj && district) {
    const dKey = findFuzzyGazetteerKey(Object.keys(provObj.districts), district);
    if (dKey) {
      distObj = provObj.districts[dKey];
      if (dKey.startsWith("ក្រុង")) distEn = `${distObj.en} Municipality`;
      else if (dKey.startsWith("ខណ្ឌ")) distEn = `Khan ${distObj.en}`;
      else distEn = `${distObj.en} District`;
    } else {
      for (const [k, d] of Object.entries(provObj.districts)) {
        if (d.en.toLowerCase() === district.toLowerCase()) {
          distObj = d;
          if (k.startsWith("ក្រុង")) distEn = `${d.en} Municipality`;
          else if (k.startsWith("ខណ្ឌ")) distEn = `Khan ${d.en}`;
          else distEn = `${d.en} District`;
          break;
        }
      }
      if (!distEn) distEn = `${district} District`;
    }
  }

  // 3. Commune resolution
  let commObj: CommuneItem | null = null;
  if (distObj && commune) {
    const cKey = findFuzzyGazetteerKey(Object.keys(distObj.communes), commune);
    if (cKey) {
      commObj = distObj.communes[cKey];
      if (cKey.startsWith("សង្កាត់")) commEn = `Sangkat ${commObj.en}`;
      else commEn = `${commObj.en} Commune`;
    } else {
      for (const [k, c] of Object.entries(distObj.communes)) {
        if (c.en.toLowerCase() === commune.toLowerCase()) {
          commObj = c;
          if (k.startsWith("សង្កាត់")) commEn = `Sangkat ${c.en}`;
          else commEn = `${c.en} Commune`;
          break;
        }
      }
      if (!commEn) commEn = `${commune} Commune`;
    }
  }

  // 4. Village resolution
  if (commObj && village) {
    const vClean = stripAddressPrefix(village);
    for (const v of commObj.villages) {
      const match = v.label.match(/\(([^)]+)\)/);
      const en = match ? match[1].trim() : "";
      if (
        v.val === village ||
        stripAddressPrefix(v.val) === vClean ||
        findFuzzyGazetteerKey([v.val], village) ||
        (en && en.toLowerCase() === vClean.toLowerCase())
      ) {
        villEn = `${en || vClean} Village`;
        break;
      }
    }
    if (!villEn && vClean) {
      villEn = `${vClean} Village`;
    }
  } else if (village) {
    villEn = `${stripAddressPrefix(village)} Village`;
  }

  const out: string[] = [];
  if (house_no) {
    const h = toLatinDigits(house_no.replace(/^ផ្ទះ(?:លេខ)?\s*/, "")).trim();
    if (h) out.push(`House No. ${h}`);
  }
  if (street) {
    const st = toLatinDigits(street.replace(/^ផ្លូវ\s*/, "")).trim();
    if (st) out.push(`Street ${st}`);
  }
  if (villEn) out.push(villEn);
  if (commEn) out.push(commEn);
  if (distEn) out.push(distEn);
  if (provEn) out.push(provEn);

  if (out.length === 0 && address_full) {
    return address_full;
  }
  return out.join(", ");
}
