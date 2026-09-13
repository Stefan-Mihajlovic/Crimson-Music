# Kako izabrati novu Crimson ikonicu

Ovo su radni kriterijumi za naše predloge, ne Apple specifikacija. Kandidat prvo mora da radi kao jednostavan znak; tek potom se ocenjuju ljubičasta, dubina i staklo. Prikazi se porede na stvarnoj veličini, bez uvećanja.

## Pragovi kvaliteta

| Provera | 32 × 32 px | 64 × 64 px |
|---|---|---|
| Silueta | Jedan jasan dominantan znak; identitet opstaje bez refleksije i gradijenta. | Vidi se vlastiti crtež i odnos delova, bez utiska gotove generičke note. |
| Ključni otvor | Najmanje 2 puna piksela jasnog otvora; C ne sme postati O, a nota ne sme postati nečitljiva mrlja. | Najmanje 4 px u istom otvoru; svetli rub ne zatvara prostor. |
| Noseći potez | Najtanji deo koji je neophodan za prepoznavanje ima oko 2 px ili više. Sitniji ukras se može izgubiti bez promene znaka. | Noseći potez oko 4 px ili više; nema lomova ni zupčastih prelaza. |
| Razdvajanje slojeva | Delovi koji moraju da se čitaju odvojeno ostaju odvojeni. Svetli rubovi ne spajaju dve forme. | Materijal dodaje dubinu bez novog, lažnog obrisa. |
| Kontrast | Svetlo/tamno razdvajanje glavnog znaka i najbliže pozadine ostaje jasno u sivim tonovima. Radni cilj: najmanje 3:1 u glavnim nosećim delovima, bez računanja tankog sjaja. | Ljubičasta je živa, ali prednji znak ne deluje isprano; oštar odsjaj ne prekriva prepoznatljiv detalj. |
| Položaj i maska | Ključni simbol ostaje ceo u zaobljenom kvadratu i kružnom cropu. | Vizuelno je centriran; težina notne glave ne povlači ceo znak u donji ugao. |

Dodatno proveriti 1024 px zbog čistoće krivih i 16 px za kasniji favicon. Na 16 px dozvoljeno je da nestane dubina, ali ne i osnovna silueta. Ako kandidat zahteva objašnjenje uz veliku sliku da bi bio razlikovan od drugog kandidata, varijacije su previše slične.

## Finalna četiri kandidata

Pregled se odnosi na završne Composer rendere: **01 Ribbon, 02 Riff, 03 Resonance i 04 Sonata**.

| Kandidat | Zašto ga izabrati | Estetski kompromis |
|---|---|---|
| **01 — Ribbon** | Klasična muzička nota sa prepoznatljivom presavijenom zastavicom. Na 64 px vidi se prevoj; na 32 px ostaje jasna nota. | Detalj staklastog prevoja manje je izražen na najmanjim prikazima; tada prednost preuzima jednostavna silueta. |
| **02 — Riff** | Najsvedenija muzička varijanta: nagnuta polunota sa čistom spojenom konturom i čitljivim otvorom. | Može da asocira i na kurzivno d. Ima manje dekorativnog karaktera od Ribbon. |
| **03 — Resonance** | C direktno vezuje simbol za Crimson, a dva nejednaka poteza dodaju ritam. Oba poteza se jasno odvajaju na 32/64 px u pregledanim režimima. | Više je samostalan znak muzičke marke nego doslovna nota. |
| **04 — Sonata** | Dve suprotno okrenute note čine originalan muzički par. Dijagonalan ritam i dve nijanse daju najizraženiju igru između delova. Razmak ostaje otvoren na 32 px. | Nema neposredan inicijal C; može da podseti i na stilizovan par d/p. |

**Preporuka: Ribbon.** Najbolje odgovara zahtevu za klasičnom muzičkom ikonicom uz autorski prevoj. Resonance je alternativa za korisnika kome je važniji samostalan Crimson simbol; Sonata za onoga ko želi izrazitiji muzički par, a Riff za najsvedeniji znak.

## Proveren završni prikaz

Pregledani su stvarni Composer izlazi iz `candidates/*/previews`: default, dark i mono na 1024 px, kao i njihova smanjenja na stvarnih 32/64 px. U sva četiri kandidata ključna silueta i otvori ostaju čitljivi. Dark prikazi imaju ljubičasti znak na skoro crnoj podlozi; Sonata zadržava razliku dve nijanse. Kod Resonance oba ritmička poteza ostaju vidljiva.

Oznaka **mono** u galeriji predstavlja stvarni native **TintedLight** render. U njemu su znakovi svetli na toniranoj pozadini, a ključni razmaci ostaju otvoreni. Ovaj vizuelni nalaz potvrđuje prikaz isporučenih fajlova; ne tvrdi da je zasebno izolovan efekat svake `tinted` JSON anotacije.

## Razlikovanje od drugih servisa

Upoređivati sa [aktuelnim slikama u istraživanju](research.md), prvo po silueti pa po materijalu. Ribbon ima presavijen, zaobljen vrh umesto TikTok spuštene zastavice i nema Apple dvostruku notu. Riff je pojedinačna nota bez zastavice. Resonance koristi otvoreno C i dva ritmička poteza, bez Deezer srca, Spotify talasa ili YouTube play znaka. Sonata koristi suprotno okrenute note bez zajedničke prečke; razlikuje se od standardne Apple dvostruke note.

Nijanse same ne nose identitet: svaki kandidat zadržava vlastitu strukturu i kada se materijal svede na jednobojan prikaz. Četiri ponuđene opcije zato predstavljaju različite oblike, a ne samo različite boje istog simbola.

## Završni izbor

1. Ukloniti kandidate koji ne prolaze osnovne provere na 32 px.
2. Porediti default, dark i mono prikaz na 64 px, na mirnoj svetloj i tamnoj pozadini. Znak mora ostati isti kroz režime.
3. Porediti prepoznatljivost, muzičku asocijaciju, razlikovanje od istraženih servisa, uklapanje u Crimson i kvalitet materijala. Prednost dati obliku koji ostaje jasan bez oslanjanja na sjaj.
4. Korisniku ponuditi jasne, stvarno različite pravce i navesti najviše jednu preporuku. Njegov izbor određuje konačnu integraciju; ocene pomažu izboru i nisu zamena za njega.

Apple podržava centrirane vektorske slojeve sa čistim ivicama i sistemski primenjenom maskom; ovde definisane brojčane pragove koristimo kao sopstvenu proveru čitljivosti. [Apple app icon smernice](https://developer.apple.com/design/human-interface-guidelines/app-icons)
