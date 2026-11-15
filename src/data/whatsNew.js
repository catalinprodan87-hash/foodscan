/** "Ce e nou" shown once after updating to a version (RO + EN). Keep each list short. */
export const WHATS_NEW = {
  '3.0.0': {
    ro: [
      'După „Reîncarcă”, aplicația îți spune dacă actualizarea a reușit.',
      'Poți partaja mai multe poze deodată în IngrediScan (Android, aplicația instalată).',
      'Mențiunea „doar informativ” apare acum pe scurt sub rezultat, nu în subsolul fiecărei pagini.',
      'Am scos „Raportează o problemă” și trimiterea produselor către Open Food Facts.',
    ],
    en: [
      'After "Reload", the app tells you whether the update worked.',
      'You can share several photos at once into IngrediScan (Android, installed app).',
      'The "for information only" note is now one short line under the result, not a footer on every page.',
      '"Report a problem" and sending products to Open Food Facts were removed.',
    ],
  },
};

/** Major.minor, as shown in the title ("Ce e nou în v3.0"). */
export const shortVersion = (v) => String(v).split('.').slice(0, 2).join('.');
