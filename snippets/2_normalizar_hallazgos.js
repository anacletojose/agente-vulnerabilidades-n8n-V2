// Etapa 2 · Normalizar la salida del extractor + control de calidad
const prep = $('Preparar texto').first().json;
const salida = $input.first().json.output || {};
const lista = Array.isArray(salida.hallazgos) ? salida.hallazgos : [];
const advertencias = [];
if (prep.truncado) advertencias.push('El reporte superó el límite de caracteres y fue truncado.');

const hallazgos = lista.map((h, i) => ({
  id: 'H-' + String(i + 1).padStart(2, '0'),
  nombre: h.nombre || 'Sin nombre',
  cves: [...new Set((h.cves || []).map(c => String(c).toUpperCase().trim()).filter(c => /^CVE-\d{4}-\d{4,7}$/.test(c)))],
  cwe: h.cwe || '',
  severidad_reportada: h.severidad_reportada || 'No indicada',
  cvss_reportado: typeof h.cvss_reportado === 'number' ? h.cvss_reportado : null,
  activos: Array.isArray(h.activos) ? h.activos : [],
  evidencia: h.evidencia || '',
  remediacion_reportada: h.remediacion_reportada || '',
}));

// ¿El LLM omitió algún CVE que la regex sí vio? -> advertencia (no se inventa nada)
const extraidos = new Set(hallazgos.flatMap(h => h.cves));
const omitidos = prep.cvesDetectados.filter(c => !extraidos.has(c));
if (omitidos.length) advertencias.push('CVEs presentes en el reporte que el extractor no asoció a un hallazgo: ' + omitidos.join(', '));
// ¿El LLM "inventó" algún CVE que no aparece en el texto? -> se elimina
for (const h of hallazgos) {
  const inventados = h.cves.filter(c => !prep.cvesDetectados.includes(c));
  if (inventados.length) {
    advertencias.push(`${h.id}: se descartaron CVEs que no figuran en el reporte (${inventados.join(', ')}).`);
    h.cves = h.cves.filter(c => prep.cvesDetectados.includes(c));
  }
}
if (!hallazgos.length) advertencias.push('El extractor no identificó hallazgos. Revisar el reporte manualmente.');

const cves = [...new Set(hallazgos.flatMap(h => h.cves))];
return [{ json: { hallazgos, cves, cvesCsv: cves.join(','), advertencias, contexto: prep.contexto, archivo: prep.archivo } }];
