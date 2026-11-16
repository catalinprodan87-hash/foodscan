/** "Ce e nou" shown once after updating to a version (RO + EN). Keep each list short. */
export const WHATS_NEW = {
  '3.6.0': {
    ro: [
      'Ingredientele scrise în altă limbă (germană, maghiară, bulgară, franceză…) sunt traduse automat în română, pe telefon; poți vedea oricând originalul.',
      'Cuvintele pe care dicționarul nu le știe rămân netraduse și sunt marcate.',
    ],
    en: [
      'Ingredients written in another language (German, Hungarian, Bulgarian, French…) are translated into Romanian on the phone; the original is always a tap away.',
      'Words the dictionary does not know stay as they are and are marked.',
    ],
  },
  '3.5.0': {
    ro: [
      'Valorile nutriționale apar sub rezultat (din bază sau din poza tabelului) și pot fi corectate; aplicația verifică dacă se potrivesc între ele.',
      'Când baza de date nu are Nutri-Score, aplicația îl calculează din valori (algoritmul 2023) și scrie „calculat de aplicație”.',
    ],
    en: [
      'Nutrition values appear under the result (from the database or your photo of the table) and can be corrected; the app checks that they add up.',
      'When the database has no Nutri-Score, the app calculates it from the values (2023 algorithm) and says "calculated by the app".',
    ],
  },
  '3.4.0': {
    ro: [
      'Poți alege mai multe poze ale aceluiași produs deodată (ingrediente, tabel nutrițional, origine): sunt citite și sortate automat.',
      '„Adaugă poze” sub rezultat adaugă alte fețe ale produsului; pozele se văd ca miniaturi, doar pe acest telefon.',
    ],
    en: [
      'You can pick several photos of one product at once (ingredients, nutrition table, origin): they are read and sorted automatically.',
      '"Add photos" under a result adds other sides of the product; the photos show as small thumbnails, on this phone only.',
    ],
  },
  '3.3.0': {
    ro: [
      'Poți edita ingredientele sub orice rezultat și re-analiza pe loc; varianta ta se păstrează pentru acel cod de bare.',
      'Dacă ingredientele din bază sunt greșite sau incomplete, le poți înlocui sau completa dintr-o poză.',
      'Înainte de actualizarea datelor, aplicația a păstrat o copie automată (Despre → Datele tale).',
    ],
    en: [
      'You can edit the ingredients under any result and analyse again in place; your version is kept for that barcode.',
      'If the database\u2019s ingredients are wrong or incomplete, you can replace or complete them from a photo.',
      'Before updating your data, the app kept an automatic copy (About → Your data).',
    ],
  },
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
