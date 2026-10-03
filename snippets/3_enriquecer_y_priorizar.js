// Etapa 3 · Enriquecer con EPSS + CISA KEV y priorizar con reglas explícitas (auditable)
const base = $('Normalizar hallazgos').first().json;
const avisos = [...base.advertencias];

const epss = {};
try {
  for (const d of $('Consultar EPSS').first().json.data || []) {
    epss[d.cve] = { score: Number(d.epss), percentil: Number(d.percentile), fecha: d.date };
  }
} catch (e) { /* se informa abajo */ }
if (base.cves.length && !Object.keys(epss).length) avisos.push('EPSS no disponible: la priorización usa solo CVSS y KEV.');

const kev = {};
try {
  for (const v of $('Descargar CISA KEV').first().json.vulnerabilities || []) {
    kev[v.cveID] = { fechaAlta: v.dateAdded, ransomware: v.knownRansomwareCampaignUse, fechaLimiteCISA: v.dueDate };
  }
} catch (e) { /* se informa abajo */ }
if (!Object.keys(kev).length) avisos.push('Catálogo CISA KEV no disponible: puede subestimarse la urgencia.');

const CVSS_POR_SEVERIDAD = { 'Crítica': 9.0, 'Alta': 7.0, 'Media': 4.0, 'Baja': 0.1, 'Informativa': 0 };
const PLAZOS = { P1: '7 días', P2: '30 días', P3: '90 días', P4: 'Próxima ventana de mantenimiento' };
const ETIQUETAS = { P1: 'Urgente', P2: 'Alta', P3: 'Media', P4: 'Baja' };

const hallazgos = base.hallazgos.map(h => {
  const enKev = h.cves.filter(c => kev[c]).map(c => ({ cve: c, ...kev[c] }));
  const epssMax = h.cves.reduce((m, c) => Math.max(m, epss[c]?.score ?? 0), 0);
  const cvss = h.cvss_reportado ?? CVSS_POR_SEVERIDAD[h.severidad_reportada] ?? null;
  const motivos = [];
  let p;
  if (enKev.length) { p = 'P1'; motivos.push('Explotación activa confirmada (CISA KEV)'); }
  else if (cvss !== null && cvss >= 9 && epssMax >= 0.1) { p = 'P1'; motivos.push('CVSS crítico y alta probabilidad de explotación (EPSS)'); }
  else if ((cvss !== null && cvss >= 7) || epssMax >= 0.1) { p = 'P2'; motivos.push(cvss >= 7 ? `CVSS ${cvss}` : `EPSS ${(epssMax * 100).toFixed(1)}%`); }
  else if (cvss !== null && cvss >= 4) { p = 'P3'; motivos.push(`CVSS ${cvss}`); }
  else { p = 'P4'; motivos.push('Severidad baja o no indicada'); }
  if (enKev.some(k => k.ransomware === 'Known')) motivos.push('Usada en campañas de ransomware');
  return {
    ...h, cvss, epss: epssMax, kev: enKev,
    prioridad: p, importancia: `${p} · ${ETIQUETAS[p]}`, plazo: PLAZOS[p], motivos,
  };
}).sort((a, b) => a.prioridad.localeCompare(b.prioridad) || b.epss - a.epss || (b.cvss ?? 0) - (a.cvss ?? 0));

const resumen = { total: hallazgos.length, P1: 0, P2: 0, P3: 0, P4: 0, enKev: hallazgos.filter(h => h.kev.length).length };
for (const h of hallazgos) resumen[h.prioridad]++;
const equipos = [...new Set(hallazgos.flatMap(h => h.activos.map(a => a.host || a.ip)).filter(Boolean))];

return [{ json: { hallazgos, resumen, equipos, avisos, contexto: base.contexto, archivo: base.archivo } }];
