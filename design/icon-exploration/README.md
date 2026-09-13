# Crimson Music — predlozi nove ikonice

**Izabrano: 04 Sonata.** Stefan je 13. septembra 2026. izabrao Sonatu; njen `.icon` dokument, izvozi za ostale platforme i wordmark primenjeni su u produkcijskim izvorima i `app.json`.

Četiri finalna predloga ostaju sačuvana za poređenje i istoriju dizajna: **01 Ribbon**, **02 Riff**, **03 Resonance**, **04 Sonata**. Ribbon je bio početna preporuka; konačni izbor je Sonata.

- [Galerija za poređenje](index.html)
- [Zajednički pregled](Crimson-icon-options.jpg)
- [Istraživanje 16 servisa i zvanični izvori](research.md)
- [Kriterijumi i pregled finalnih kandidata](selection-criteria.md)
- [Aktuelni izvori i upotreba izabrane ikonice](../../docs/APP-ICON.md)
- [Početni plan zamene kroz aplikaciju](integration-plan.md)

U svakom `candidates/<broj-naziv>/` nalaze se pravi slojeviti `Crimson-<naziv>.icon` dokument, ZIP tog dokumenta i PNG prikazi. `.icon` se otvara u Apple Icon Composeru. SVG slojevi su autorski vektori; zaobljenje sistemske ikonice, svetlo i materijale renderuje Appleov alat.

## Prikazi i provera

`default.png`, `dark.png` i `mono.png` koriste Appleov renderer generacije 27. Mono je svetli sistemski tonirani prikaz (`TintedLight`); boja sistemskog toniranja može da se promeni korisničkim podešavanjem. `default-26.png` prikazuje prethodnu generaciju materijala. Izvezeni PNG sa sistemskom maskom služe za pregled, ne kao automatski finalni Android adaptive foreground.

Finalne konture pregledane su na 32 i 64 px. Ribbon dokument je otvoren u Icon Composeru, a dubina i refrakcija podešene su kroz njegov inspektor. Svi finalni dokumenti uspešno su prošli native export za četiri pripremljena izgleda. Tamni prednji slojevi imaju posebnu svetliju ljubičastu da ne nestanu na crnoj podlozi.

Galerija je proverena na širinama 1280 i 390 px: izbor režima, iOS 26 prikaz, veliko otvaranje slike, čuvanje favorita nakon ponovnog učitavanja i poništavanje izbora. Testni favorit je poništen. Posle toga je korisnik izričito izabrao Sonatu i njeni izvori su ugrađeni u aplikaciju. Favorit u galeriji ostaje lokalno podešavanje pregledača i sam ne menja aplikaciju.

## Ponovno generisanje

Iz korena repozitorijuma:

```sh
python3 design/icon-exploration/scripts/create-candidates.py
python3 design/icon-exploration/scripts/render-candidates.py
python3 -m http.server 8084 --bind 127.0.0.1 --directory design/icon-exploration
```

Generator čuva geometriju i materijale, a `render-candidates.py` koristi `ictool` iz aktivnog Xcode-a ili instaliranog Icon Composera. Izvorne varijacije Ribbon/Sonata su u `sources/`; sve konačne slojeve moguće je direktno menjati u `.icon` dokumentima. Ako se dokument ručno dorađuje, prvo preneti izmene u generator pre njegovog ponovnog pokretanja.

Sonata sada zamenjuje izvor app ikonice, splash znaka, favicon-a, zajedničkih prikaza logotipa i welcome/onboarding wordmarka. Aktivni Apple dokument je `assets/Crimson.icon`. Kompletan Release build uspešno je napravljen, bežično instaliran i pokrenut na Stefanovom iPhone-u 15 Pro 13. septembra 2026. Prošli su TypeScript, ESLint, svih 190 testova i web export; welcome prikaz je vizuelno proveren na desktop i mobilnoj širini. Tačne putanje i način održavanja su u [dokumentaciji ikonice](../../docs/APP-ICON.md).

## Pripremljeni izvozi za ostale platforme

Svaki kandidat ima `platform-assets/`: neprozirni kvadratni `icon.png`, odvojene Android pozadinu i transparentni prednji sloj, monohromatski sloj, samostalni znak za splash, favicon od 48 px i novi transparentni wordmark od 1146 × 300 px. `manifest.json` beleži putanje i rezultate provere prostora za znak. Izvozi Sonate kopirani su u produkcijski `assets/`, a `app.json` pokazuje na njih; njen wordmark je pretvoren u lossless WebP. Fajlovi ostalih kandidata ostaju pripremljene alternative. Generator i dalje piše samo u dizajnerski direktorijum, što označava polje `stagedOnly` u manifestima.

Android znak je skaliran unutar centralnog kruga prečnika 66 dp na platnu od 108 dp, uz dodatnu malu rezervu. Pozadina i prednji sloj nemaju ugrađenu masku. Pravilo potiče iz [zvaničnih Android smernica](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive). Portable SVG/PNG imaju istu geometriju kao Composer slojevi; iOS materijal dodaje sistem, dok Android i web koriste čist vektorski crtež.

Izvoz koristi `@resvg/resvg-js`, instaliran samo u ignorisanom `.build/icon-tools/` direktorijumu:

```sh
npm install --prefix .build/icon-tools --no-save --ignore-scripts @resvg/resvg-js
node design/icon-exploration/scripts/export-platform-assets.cjs
```

Sva četiri `.icon` dokumenta dodatno su uspešno kompajlirana stvarnim Xcode 27 `actool` alatom za iPhone uz minimum iOS 16.4. Nije bilo upozorenja ni grešaka; sva četiri `Assets.car` kataloga prošla su `assetutil --validate-file`. Time su provereni dokumenti, vektori i light/dark/tintable slojevi. To još nije provera kompletne aplikacije na telefonu. Komande i izlazi su u [lokalnom izveštaju](../../.build/icon-compile-audit/README.md).
