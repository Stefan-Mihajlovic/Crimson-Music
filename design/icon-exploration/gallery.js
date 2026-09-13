'use strict';

(() => {
  const candidates = [
    { id: '1', number: '01', slug: '01-ribbon', name: 'Ribbon', document: 'Crimson-Ribbon.icon', direction: 'Presavijena nota', description: 'Svetla nota sa ljubičastim preklopom. Zaobljena i jednostavna.' },
    { id: '2', number: '02', slug: '02-riff', name: 'Riff', document: 'Crimson-Riff.icon', direction: 'Nota sa kosim rezom', description: 'Kompaktna nota sa kosim rezom. Oštrije ivice i jači kontrast.' },
    { id: '3', number: '03', slug: '03-resonance', name: 'Resonance', document: 'Crimson-Resonance.icon', direction: 'C i ritam', description: 'Otvoreno slovo C uz dva ritmična poteza. Najsvedeniji predlog.' },
    { id: '4', number: '04', slug: '04-sonata', name: 'Sonata', document: 'Crimson-Sonata.icon', direction: 'Dve note u kontrapunktu', description: 'Dve note u kontrapunktu. Mirniji, skulpturalni znak na tamnoj ljubičastoj.' },
  ];
  const storageKey = 'crimson-icon-gallery-v1';
  const state = { appearance: 'default', generation: '27', selected: null };
  let modalCandidate = null;
  let lastModalTrigger = null;
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && candidates.some((item) => item.id === saved.selected)) state.selected = saved.selected;
    if (saved && ['default', 'dark', 'mono'].includes(saved.appearance)) state.appearance = saved.appearance;
    if (saved && ['26', '27'].includes(saved.generation)) state.generation = saved.generation;
    if (state.generation === '26') state.appearance = 'default';
  } catch { storageAvailable = false; }

  const grid = document.querySelector('#predlozi');
  const dialog = document.querySelector('#original-dialog');
  const galleryStatus = document.querySelector('#gallery-status');
  const selectionMessage = document.querySelector('#selection-message');
  const copyStatus = document.querySelector('#copy-status');
  const modeLabels = { default: 'Default', dark: 'Dark', mono: 'Mono' };

  function source(candidate) {
    const rendition = state.generation === '26' ? 'default-26' : state.appearance;
    return `candidates/${candidate.slug}/previews/${rendition}.png`;
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
  }

  function announce(message) { galleryStatus.textContent = message; }

  function selectionFootnote() {
    return storageAvailable
      ? 'Izbor je sačuvan samo u ovom pregledaču. Ikonica u aplikaciji još nije promenjena.'
      : 'Izbor važi dok je ova stranica otvorena; pregledač nije dozvolio čuvanje. Kopiraj poruku da ga sačuvaš.';
  }

  function makeCard(candidate) {
    const card = document.createElement('article');
    card.className = 'candidate';
    card.dataset.candidate = candidate.id;
    card.setAttribute('aria-labelledby', `title-${candidate.id}`);
    card.innerHTML = `
      <div class="candidate-topline">
        <span class="candidate-number">${candidate.number}<span aria-hidden="true"></span></span>
        <span class="candidate-direction${candidate.id === '1' ? ' recommended' : ''}">${candidate.id === '1' ? '✦ Preporuka' : candidate.direction}</span>
        <span class="favorite-badge">✓ Tvoj favorit</span>
      </div>
      <button class="icon-stage" type="button" data-original="${candidate.id}" aria-label="Pogledaj ${candidate.name} u velikom prikazu">
        <img data-preview="${candidate.id}" src="${source(candidate)}" width="1024" height="1024" alt="Crimson ${candidate.name} — ${modeLabels[state.appearance]} prikaz" decoding="async">
        <span class="stage-hint" aria-hidden="true">↗</span>
        <span class="image-unavailable" hidden>Ovaj pregled trenutno nije dostupan.</span>
      </button>
      <h2 class="candidate-title" id="title-${candidate.id}">${candidate.name}</h2>
      <p class="candidate-description">${candidate.description}</p>
      <div class="small-previews" aria-label="${candidate.name} u manjim veličinama">
        ${[32, 64, 120].map((size) => `<figure class="small-preview"><img data-preview="${candidate.id}" src="${source(candidate)}" width="${size}" height="${size}" alt="" decoding="async"><figcaption>${size} px</figcaption></figure>`).join('')}
        <button class="original-button" type="button" data-original="${candidate.id}">Pogledaj<br>original ↗</button>
      </div>
      <div class="candidate-actions">
        <button class="choose-button" type="button" data-choose="${candidate.id}" aria-pressed="false">Izaberi ${candidate.name}</button>
        <a class="source-link" href="candidates/${candidate.slug}/${candidate.document}.zip" download title="Preuzmi Icon Composer dokument">Icon Composer fajl <span aria-hidden="true">↓</span></a>
      </div>`;

    for (const img of card.querySelectorAll('img')) {
      img.addEventListener('error', () => {
        img.style.visibility = 'hidden';
        if (img.closest('.icon-stage')) card.querySelector('.image-unavailable').hidden = false;
      });
      img.addEventListener('load', () => {
        img.style.visibility = '';
        if (img.closest('.icon-stage')) card.querySelector('.image-unavailable').hidden = true;
      });
    }
    return card;
  }

  for (const candidate of candidates) grid.append(makeCard(candidate));

  function updateSelection() {
    for (const candidate of candidates) {
      const selected = candidate.id === state.selected;
      const card = grid.querySelector(`[data-candidate="${candidate.id}"]`);
      card.classList.toggle('is-selected', selected);
      const button = card.querySelector('.choose-button');
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? '✓ Sačuvan kao favorit' : `Izaberi ${candidate.name}`;
    }
    const chosen = candidates.find((candidate) => candidate.id === state.selected);
    const panel = document.querySelector('#selection-panel');
    panel.hidden = !chosen;
    if (chosen) {
      document.querySelector('#selection-title').textContent = `${chosen.number} — ${chosen.name}`;
      const thumbnail = document.querySelector('#selected-thumbnail');
      thumbnail.src = source(chosen);
      thumbnail.alt = `Izabrana ikonica ${chosen.name}`;
      selectionMessage.value = `Izabrao sam ${chosen.id} — ${chosen.name}`;
      copyStatus.textContent = selectionFootnote();
    }
  }

  function updateModal() {
    if (!modalCandidate) return;
    const image = document.querySelector('#original-image');
    image.src = source(modalCandidate);
    image.alt = `${modalCandidate.name}, ${modeLabels[state.appearance]}, iOS ${state.generation}`;
    document.querySelector('#original-title').textContent = `${modalCandidate.number} — ${modalCandidate.name}`;
    document.querySelector('#original-mode').textContent = `${modeLabels[state.appearance]} · iOS ${state.generation}`;
    document.querySelector('#original-link').href = source(modalCandidate);
  }

  function updateAppearance() {
    for (const button of document.querySelectorAll('[data-appearance]')) {
      button.setAttribute('aria-pressed', String(button.dataset.appearance === state.appearance));
      button.disabled = state.generation === '26' && button.dataset.appearance !== 'default';
      button.title = button.disabled ? 'Za iOS 26 pripremljen je osnovni izgled.' : '';
    }
    for (const button of document.querySelectorAll('[data-generation]')) button.setAttribute('aria-pressed', String(button.dataset.generation === state.generation));
    document.querySelector('#preview-note').textContent = state.generation === '26'
      ? 'iOS 26 pregled prikazuje osnovni izgled.'
      : state.appearance === 'mono'
        ? 'Mono prikazuje sistemsko toniranje.'
        : 'Originalni prikazi iz Icon Composera.';
    for (const candidate of candidates) {
      for (const image of grid.querySelectorAll(`[data-preview="${candidate.id}"]`)) {
        image.src = source(candidate);
        if (image.closest('.icon-stage')) image.alt = `Crimson ${candidate.name} — ${modeLabels[state.appearance]} prikaz, iOS ${state.generation}`;
      }
    }
    updateSelection();
    updateModal();
  }

  function openOriginal(candidate, trigger) {
    modalCandidate = candidate;
    lastModalTrigger = trigger;
    updateModal();
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }

  document.addEventListener('click', (event) => {
    const appearance = event.target.closest('[data-appearance]');
    const generation = event.target.closest('[data-generation]');
    const choice = event.target.closest('[data-choose]');
    const original = event.target.closest('[data-original]');
    if (appearance && !appearance.disabled) {
      state.appearance = appearance.dataset.appearance;
      persist(); updateAppearance();
      announce(`Prikazan ${modeLabels[state.appearance]} izgled za sva četiri predloga.`);
    } else if (generation) {
      state.generation = generation.dataset.generation;
      if (state.generation === '26') state.appearance = 'default';
      persist(); updateAppearance();
      announce(`Prikaz za iOS ${state.generation}.`);
    } else if (choice) {
      state.selected = choice.dataset.choose;
      persist(); updateSelection();
      const candidate = candidates.find((item) => item.id === state.selected);
      announce(`${candidate.name} je izabran kao favorit. Poruka sa izborom je ispod predloga.`);
      const panel = document.querySelector('#selection-panel');
      const panelBounds = panel.getBoundingClientRect();
      if (panelBounds.top >= window.innerHeight || panelBounds.bottom <= 0) {
        panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      }
    } else if (original) openOriginal(candidates.find((item) => item.id === original.dataset.original), original);
  });

  document.querySelector('#reset-choice').addEventListener('click', () => {
    const previous = state.selected;
    state.selected = null;
    persist(); updateSelection();
    grid.querySelector(`[data-choose="${previous}"]`)?.focus({ preventScroll: true });
    announce('Sačuvani favorit je poništen.');
  });

  selectionMessage.addEventListener('click', () => selectionMessage.select());
  document.querySelector('#copy-choice').addEventListener('click', async () => {
    selectionMessage.focus({ preventScroll: true });
    selectionMessage.select();
    selectionMessage.setSelectionRange(0, selectionMessage.value.length);
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(selectionMessage.value);
        copyStatus.textContent = 'Poruka je kopirana. Pošalji je u razgovoru kad budeš spreman.';
        return;
      } catch { /* The selected text remains available for manual copying. */ }
    }
    copyStatus.textContent = 'Tekst je označen. Kopiraj ga sa ⌘C ili Ctrl+C, pa pošalji u razgovoru.';
  });

  document.querySelector('#close-original').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    lastModalTrigger?.focus({ preventScroll: true });
    modalCandidate = null;
  });

  updateAppearance();
})();
