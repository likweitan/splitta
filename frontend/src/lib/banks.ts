export const BANK_OPTIONS = ["Maybank", "RytBank", "CIMB", "OCBC", "UOB"].sort(
  (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
);
