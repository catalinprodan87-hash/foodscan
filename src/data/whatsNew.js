/** "Ce e nou" shown once after updating to a version (RO + EN). Keep each list short. */
export const WHATS_NEW = {
  '3.2.0': {
    ro: [
      'Citirea textului din poze e mult mai bună: diacritice (ă â î ș ț) și fonturile înguste de pe etichete.',
      'Textul în bulgară (chirilic) se citește acum; cititorul pentru el se descarcă doar prima dată când e nevoie (8 MB).',
      'Pozele nu mai sunt întoarse invers când aplicația nu e sigură de orientare.',
    ],
    en: [
      'Reading text from photos is much better: diacritics (ă â î ș ț) and the narrow fonts of food labels.',
      'Bulgarian (Cyrillic) text is now read; its reader downloads only the first time it is needed (8 MB).',
      'Photos are no longer turned upside down when the app is unsure of the orientation.',
    ],
  },
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
