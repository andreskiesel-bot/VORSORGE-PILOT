/**
 * Förderrechner für deutsche Altersvorsorge
 * Berechnet maximale staatliche Fördervorteile für bAV, Riester und Basisrente
 */

// Konstanten für 2025
const KONSTANTEN_2025 = {
  BBG_RV: 96600,
  bav_svfrei_prozent: 0.04,
  bav_steuerfrei_prozent: 0.08,
  bav_svfrei_betrag: 3864,      // 4% von 96.600
  bav_steuerfrei_betrag: 7728,  // 8% von 96.600
  riester_grundzulage: 175,
  riester_kinderzulage_pre_2008: 185,
  riester_kinderzulage_ab_2008: 300,
  riester_hoechstbetrag: 2100,
  riester_mindestbeitrag: 60,
  basisrente_limit_single: 29344,
  basisrente_limit_verheiratet: 58688,
  basisrente_sparquote_max: 0.20
};

/**
 * Berechnet den Grenzsteuersatz basierend auf dem Einkommen (vereinfacht)
 */
function berechneGrenzsteuersatz(bruttoJahresEinkommen) {
  // Vereinfachte Berechnung basierend auf Einkommen
  if (bruttoJahresEinkommen <= 11604) return 0;
  if (bruttoJahresEinkommen <= 20000) return 0.14;
  if (bruttoJahresEinkommen <= 30000) return 0.24;
  if (bruttoJahresEinkommen <= 50000) return 0.30;
  if (bruttoJahresEinkommen <= 70000) return 0.35;
  if (bruttoJahresEinkommen <= 100000) return 0.40;
  return 0.42; // Spitzensteuersatz
}

/**
 * Mappt den Beschäftigungsstatus auf die Berufsgruppe
 */
function mappeBerufsgruppe(status) {
  const mapping = {
    'Angestellt': 'angestellt_privat',
    'Beamter': 'beamter',
    'Selbständig': 'selbststaendig',
    'Freiberufler': 'selbststaendig'
  };
  return mapping[status] || 'angestellt_privat';
}

/**
 * Mappt den Familienstand
 */
function mappeFamilienstand(family) {
  if (family.includes('verheiratet')) return 'verheiratet';
  return 'single';
}

/**
 * Prüft, ob Riester-Berechtigung vorliegt
 */
function istRiesterBerechtigt(berufsgruppe) {
  return berufsgruppe === 'angestellt_privat' || 
         berufsgruppe === 'angestellt_oeD' || 
         berufsgruppe === 'beamter';
}

/**
 * Schätzt die Anzahl der Kinder basierend auf Familienstand
 */
function schaetzeKinder(familienstand, familyString) {
  // Wenn "mit Kindern" im String, schätzen wir 1-2 Kinder
  if (familyString && familyString.includes('Kinder')) {
    return {
      vor_2008: 0,
      ab_2008: familienstand === 'verheiratet' ? 2 : 1
    };
  }
  return { vor_2008: 0, ab_2008: 0 };
}

/**
 * Berechnet bAV-Förderung
 */
function berechneBAV(person, konstanten) {
  const { berufsgruppe, brutto_jahres_einkommen, grenztsteuersatz, sv_satz_arbeitnehmer } = person;
  
  // Nur für Angestellte/Beamte
  if (berufsgruppe === 'selbststaendig') {
    return {
      max_beitrag: 0,
      foerdervorteil: 0,
      eigener_aufwand: 0
    };
  }

  const bav_max_svfrei = Math.min(
    konstanten.bav_svfrei_betrag,
    konstanten.bav_svfrei_prozent * brutto_jahres_einkommen
  );

  const bav_max_steuerfrei = Math.min(
    konstanten.bav_steuerfrei_betrag,
    konstanten.bav_steuerfrei_prozent * brutto_jahres_einkommen
  );

  const bav_beitrag_svfrei = bav_max_svfrei;
  const bav_beitrag_nur_steuerfrei = Math.max(0, bav_max_steuerfrei - bav_beitrag_svfrei);

  const steuerersparnis_svfrei = bav_beitrag_svfrei * grenztsteuersatz;
  const sv_ersparnis_arbeitnehmer = berufsgruppe !== 'beamter' 
    ? bav_beitrag_svfrei * sv_satz_arbeitnehmer 
    : 0; // Beamte zahlen keine SV
  const steuerersparnis_nur_steuer = bav_beitrag_nur_steuerfrei * grenztsteuersatz;

  const foerdervorteil_bav = steuerersparnis_svfrei + sv_ersparnis_arbeitnehmer + steuerersparnis_nur_steuer;
  const eigener_aufwand_bav = bav_beitrag_svfrei + bav_beitrag_nur_steuerfrei;

  return {
    max_beitrag: eigener_aufwand_bav,
    foerdervorteil: Math.round(foerdervorteil_bav),
    eigener_aufwand: Math.round(eigener_aufwand_bav)
  };
}

/**
 * Berechnet Riester-Förderung
 */
function berechneRiester(person, konstanten) {
  const { riester_berechtigt, anzahl_kinder_vor_2008, anzahl_kinder_ab_2008, brutto_jahres_einkommen, grenztsteuersatz } = person;

  if (!riester_berechtigt) {
    return {
      max_beitrag: 0,
      foerdervorteil: 0,
      eigener_aufwand: 0
    };
  }

  const grundzulage = konstanten.riester_grundzulage;
  const kinderzulage = 
    anzahl_kinder_vor_2008 * konstanten.riester_kinderzulage_pre_2008 +
    anzahl_kinder_ab_2008 * konstanten.riester_kinderzulage_ab_2008;
  
  const gesamt_zulagen = grundzulage + kinderzulage;
  const mindesteigenbeitrag_theoretisch = 0.04 * brutto_jahres_einkommen;
  const mindesteigenbeitrag_nach_zulagen = Math.max(
    mindesteigenbeitrag_theoretisch - gesamt_zulagen,
    konstanten.riester_mindestbeitrag
  );

  const eigener_max_beitrag = Math.max(0, konstanten.riester_hoechstbetrag - gesamt_zulagen);
  const riester_beitrag = Math.min(
    Math.max(mindesteigenbeitrag_nach_zulagen, 0),
    eigener_max_beitrag
  );

  const steuerliche_entlastung_brutto = (riester_beitrag + gesamt_zulagen) * grenztsteuersatz;
  const steuerbonus = Math.max(0, steuerliche_entlastung_brutto - gesamt_zulagen);
  const foerdervorteil_riester = gesamt_zulagen + steuerbonus;
  const eigener_aufwand_riester = riester_beitrag;

  return {
    max_beitrag: Math.round(riester_beitrag),
    foerdervorteil: Math.round(foerdervorteil_riester),
    eigener_aufwand: Math.round(eigener_aufwand_riester)
  };
}

/**
 * Berechnet Basisrente (Rürup) Förderung
 */
function berechneBasisrente(person, konstanten) {
  const { familienstand, andere_rentenbeitraege, brutto_jahres_einkommen, grenztsteuersatz } = person;

  const limit_basisrente = familienstand === 'single' 
    ? konstanten.basisrente_limit_single 
    : konstanten.basisrente_limit_verheiratet;

  const max_abzugsfaehig = Math.max(0, limit_basisrente - andere_rentenbeitraege);
  const max_beitrag_nach_einkommen = brutto_jahres_einkommen * konstanten.basisrente_sparquote_max;
  const basisrente_beitrag = Math.min(max_abzugsfaehig, max_beitrag_nach_einkommen);

  const foerdervorteil_basisrente = basisrente_beitrag * grenztsteuersatz;
  const eigener_aufwand_basisrente = basisrente_beitrag;

  return {
    max_beitrag: Math.round(basisrente_beitrag),
    foerdervorteil: Math.round(foerdervorteil_basisrente),
    eigener_aufwand: Math.round(eigener_aufwand_basisrente)
  };
}

/**
 * Hauptfunktion: Berechnet alle Förderungen für eine Person
 */
function berechneFoerderungen(formData) {
  // Daten aus Formular extrahieren und mappen
  const bruttoMonatsEinkommen = parseFloat(formData.get('av_income')) || 0;
  const bruttoJahresEinkommen = bruttoMonatsEinkommen * 12;
  const status = formData.get('av_status') || '';
  const family = formData.get('av_family') || '';

  const berufsgruppe = mappeBerufsgruppe(status);
  const familienstand = mappeFamilienstand(family);
  const grenztsteuersatz = berechneGrenzsteuersatz(bruttoJahresEinkommen);
  const sv_satz_arbeitnehmer = berufsgruppe !== 'beamter' ? 0.20 : 0;
  const riester_berechtigt = istRiesterBerechtigt(berufsgruppe);
  const kinder = schaetzeKinder(familienstand, family);
  const andere_rentenbeitraege = 0; // Standard: keine anderen Rentenbeiträge

  const person = {
    berufsgruppe,
    brutto_jahres_einkommen: bruttoJahresEinkommen,
    riester_berechtigt,
    anzahl_kinder_vor_2008: kinder.vor_2008,
    anzahl_kinder_ab_2008: kinder.ab_2008,
    familienstand,
    grenztsteuersatz,
    sv_satz_arbeitnehmer,
    andere_rentenbeitraege
  };

  // Berechnungen durchführen
  const bav = berechneBAV(person, KONSTANTEN_2025);
  const riester = berechneRiester(person, KONSTANTEN_2025);
  const basisrente = berechneBasisrente(person, KONSTANTEN_2025);

  // Gesamtberechnung
  const eigener_aufwand_gesamt = bav.eigener_aufwand + riester.eigener_aufwand + basisrente.eigener_aufwand;
  const foerdervorteil_gesamt = bav.foerdervorteil + riester.foerdervorteil + basisrente.foerdervorteil;
  const foerderquote = eigener_aufwand_gesamt > 0 
    ? (foerdervorteil_gesamt / eigener_aufwand_gesamt) * 100 
    : 0;

  return {
    bav: {
      max_beitrag: bav.max_beitrag,
      foerdervorteil: bav.foerdervorteil
    },
    riester: {
      max_beitrag: riester.max_beitrag,
      foerdervorteil: riester.foerdervorteil
    },
    basisrente: {
      max_beitrag: basisrente.max_beitrag,
      foerdervorteil: basisrente.foerdervorteil
    },
    gesamt: {
      eigener_aufwand: Math.round(eigener_aufwand_gesamt),
      foerdervorteil: Math.round(foerdervorteil_gesamt),
      foerderquote: Math.round(foerderquote * 10) / 10 // Eine Dezimalstelle
    }
  };
}

// Export für Verwendung in anderen Modulen
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { berechneFoerderungen, KONSTANTEN_2025 };
}

