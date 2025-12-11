// Separate Step-States für AV und BU
const stepState = {
  av: 0,
  bu: 0
};

let activeFlow = 'av';

// DOM-Elemente
const tabButtons = document.querySelectorAll('.tab');
const ctaButtons = document.querySelectorAll('[data-flow]');
const segmentCards = document.querySelectorAll('.segment-card');
const avForm = document.getElementById('av-form');
const buForm = document.getElementById('bu-form');
const avHeader = document.querySelector('.quiz-header');
const buHeader = document.querySelector('.bu-header');
const quizTitle = document.getElementById('quiz-title');
const thankyouSection = document.getElementById('danke');
const quizSection = document.getElementById('quiz');

// Progress-Elemente für AV
const avProgressFill = document.querySelector('.av-progress .progress-fill');
const avProgressLabel = document.querySelector('.av-progress-label');

// Progress-Elemente für BU
const buProgressFill = document.querySelector('.bu-progress .progress-fill');
const buProgressLabel = document.querySelector('.bu-progress-label');

// Step-Arrays für AV und BU
const avSteps = Array.from(document.querySelectorAll('.av-step'));
const buSteps = Array.from(document.querySelectorAll('.bu-step'));

function updateProgress(flow) {
  const currentStep = stepState[flow];
  const totalSteps = flow === 'av' ? avSteps.length : buSteps.length;
  const pct = ((currentStep + 1) / totalSteps) * 100;

  if (flow === 'av') {
    if (avProgressFill) {
      avProgressFill.style.width = `${pct}%`;
      avProgressFill.setAttribute('aria-valuenow', currentStep + 1);
      avProgressFill.setAttribute('aria-valuemax', totalSteps);
    }
    if (avProgressLabel) {
      avProgressLabel.textContent = `Schritt ${currentStep + 1} von ${totalSteps}`;
    }
  } else if (flow === 'bu') {
    if (buProgressFill) {
      buProgressFill.style.width = `${pct}%`;
      buProgressFill.setAttribute('aria-valuenow', currentStep + 1);
      buProgressFill.setAttribute('aria-valuemax', totalSteps);
    }
    if (buProgressLabel) {
      buProgressLabel.textContent = `Schritt ${currentStep + 1} von ${totalSteps}`;
    }
  }
}

function showStep(flow, index) {
  const steps = flow === 'av' ? avSteps : buSteps;
  const form = flow === 'av' ? avForm : buForm;

  if (!form || !steps.length) return;

  // Flow-Switch fix: Alle Steps des anderen Flows komplett ausblenden
  if (flow === 'av') {
    buSteps.forEach(step => step.hidden = true);
  } else {
    avSteps.forEach(step => step.hidden = true);
  }

  // Alle Steps des entsprechenden Flows ausblenden, außer dem aktuellen
  steps.forEach((step, idx) => {
    step.hidden = idx !== index;
  });

  // Navigation-Buttons aktualisieren
  const prev = form.querySelector('[data-nav="prev"]');
  const next = form.querySelector('[data-nav="next"]');
  const submit = form.querySelector('[data-submit]');
  const resultCta = form.querySelector('.result-cta');

  if (prev) prev.disabled = index === 0;
  
  // Für AV: Ergebnis-Step (index 2) hat eigenen "Mehr erfahren" Button
  if (flow === 'av') {
    if (index === 2) {
      // Ergebnis-Step: Standard-Navigation ausblenden, "Mehr erfahren" Button sichtbar
      if (next) next.hidden = true;
      if (submit) submit.hidden = true;
      if (resultCta) resultCta.hidden = false;
    } else if (index === steps.length - 1) {
      // Letzter Step (Kontakt): Submit-Button zeigen
      if (next) next.hidden = true;
      if (submit) submit.hidden = false;
      if (resultCta) resultCta.hidden = true;
    } else {
      // Zwischen-Steps: Standard-Navigation
      if (next) next.hidden = false;
      if (submit) submit.hidden = true;
      if (resultCta) resultCta.hidden = true;
    }
  } else {
    // BU: Standard-Verhalten
    if (next) next.hidden = index === steps.length - 1;
    if (submit) submit.hidden = index !== steps.length - 1;
    if (resultCta) resultCta.hidden = true;
  }
  
  // Ergebnis berechnen, wenn wir zum Ergebnis-Step (Step 3) navigieren
  if (flow === 'av' && index === 2) {
    calculateAvResult();
  }

  // Progress aktualisieren
  updateProgress(flow);
}

function validateStep(stepEl) {
  const inputs = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      input.focus({ preventScroll: true });
      return false;
    }
  }
  return true;
}

function calculateAvResult() {
  if (!avForm) return;
  
  const formData = new FormData(avForm);
  
  // Förderrechner verwenden
  const ergebnis = berechneFoerderungen(formData);
  
  // Ergebnis anzeigen
  const resultAmount = document.getElementById('av-result-amount');
  const resultList = document.getElementById('av-result-list');
  
  if (resultAmount) {
    // Gesamtförderbetrag anzeigen
    resultAmount.textContent = ergebnis.gesamt.foerdervorteil.toLocaleString('de-DE') + ' €';
  }
  
  if (resultList) {
    // Relevante Förderprogramme basierend auf Berechnung anzeigen mit Paragraphen
    const programs = [];
    
    if (ergebnis.bav.max_beitrag > 0) {
      programs.push(`§ 3 Nr. 63 EStG (Entgeltumwandlung): ${ergebnis.bav.foerdervorteil.toLocaleString('de-DE')} € Förderung`);
    }
    
    if (ergebnis.riester.max_beitrag > 0) {
      programs.push(`§ 10a EStG (Riester-Förderung): ${ergebnis.riester.foerdervorteil.toLocaleString('de-DE')} € Förderung`);
    }
    
    if (ergebnis.basisrente.max_beitrag > 0) {
      programs.push(`§ 10 Abs. 1 Nr. 2b EStG (Basisrente): ${ergebnis.basisrente.foerdervorteil.toLocaleString('de-DE')} € Förderung`);
    }
    
    // Falls keine Programme gefunden, Standard mit Paragraphen anzeigen
    if (programs.length === 0) {
      programs.push('§ 10a EStG (Riester-Förderung)');
      programs.push('§ 10 Abs. 1 Nr. 2b EStG (Basisrente)');
      programs.push('§ 3 Nr. 63 EStG (Entgeltumwandlung)');
    }
    
    resultList.innerHTML = programs.map(program => `<li>${program}</li>`).join('');
  }
  
  // Debug-Output in Konsole
  console.log('Förderberechnung:', ergebnis);
}

function setFlow(flow) {
  activeFlow = flow;

  // Flow-Switch fix: Tabs aktualisieren - konsistent data-flow verwenden
  tabButtons.forEach((tab) => {
    const isActive = tab.dataset.flow === flow;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  // Flow-Switch fix: Garantiert nur einen Flow sichtbar machen
  if (flow === 'av') {
    // AV sichtbar machen
    if (avForm) {
      avForm.hidden = false;
      // Flow-Switch fix: AV quiz-actions explizit sichtbar machen
      const avActions = avForm.querySelector('.quiz-actions');
      if (avActions) avActions.hidden = false;
    }
    if (avHeader) avHeader.hidden = false;
    if (quizTitle) quizTitle.textContent = 'Altersvorsorge-Check';
    
    // BU komplett ausblenden (Formular, Header, Steps, Actions)
    // Flow-Switch fix: BU-Header ausblenden (enthält auch BU-Progress)
    if (buForm) {
      buForm.hidden = true;
      // Flow-Switch fix: BU quiz-actions explizit ausblenden
      const buActions = buForm.querySelector('.quiz-actions');
      if (buActions) buActions.hidden = true;
    }
    if (buHeader) buHeader.hidden = true;
    // Flow-Switch fix: Alle BU-Steps ausblenden
    buSteps.forEach(step => step.hidden = true);
    
  } else if (flow === 'bu') {
    // BU sichtbar machen
    if (buForm) {
      buForm.hidden = false;
      // Flow-Switch fix: BU quiz-actions explizit sichtbar machen
      const buActions = buForm.querySelector('.quiz-actions');
      if (buActions) buActions.hidden = false;
    }
    if (buHeader) buHeader.hidden = false;
    if (quizTitle) quizTitle.textContent = 'BU-Check';
    
    // AV komplett ausblenden (Formular, Header, Steps, Actions)
    // Flow-Switch fix: AV-Header ausblenden (enthält auch AV-Progress)
    if (avForm) {
      avForm.hidden = true;
      // Flow-Switch fix: AV quiz-actions explizit ausblenden
      const avActions = avForm.querySelector('.quiz-actions');
      if (avActions) avActions.hidden = true;
    }
    if (avHeader) avHeader.hidden = true;
    // Flow-Switch fix: Alle AV-Steps ausblenden
    avSteps.forEach(step => step.hidden = true);
  }

  // Flow-Switch fix: Beim Flow-Wechsel immer auf Step 0 zurücksetzen
  stepState[flow] = 0;
  showStep(flow, 0);
}

function resetForm(flow) {
  const form = flow === 'av' ? avForm : buForm;
  if (form) {
    form.reset();
  }
  stepState[flow] = 0;
  showStep(flow, 0);
}

function showThankYou() {
  if (quizSection) quizSection.hidden = true;
  if (thankyouSection) {
    thankyouSection.hidden = false;
    thankyouSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleNavClick(event, form, flow) {
  const btn = event.target.closest('[data-nav]');
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();
  
  const steps = flow === 'av' ? avSteps : buSteps;
  const currentIndex = stepState[flow];
  const currentStep = steps[currentIndex];

  if (btn.dataset.nav === 'next') {
    // Validierung des aktuellen Steps (außer beim Ergebnis-Step)
    if (flow === 'av' && currentIndex === 2) {
      // Ergebnis-Step - keine Validierung nötig, direkt weiter
    } else {
      if (!validateStep(currentStep)) {
        return;
      }
    }

    // Zum nächsten Step
    const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
    stepState[flow] = nextIndex;
    showStep(flow, nextIndex);
  } else if (btn.dataset.nav === 'prev') {
    // Zum vorherigen Step
    const prevIndex = Math.max(currentIndex - 1, 0);
    stepState[flow] = prevIndex;
    showStep(flow, prevIndex);
  }
}

function handleAvSubmit(event) {
  event.preventDefault();

  const currentStep = avSteps[stepState.av];
  if (!validateStep(currentStep)) {
    return;
  }

  // Prüfe speziell die DSGVO-Checkbox
  const consentCheckbox = avForm.querySelector('input[name="av_consent"]');
  if (!consentCheckbox || !consentCheckbox.checked) {
    alert('Bitte akzeptiere die DSGVO-Einwilligung, um fortzufahren.');
    if (consentCheckbox) {
      consentCheckbox.focus({ preventScroll: true });
    }
    return;
  }

  if (!avForm.checkValidity()) {
    avForm.reportValidity();
    return;
  }

  // Daten sammeln
  const formData = new FormData(avForm);
  const payload = {};

  // Alle Formularfelder durchgehen (inkl. av_firstname, av_lastname)
  // + added firstname/lastname - Felder werden automatisch übernommen, da sie mit 'av_' beginnen
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('av_')) {
      payload[key] = value;
    }
  }

  payload.flow = 'av';
  payload.segmentPrefill = avForm.dataset.segmentPrefill || '';
  payload.timestamp = new Date().toISOString();

  // Lead an Backend senden
  console.log('AV Lead payload:', payload);
  sendLeadToBackend('av', payload);
}

function handleBuSubmit(event) {
  event.preventDefault();

  const currentStep = buSteps[stepState.bu];
  if (!validateStep(currentStep)) {
    return;
  }

  // Prüfe speziell die DSGVO-Checkbox
  const consentCheckbox = buForm.querySelector('input[name="bu_consent"]');
  if (!consentCheckbox || !consentCheckbox.checked) {
    alert('Bitte akzeptiere die DSGVO-Einwilligung, um fortzufahren.');
    if (consentCheckbox) {
      consentCheckbox.focus({ preventScroll: true });
    }
    return;
  }

  if (!buForm.checkValidity()) {
    buForm.reportValidity();
    return;
  }

  // Daten sammeln
  const formData = new FormData(buForm);
  const payload = {};

  // Alle Formularfelder durchgehen (inkl. bu_firstname, bu_lastname)
  // + added firstname/lastname - Felder werden automatisch übernommen, da sie mit 'bu_' beginnen
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('bu_')) {
      payload[key] = value;
    }
  }

  payload.flow = 'bu';
  payload.timestamp = new Date().toISOString();

  // Lead an Backend senden
  console.log('BU Lead payload:', payload);
  sendLeadToBackend('bu', payload);
}

// Funktion zum Senden an Backend
async function sendLeadToBackend(flow, payload) {
  try {
    console.log(`Lead ${flow} wird gesendet:`, payload);
    
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log('✅ Lead erfolgreich gespeichert:', result.leadId);
      // Danke-Seite anzeigen
      showThankYou();
      // Formular zurücksetzen für nächsten Durchlauf
      setTimeout(() => {
        resetForm(flow);
        setFlow(flow);
      }, 1000);
    } else {
      console.error('❌ Fehler beim Speichern:', result.error);
      alert('Es gab einen Fehler beim Senden deiner Anfrage. Bitte versuche es später erneut oder kontaktiere uns direkt.');
    }
  } catch (error) {
    console.error('❌ Netzwerkfehler:', error);
    // Auch bei Netzwerkfehler Danke-Seite anzeigen (optimistisch)
    showThankYou();
    setTimeout(() => {
      resetForm(flow);
      setFlow(flow);
    }, 1000);
  }
}

function prefillFromSegment(segment) {
  if (!avForm) return;

  const select = avForm.elements['av_status'];
  if (!select) return;

  if (segment === 'Angestellte' || segment === 'Akademiker') {
    select.value = 'Angestellt';
  } else if (segment === 'Selbständig') {
    select.value = 'Selbständig';
  } else {
    select.value = '';
  }

  avForm.dataset.segmentPrefill = segment;
}

// Event Listeners

// Flow-Switch fix: Tab-Wechsel - konsistent data-flow verwenden
tabButtons.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const flow = tab.dataset.flow;
    if (flow) {
      setFlow(flow);
    }
  });
});

// CTA-Buttons - Scrollen zum Quiz
ctaButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    setFlow(btn.dataset.flow);
    if (quizSection) {
      quizSection.hidden = false;
      quizSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Segment-Karten - Scrollen zum Quiz
segmentCards.forEach((card) => {
  card.addEventListener('click', (e) => {
    e.preventDefault();
    prefillFromSegment(card.dataset.segment);
    setFlow('av');
    if (quizSection) {
      quizSection.hidden = false;
      quizSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// AV-Formular Navigation
if (avForm) {
  // Direkte Event-Listener nur auf Navigation-Buttons
  const avNavButtons = avForm.querySelectorAll('[data-nav]');
  avNavButtons.forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleNavClick(event, avForm, 'av');
    });
  });
  
  avForm.addEventListener('submit', handleAvSubmit);
}

// BU-Formular Navigation
if (buForm) {
  // Direkte Event-Listener nur auf Navigation-Buttons
  const buNavButtons = buForm.querySelectorAll('[data-nav]');
  buNavButtons.forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleNavClick(event, buForm, 'bu');
    });
  });
  
  buForm.addEventListener('submit', handleBuSubmit);
}

// Verhindere Enter-Submit in Formularen (außer im letzten Step)
function preventEnterSubmit(event) {
  if (event.key === 'Enter') {
    const form = event.target.closest('form');
    if (form) {
      const submitBtn = form.querySelector('[data-submit]');
      if (!submitBtn || submitBtn.hidden) {
        event.preventDefault();
        const nextBtn = form.querySelector('[data-nav="next"]');
        if (nextBtn && !nextBtn.hidden) {
          nextBtn.click();
        }
      }
    }
  }
}

// Verhindere automatisches Scrollen bei Select-Elementen
(function() {
  let savedScroll = 0;
  
  document.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'SELECT') {
      savedScroll = window.pageYOffset || document.documentElement.scrollTop;
    }
  }, true);
  
  const preventSelectScroll = (e) => {
    if (e.target.tagName === 'SELECT') {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      if (Math.abs(currentScroll - savedScroll) > 10) {
        window.scrollTo({ top: savedScroll, behavior: 'instant' });
      }
    }
  };
  
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'SELECT') {
      savedScroll = window.pageYOffset || document.documentElement.scrollTop;
      requestAnimationFrame(() => preventSelectScroll(e));
      setTimeout(() => preventSelectScroll(e), 0);
      setTimeout(() => preventSelectScroll(e), 50);
    }
  }, true);
  
  document.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT') {
      requestAnimationFrame(() => preventSelectScroll(e));
      setTimeout(() => preventSelectScroll(e), 0);
    }
  }, true);
})();

// Nur oberer CTA-Button mit href="#quiz" darf scrollen
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href="#quiz"]');
  if (link && link.getAttribute('data-track') === 'cta-top-start') {
    e.preventDefault();
    if (quizSection) {
      quizSection.hidden = false;
      quizSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}, true);

// Zeige/Verstecke Textfelder basierend auf Ja/Nein-Auswahl
function setupConditionalFields() {
  // AV: Bestehende Altersvorsorge
  const avExistingSelect = document.getElementById('av_existing_select');
  const avExistingDetailsLabel = document.getElementById('av_existing_details_label');
  
  if (avExistingSelect && avExistingDetailsLabel) {
    avExistingSelect.addEventListener('change', () => {
      if (avExistingSelect.value === 'ja') {
        avExistingDetailsLabel.style.display = 'grid';
      } else {
        avExistingDetailsLabel.style.display = 'none';
        const input = avExistingDetailsLabel.querySelector('input');
        if (input) input.value = '';
      }
    });
  }
  
  // BU: Vorerkrankungen
  const buHealthSelect = document.getElementById('bu_health_select');
  const buHealthDetailsLabel = document.getElementById('bu_health_details_label');
  
  if (buHealthSelect && buHealthDetailsLabel) {
    buHealthSelect.addEventListener('change', () => {
      if (buHealthSelect.value === 'ja') {
        buHealthDetailsLabel.style.display = 'grid';
      } else {
        buHealthDetailsLabel.style.display = 'none';
        const input = buHealthDetailsLabel.querySelector('input');
        if (input) input.value = '';
      }
    });
  }
}

// Initialisierung - Flow-Switch fix: Sofort beim Laden ausführen
// Sicherstellen, dass beide Formulare korrekt initialisiert sind
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setFlow('av');
    setupConditionalFields();
  });
} else {
  // DOM ist bereits geladen
  setFlow('av');
  setupConditionalFields();
}
document.addEventListener('keydown', preventEnterSubmit);
