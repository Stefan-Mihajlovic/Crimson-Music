# Icon Composer: zabeleženi dokazi o formatu

Pregledano 13. septembra 2026, bez GUI interakcije i bez promene kandidata.

- Instalirana aplikacija: `/Applications/Icon Composer.app`, `CFBundleShortVersionString = 2.0`.
- U pregledanim resource fajlovima aplikacije i frameworka nije pronađena čitljiva JSON šema niti primer `.icon` dokumenta.
- Javno Apple uputstvo opisuje slojeve, grupe i uređivanje default/dark/mono prikaza, ali ne objavljuje JSON strukturu. [Apple Composer uputstvo](https://developer.apple.com/documentation/Xcode/creating-your-app-icon-using-icon-composer) · [Apple Icon Composer](https://developer.apple.com/icon-composer/)

## Potvrđeni stringovi instaliranog frameworka

Izvor: `/Applications/Icon Composer.app/Contents/Frameworks/IconComposerFoundation.framework/Versions/A/IconComposerFoundation`, pregled read-only pomoću `strings`.

- Popuna: `solid`, `linear-gradient`, `automatic-gradient`, `orientation`.
- Eksplicitna poruka parsera: `Linear gradients require exactly 2 colors`.
- Nazivi pojavljivanja: `base`, `light`, `dark`, `tinted`.
- Specijalizacije: `fill-specializations`, `hidden-specializations`, `opacity-specializations`, `blur-material-specializations`, `refractivity-specializations`, `glass-specializations`, `image-name-specializations`.
- Vidljiva imena polja za varijacije: `appearance`, `idiom`, `value`, `slot`, `defaultValue`, `specializations`.
- Ostala vidljiva imena: `material-strength`, `specular-location`, `color-space-for-untagged-svg-colors`, `primary-color`, `secondary-color`, `components`, `start`, `stop`.

## Naknadno potvrđena struktura finalnih dokumenata

Pregledan je finalni `candidates/03-resonance/Crimson-Resonance.icon/icon.json`, kao i njegovi native default/dark renderi. Na slojevima je potvrđen sledeći oblik dark specijalizacije:

```json
{
  "image-name": "crimson-c.svg",
  "fill-specializations": [
    {
      "appearance": "dark",
      "value": {
        "solid": "extended-srgb:0.58824,0.36078,1.00000,1.00000"
      }
    }
  ]
}
```

Komponente su normalizovane RGBA vrednosti za `#965CFF`. Default render prikazuje svetao znak na ljubičastoj podlozi, a Dark render pokazuje ljubičasti znak na skoro crnoj. Ova promena direktno potvrđuje upotrebljivost prikazane dark strukture u instaliranoj verziji.

Finalni dokumenti imaju `features: ["refractivity"]` na vrhu i ovu vrednost u grupi, podešenu u Composer GUI tokom glavne izrade i proverenu u sačuvanom JSON fajlu:

```json
{
  "refractivity": {
    "depth": 0.12,
    "enabled": true,
    "strength": 0.5
  }
}
```

Ovo je provereni format konkretnih dokumenata u Icon Composer 2.0, ne potpuna objavljena Apple JSON šema. Struktura svih mogućih gradient stops i ostalih nepregledanih opcija nije potvrđena.

## Tačno značenje mono previewa

`scripts/render-candidates.py` generiše `mono.png` sa `--rendition TintedLight`. Finalni mono previewi su pravi native renderi visokog kontrasta i vizuelno su pregledani na 1024/64/32 px.

Finalni JSON sadrži i specijalizacije sa `appearance: "tinted"`. U ovom pregledu nije urađen izolovan A/B dokaz njihovog uticaja naspram sistemskog ponašanja TintedLight rendicije. Zato se ne tvrdi da je custom `tinted` anotacija dokazana samo zato što mono slika izgleda dobro. Native rezultat jeste potvrđen.

## Potvrđena CLI pomoć

`/Applications/Icon Composer.app/Contents/Executables/ictool --help` vraća podržan export:

```text
ictool input-document --export-image --output-file <output-file-path> --platform <platform> --rendition <rendition> --width <width> --height <height> --scale <scale> [--tint-color <tint-color>] [--tint-strength <tint-strength>] [--design-generation <26 or 27>]
```

Pomoć daje primere sa `--platform iOS`, `--rendition Default` i `--rendition TintedDark`, kao i `--design-generation 26`. Finalni pipeline uspešno koristi i `Dark` i `TintedLight`; `default-26.png` je zaseban render za generaciju 26. `icrtool --help` nije dao pomoć (exit 255).
