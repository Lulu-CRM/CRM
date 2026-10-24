// International calling codes by country (ITU-T E.164), for the WhatsApp number picker. Country names
// are not stored here: the UI gets them from Intl.DisplayNames, so they read in the user's language.
export const DIAL_CODES: Record<string, string> = {
  AF: "93", AL: "355", DZ: "213", AD: "376", AO: "244", AR: "54", AM: "374", AU: "61", AT: "43", AZ: "994",
  BH: "973", BD: "880", BY: "375", BE: "32", BZ: "501", BJ: "229", BT: "975", BO: "591", BA: "387", BW: "267",
  BR: "55", BN: "673", BG: "359", BF: "226", BI: "257", KH: "855", CM: "237", CA: "1", CV: "238", CF: "236",
  TD: "235", CL: "56", CN: "86", CO: "57", KM: "269", CG: "242", CD: "243", CR: "506", CI: "225", HR: "385",
  CU: "53", CY: "357", CZ: "420", DK: "45", DJ: "253", DO: "1", EC: "593", EG: "20", SV: "503", GQ: "240",
  ER: "291", EE: "372", SZ: "268", ET: "251", FJ: "679", FI: "358", FR: "33", GA: "241", GM: "220", GE: "995",
  DE: "49", GH: "233", GR: "30", GT: "502", GN: "224", GW: "245", GY: "592", HT: "509", HN: "504", HK: "852",
  HU: "36", IS: "354", IN: "91", ID: "62", IR: "98", IQ: "964", IE: "353", IL: "972", IT: "39", JM: "1",
  JP: "81", JO: "962", KZ: "7", KE: "254", KW: "965", KG: "996", LA: "856", LV: "371", LB: "961", LS: "266",
  LR: "231", LY: "218", LI: "423", LT: "370", LU: "352", MO: "853", MG: "261", MW: "265", MY: "60", MV: "960",
  ML: "223", MT: "356", MR: "222", MU: "230", MX: "52", MD: "373", MC: "377", MN: "976", ME: "382", MA: "212",
  MZ: "258", MM: "95", NA: "264", NP: "977", NL: "31", NZ: "64", NI: "505", NE: "227", NG: "234", MK: "389",
  NO: "47", OM: "968", PK: "92", PS: "970", PA: "507", PG: "675", PY: "595", PE: "51", PH: "63", PL: "48",
  PT: "351", PR: "1", QA: "974", RO: "40", RU: "7", RW: "250", SA: "966", SN: "221", RS: "381", SC: "248",
  SL: "232", SG: "65", SK: "421", SI: "386", SO: "252", ZA: "27", KR: "82", SS: "211", ES: "34", LK: "94",
  SD: "249", SR: "597", SE: "46", CH: "41", SY: "963", TW: "886", TJ: "992", TZ: "255", TH: "66", TG: "228",
  TT: "1", TN: "216", TR: "90", TM: "993", UG: "256", UA: "380", AE: "971", GB: "44", US: "1", UY: "598",
  UZ: "998", VE: "58", VN: "84", YE: "967", ZM: "260", ZW: "263",
};

// Where several countries share a code (+1, +7), a number is read as this one.
const PREFERRED: Record<string, string> = { "1": "US", "7": "RU" };

/** The number as stored: "+<code><digits>", e.g. "+4917641474606". Empty when no digits are given. */
export function joinPhone(country: string, number: string): string {
  const digits = number.replace(/\D/g, "").replace(/^0+/, "");
  const code = DIAL_CODES[country];
  return digits === "" || code === undefined ? "" : `+${code}${digits}`;
}

/** Splits a stored number back into country and local digits (longest matching code wins). */
export function splitPhone(value: string | null | undefined, fallbackCountry: string): { country: string; number: string } {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!value?.trim().startsWith("+") || digits === "") return { country: fallbackCountry, number: digits };
  for (const length of [3, 2, 1]) {
    const code = digits.slice(0, length);
    const matches = Object.keys(DIAL_CODES).filter((country) => DIAL_CODES[country] === code);
    if (matches.length > 0) {
      const country = matches.includes(fallbackCountry) ? fallbackCountry : (PREFERRED[code] ?? matches[0]!);
      return { country, number: digits.slice(length) };
    }
  }
  return { country: fallbackCountry, number: digits };
}

/** The country to start with: the region of the user's language (de-DE -> DE), else Germany. */
export function defaultCountry(locale: string | undefined): string {
  const region = locale?.split("-")[1]?.toUpperCase();
  return region && DIAL_CODES[region] ? region : "DE";
}
