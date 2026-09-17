# Hadith catalogue sources

The optional library contains **51,776 source records across 17 collections**, in Arabic and published English where provided. This is a merged snapshot of Sunnah.com community datasets, not a claim that every historical edition or every live Sunnah.com page is complete. Hisnul Muslim remains the separate 268-entry library.

## Sources selected

| Repository | Pinned snapshot | Contribution |
| --- | --- | --- |
| [CheeseWithSauce/HadithsJSONFormat](https://github.com/CheeseWithSauce/HadithsJSONFormat) | `1ef8f97ac41cd04845081de79529d879966c6fbc` | Primary Arabic/English wording, book identifiers, source reference blocks and grades across 17 collections. MIT and explicit reuse permission. |
| [sehalhussain/Hadith-Dua-assets](https://github.com/sehalhussain/Hadith-Dua-assets) | `41acdb9589202c6b012c3833feebd912d69a0b51` | Seven SQLite collections; chapter titles, narrators, additional variants, in-book and USC-MSA references. Explicit reuse permission in its README. |
| [Jaguar16/open-hadith-data](https://github.com/Jaguar16/open-hadith-data) | release `v1.1.0`, code `1d6365b2d7e97b56627bfdca2c41052877d8a5dd` | Authors, bilingual book and chapter metadata, text-matched isnad/matn and source grading. CC0 applies to structure; its notice preserves the original translation terms. |

Also assessed [AhmedBaset/hadith-json](https://github.com/AhmedBaset/hadith-json), [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api), [hapiam/hadith-json](https://github.com/hapiam/hadith-json) and [Jammooly1/hadiths-json-files](https://github.com/Jammooly1/hadiths-json-files). Their coverage, alternate numbering, or reduced reference detail did not improve this merge enough to justify another interpretation of the source. A larger advertised record count alone is not evidence of better completeness.

## Preserved fields and matching rules

- Collection, author, book number and title; chapter identity and bilingual title when reliably mapped.
- Source hadith number, stable application identity, complete Arabic/English wording, narrator, source grade and named grader when supplied.
- Canonical, in-book, Arabic/English and deprecated USC-MSA reference strings; Sunnah.com link; source repository, revision and original record identifier.
- Additional source-provided chain, matn and closing narration, kept separate from the unabridged display text.
- Exact text matching after Unicode, markup, punctuation and whitespace normalization, constrained to the same book. No fuzzy or positional joins; source wording is never machine translated or paraphrased.
- Only exact duplicate rows with the same book, reference and both texts are collapsed. Differing source variants retain separate identities even if they share a printed citation.

## Coverage limitations

Musnad Ahmad is explicitly **partial**. Chapter mappings are available for 7,277 Bukhari records, 7,459 Muslim records and 1,896 Riyad as-Salihin records. The remaining records show “Chapter not supplied”; book filtering still works. Jaguar includes chapter lists but its release does not populate per-hadith chapter numbers, so guessing from row order would give false precision.

Missing source grades are labelled as missing, including Bukhari and Muslim; the importer does not invent a per-record scholarly grade from a collection's reputation. Darimi has no English translation in these snapshots; some other entries also lack English. The reader identifies this explicitly. Published source texts remain Arabic/English even when interface controls use another language.

Book-based Muwatta links are retained. Muslim introduction and Darimi records use their source section pages. For a grouped citation, the link opens the first numbered narration while the full grouped reference is displayed. Some source snapshots use old numbering; the reference blocks and provenance remain available for comparison with the current website.

`assets/hadith/quality-report.json` contains exact per-collection counts and missing-field totals. `manifest.json` pins input/output SHA-256 hashes. Collection packs are validated before atomic replacement of an existing download. Corrupt data or cancellation preserves existing readings.

## Rebuild

With Python 3 and network access:

```powershell
python scripts/fetch-hadith-sources.py
python scripts/build-hadith-catalogue.py
npm.cmd run build
```

The fetcher pins revisions and verifies source archives/databases against the committed manifest. The builder emits deterministic gzip packs and the TypeScript catalogue. Inputs live under `tmp/hadith-research`; outputs and retained licence notices live under `assets/hadith`. The browser serves optional packs without precaching them; an explicitly downloaded collection is stored in IndexedDB. Desktop downloads use the bundled packs and `.athan/hadith`.

## Home and printed reflection

The home page and prayer PDFs share verbatim excerpts of Quran 13:28, selected for each interface language in `src/home-verse.ts`, with an excerpt label. Sources: [Arabic and English / Mustafa Khattab](https://quran.com/13/28), [Urdu / Israr Ahmad](https://quran.com/ur/ar-rad/28), [Turkish / Diyanet](https://quran.com/tr/rad/28), [Indonesian / Kemenag](https://quran.com/id/guruh-petir/28), and [French / Hamidullah](https://quran.com/fr/le-tonnerre/28). These are Quran excerpts, separate from the original Arabic and published English daily hadith narrations.
