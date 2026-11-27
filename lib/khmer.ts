/**
 * Khmer formatting helpers: digit conversion, contract date formats,
 * address composition and Khmer -> Latin name transliteration.
 * Ported 1:1 from the original Python engine (engine.py / database.py).
 */

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";
const LATIN_DIGITS = "0123456789";

export const KHMER_MONTHS = [
  "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
  "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ",
];

export type DigitStyle = "khmer" | "latin";
export type TemplateType = "NEW" | "OLD";

export function toLatinDigits(val: string | null | undefined): string {
  if (!val) return "";
  return String(val).replace(/[០-៩]/g, (d) => String(KHMER_DIGITS.indexOf(d)));
}

export function toKhmerDigits(val: string | null | undefined): string {
  if (!val) return "";
  return String(val).replace(/[0-9]/g, (d) => KHMER_DIGITS[LATIN_DIGITS.indexOf(d)]);
}

export function formatDigitsByStyle(val: string | null | undefined, style: string = "khmer"): string {
  if (!val) return "";
  return (style || "").toLowerCase() === "khmer" ? toKhmerDigits(toLatinDigits(val)) : toLatinDigits(val);
}

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** Today's date as dd/mm/yyyy in Cambodia time (UTC+7), regardless of server timezone. */
export function todayDdMmYyyy(): string {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
}

/** Parse dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy or yyyy/mm/dd. Falls back to today. */
export function parseDateParts(dateStr: string | null | undefined): { d: number; m: number; y: number } {
  const raw = toLatinDigits((dateStr || "").trim());
  let d = 0, m = 0, y = 0;
  let mt = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mt) { d = +mt[1]; m = +mt[2]; y = +mt[3]; }
  else if ((mt = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/))) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
  const valid = y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (!valid) {
    const [td, tm, ty] = todayDdMmYyyy().split("/").map(Number);
    return { d: td, m: tm, y: ty };
  }
  return { d, m, y };
}

export interface DateInfo {
  day: string;
  month: string;
  year: string;
  ddmmyyyy: string;
  full_preview: string;
}

/**
 * NEW: ថ្ងៃទី ១៩ ខែ តុលា ឆ្នាំ 2026 (Khmer-numeral day, Khmer month name, Latin year)
 * OLD: ថ្ងៃទី 01 ខែ 05 ឆ្នាំ 2026 (Latin digits, numeric month)
 */
export function formatContractDate(dateStr: string, templateType: string = "NEW"): DateInfo {
  const { d, m, y } = parseDateParts(dateStr);
  const ddmmyyyy = `${pad(d)}/${pad(m)}/${pad(y, 4)}`;
  let day: string, month: string;
  const year = pad(y, 4);
  if ((templateType || "NEW").toUpperCase() === "NEW") {
    day = pad(d);
    month = KHMER_MONTHS[m - 1];
  } else {
    day = pad(d);
    month = pad(m);
  }
  return { day, month, year, ddmmyyyy, full_preview: `ថ្ងៃទី ${day} ខែ ${month} ឆ្នាំ ${year}` };
}

export interface AddressParts {
  house_no?: string;
  street?: string;
  village?: string;
  commune?: string;
  district?: string;
  province?: string;
}

/** [ផ្ទះលេខ..] [ផ្លូវ..] ភូមិ.. ឃុំ/សង្កាត់.. ស្រុក/ក្រុង/ខណ្ឌ.. ខេត្ត/រាជធានី.. */
export function composeKhmerAddress(a: AddressParts): string {
  const parts: string[] = [];
  const h = (a.house_no || "").trim();
  if (h) parts.push(h.startsWith("ផ្ទះ") ? h : `ផ្ទះលេខ${h}`);
  const st = (a.street || "").trim();
  if (st) parts.push(st.startsWith("ផ្លូវ") ? st : `ផ្លូវ${st}`);
  const v = (a.village || "").trim();
  if (v) parts.push(v.startsWith("ភូមិ") ? v : `ភូមិ${v}`);
  const c = (a.commune || "").trim();
  if (c) parts.push(c.startsWith("ឃុំ") || c.startsWith("សង្កាត់") ? c : `ឃុំ ${c}`);
  const d = (a.district || "").trim();
  if (d) parts.push(d.startsWith("ស្រុក") || d.startsWith("ក្រុង") || d.startsWith("ខណ្ឌ") ? d : `ស្រុក${d}`);
  const p = (a.province || "").trim();
  if (p) {
    if (p.startsWith("ខេត្ត") || p.startsWith("រាជធានី")) parts.push(p);
    else if (p.includes("ភ្នំពេញ")) parts.push(`រាជធានី${p}`);
    else parts.push(`ខេត្ត${p}`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------- Transliteration

const KNOWN_KHMER_WORDS: Record<string, string> = {
  "ប៉ា": "Pa", "ចំរើន": "Chamroun", "ចម្រើន": "Chamroeun", "ស៊ីម": "Sim", "វិចិត្រ": "Vichet",
  "លាង": "Leang", "រដ្ឋា": "Ratha", "សុខ": "Sok", "សុខា": "Sokha", "ចាន់": "Chan",
  "ចាន់ថា": "Chantha", "ចាន់ធឿន": "Chanthoeun", "សៅ": "Sao", "ជា": "Chea", "ហេង": "Heng",
  "លី": "Ly", "ម៉ៅ": "Mao", "កែវ": "Keo", "ពេជ្រ": "Pich", "វណ្ណ": "Vann", "វណ្ណា": "Vanna",
  "វណ្ណៈ": "Vannak", "សំ": "Sam", "សំណាង": "Samnang", "រស់": "Ros", "អ៊ុក": "Ouk", "ញឹក": "Nhek",
  "គង់": "Kong", "មាស": "Meas", "ប្រាក់": "Prak", "ណុប": "Nop", "ផល": "Phal", "ផល្លា": "Phalla",
  "ឆាយ": "Chhay", "គឹម": "Kim", "ឃុន": "Khun", "ស៊ុន": "Sun", "សេង": "Seng", "សាន": "San",
  "សឿន": "Soeun", "សឿង": "Soeung", "សុវណ្ណ": "Sovann", "ដារ៉ា": "Dara", "ពិសិដ្ឋ": "Piseth",
  "ពិសី": "Pisey", "បូរ៉ា": "Bora", "ប៊ុន": "Bun", "ប៊ុនថន": "Bunthorn", "ធីតា": "Thida",
  "ស្រី": "Srey", "នាង": "Neang", "មុំ": "Mom", "ពៅ": "Pov", "ណារ៉ា": "Nara", "ណារិន": "Narin",
  "រតនា": "Ratana", "រតនៈ": "Ratanak", "សុផល": "Sophal", "សុភាព": "Sopheap", "សុភា": "Sophea",
  "សុភ័ក្រ": "Sopheak", "សុខុម": "Sokhom", "សុជាតិ": "Socheat", "សុជាតា": "Socheata", "ថន": "Thorn",
  "ផន": "Phorn", "ហ៊ុន": "Hun", "ហុង": "Hong", "ឡុង": "Long", "ឡេង": "Leng", "លឹម": "Lim",
  "តាំង": "Tang", "តែ": "Te", "ទី": "Ty", "ទូច": "Touch", "ទេព": "Tep", "នួន": "Nuon", "នី": "Ny",
  "ប៉ែន": "Pen", "ប៉ុក": "Pok", "ផាន់": "Phan", "ភួង": "Phuong", "ម៉ម": "Mam", "ម៉ែន": "Men",
  "ម៉ុក": "Mok", "យិន": "Yin", "យឹម": "Yim", "រិន": "Rin", "រឹម": "Rim", "រឿន": "Roeun",
  "វ៉ាន់": "Vann", "វ៉ា": "Va", "សរ": "Sar", "ស៊ិន": "Sin", "សុង": "Song", "សុត": "Sot",
  "ស៊ុំ": "Sum", "សួន": "Suon", "សៀង": "Sieng", "ហម": "Horm", "ហ៊ាន": "Hean", "ហួត": "Huot",
  "ហែម": "Hem", "ហោ": "Hor", "អ៊ុំ": "Um", "អ៊ឹង": "Ing", "អៀង": "Ieng", "ឯក": "Ek", "ឱម": "Om",
};

// consonant -> [onset, final, series]
const KH_CONSONANTS: Record<string, [string, string, "A" | "O"]> = {
  "ក": ["k", "k", "A"], "ខ": ["kh", "k", "A"], "គ": ["k", "k", "O"], "ឃ": ["kh", "k", "O"],
  "ង": ["ng", "ng", "O"], "ច": ["ch", "ch", "A"], "ឆ": ["chh", "ch", "A"], "ជ": ["ch", "ch", "O"],
  "ឈ": ["chh", "ch", "O"], "ញ": ["nh", "nh", "O"], "ដ": ["d", "t", "A"], "ឋ": ["th", "t", "A"],
  "ឌ": ["d", "t", "O"], "ឍ": ["th", "t", "O"], "ណ": ["n", "n", "A"], "ត": ["t", "t", "A"],
  "ថ": ["th", "t", "A"], "ទ": ["t", "t", "O"], "ធ": ["th", "t", "O"], "ន": ["n", "n", "O"],
  "ប": ["b", "p", "A"], "ផ": ["ph", "p", "A"], "ព": ["p", "p", "O"], "ភ": ["ph", "p", "O"],
  "ម": ["m", "m", "O"], "យ": ["y", "y", "O"], "រ": ["r", "r", "O"], "ល": ["l", "l", "O"],
  "វ": ["v", "v", "O"], "ស": ["s", "s", "A"], "ហ": ["h", "", "A"], "ឡ": ["l", "l", "A"],
  "អ": ["", "", "A"],
};

const KH_INDEP_VOWELS: Record<string, string> = {
  "ឥ": "e", "ឦ": "ei", "ឧ": "o", "ឱ": "ao", "ឲ": "ao", "ឪ": "ov", "ឫ": "roe", "ឬ": "reu",
  "ឯ": "ae", "ឮ": "leu",
};

const KH_VOWELS: Record<string, [string, string]> = {
  "ា": ["a", "ea"], "ិ": ["e", "i"], "ី": ["ei", "i"], "ឹ": ["oe", "ue"], "ឺ": ["eu", "ueu"],
  "ុ": ["o", "u"], "ូ": ["ou", "ou"], "ួ": ["uo", "uo"], "ើ": ["aeu", "oeu"], "ឿ": ["oea", "oea"],
  "ៀ": ["ie", "ie"], "េ": ["e", "e"], "ែ": ["ae", "eae"], "ៃ": ["ai", "ey"], "ោ": ["ao", "o"],
  "ៅ": ["au", "ov"], "ុំ": ["om", "um"], "ំ": ["am", "um"], "ាំ": ["am", "oam"], "ះ": ["ah", "eah"],
  "ុះ": ["oh", "uh"], "េះ": ["eh", "eh"], "ោះ": ["aoh", "uoh"],
};

function transliterateToken(token: string): string {
  const clean = token.replace(/\u200b/g, "").replace(/\u00a0/g, "").trim();
  if (!clean) return "";
  if (KNOWN_KHMER_WORDS[clean]) return KNOWN_KHMER_WORDS[clean];
  if (/^[A-Za-z0-9\s\-.]+$/.test(clean)) {
    return clean.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  const s = Array.from(clean);
  const n = s.length;
  const out: string[] = [];
  let i = 0;
  while (i < n) {
    const ch = s[i];
    if (KH_INDEP_VOWELS[ch]) { out.push(KH_INDEP_VOWELS[ch]); i++; continue; }

    if (KH_CONSONANTS[ch]) {
      let [onset, , series] = KH_CONSONANTS[ch];
      i++;
      if (i < n && (s[i] === "៉" || s[i] === "៊")) {
        if (s[i] === "៉") { series = "A"; if (ch === "ប") onset = "p"; } else series = "O";
        i++;
      }
      if (i + 1 < n && s[i] === "្" && KH_CONSONANTS[s[i + 1]]) {
        const subC = s[i + 1];
        const [subOnset, , subSeries] = KH_CONSONANTS[subC];
        if (ch === "ប" && onset === "b") onset = "p";
        onset = onset + subOnset;
        if (!["យ", "រ", "ល", "វ"].includes(subC)) series = subSeries;
        i += 2;
        if (i < n && (s[i] === "៉" || s[i] === "៊")) { series = s[i] === "៉" ? "A" : "O"; i++; }
      }

      let vowel: string | null = null;
      const two = i + 1 < n ? s[i] + s[i + 1] : "";
      if (two && KH_VOWELS[two]) {
        const [va, vo] = KH_VOWELS[two]; vowel = series === "A" ? va : vo; i += 2;
      } else if (i < n && KH_VOWELS[s[i]]) {
        const [va, vo] = KH_VOWELS[s[i]]; vowel = series === "A" ? va : vo; i++;
      }

      let hasBantoc = false;
      while (i < n && ["់", "័", "៍", "៌"].includes(s[i])) {
        if (s[i] === "់") hasBantoc = true;
        else if (s[i] === "័" && vowel === null) vowel = series === "O" ? "oa" : "a";
        i++;
      }
      if (vowel === null) {
        vowel = series === "A" ? "a" : "o";
        if (hasBantoc) vowel = series === "A" ? "a" : "u";
      }

      if (i < n && KH_CONSONANTS[s[i]]) {
        if (i + 1 < n && s[i + 1] === "៍") {
          i += 2;
        } else {
          let nextHasVowel = false;
          if (i + 1 < n) {
            const nxt = s[i + 1];
            if (KH_VOWELS[nxt] || ["្", "៉", "៊", "័"].includes(nxt)) nextHasVowel = true;
          }
          if (!nextHasVowel) {
            const finC = KH_CONSONANTS[s[i]][1];
            i++;
            if (i < n && s[i] === "់") { if (vowel === "a" || vowel === "ea") vowel = "a"; i++; }
            out.push(onset + vowel + finC);
            continue;
          }
        }
      }
      out.push(onset + vowel);
      continue;
    }
    i++;
  }
  const res = out.join("");
  return res ? res[0].toUpperCase() + res.slice(1) : "";
}

const NAME_TITLES = ["លោកស្រី", "អ្នកស្រី", "អ្នកនាង", "កញ្ញា", "លោក"];

export function stripTitle(name: string): string {
  let cleaned = (name || "").trim();
  for (const t of NAME_TITLES) {
    if (cleaned.startsWith(t + " ")) cleaned = cleaned.slice(t.length).trim();
  }
  return cleaned;
}

export function transliterateKhmerToLatin(khmerName: string): string {
  if (!khmerName) return "";
  const cleaned = stripTitle(khmerName.replace(/\u00a0/g, " ").replace(/\u200b/g, " "));
  return cleaned.split(/\s+/).filter(Boolean).map(transliterateToken).filter(Boolean).join(" ");
}
