// Keyword dictionary mirror untuk highlight & suggestion (server-side punya yang authoritative)
export const POPULAR_KEYWORDS = [
  "Beasiswa LPDP", "RPL", "PMB 2026", "Lowongan IT", "Fresh Graduate",
  "Magang", "Beasiswa S2", "KIP Kuliah", "Data Analyst", "Helpdesk",
  "Developer", "Deadline beasiswa",
];

export const ALL_TAGS = [
  "Kampus", "RPL", "Beasiswa", "LPDP", "Pendidikan",
  "Pendaftaran", "Deadline", "Pengumuman", "Lowongan Kerja",
  "Magang", "Fresh Graduate", "IT",
] as const;

export type NewsTag = typeof ALL_TAGS[number];

export const TAG_COLORS: Record<string, string> = {
  Kampus: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  RPL: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Beasiswa: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  LPDP: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  Pendidikan: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Pendaftaran: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  Deadline: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  Pengumuman: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Lowongan Kerja": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Magang: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "Fresh Graduate": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  IT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};
