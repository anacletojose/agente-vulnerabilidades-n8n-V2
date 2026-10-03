// Etapa 5 · Armar el informe final: datos del workflow + redacción del agente
const datos = $('Enriquecer y priorizar').first().json;
const ia = $input.first().json.output || {};
const textos = Object.fromEntries((ia.hallazgos || []).map(h => [h.id, h]));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLOR = { P1: '#b42318', P2: '#c4320a', P3: '#b54708', P4: '#475467' };
const fecha = new Date().toLocaleDateString('es-AR');

const tarjetas = datos.hallazgos.map(h => {
  const t = textos[h.id] || {};
  const equipos = h.activos.map(a => [a.host, a.ip, a.puerto].filter(Boolean).join(' · ')).join('<br>') || 'No especificado';
  const kev = h.kev.length ? `Sí, en CISA KEV desde ${esc(h.kev[0].fechaAlta)}` : 'Sin evidencia pública de explotación activa';
  return `
  <section class="card">
    <h3><span class="badge" style="background:${COLOR[h.prioridad]}">${esc(h.importancia)}</span> ${esc(h.id)} · ${esc(t.nombre_simple || h.nombre)}</h3>
    <table>
      <tr><th>Nombre de la vulnerabilidad</th><td>${esc(h.nombre)}</td></tr>
      <tr><th>Identificadores</th><td>${esc(h.cves.join(', ') || h.cwe || 'Sin CVE')}</td></tr>
      <tr><th>Importancia</th><td><b>${esc(h.importancia)}</b> — ${esc(h.motivos.join('; '))}</td></tr>
      <tr><th>Equipos afectados</th><td>${equipos}</td></tr>
      <tr><th>Descripción</th><td>${esc(t.descripcion_simple || '')}</td></tr>
      <tr><th>Impacto para el negocio</th><td>${esc(t.impacto || '')}</td></tr>
      <tr><th>Explotación activa</th><td>${kev}</td></tr>
      <tr><th>Métricas</th><td>CVSS ${h.cvss ?? 'N/D'} · EPSS ${(h.epss * 100).toFixed(1)}% · Severidad reportada: ${esc(h.severidad_reportada)}</td></tr>
      <tr><th>Recomendación</th><td>${esc(t.recomendacion || h.remediacion_reportada)}</td></tr>
      <tr><th>Plazo sugerido</th><td>${esc(h.plazo)}</td></tr>
      ${t.nota_contexto ? `<tr><th>Nota de contexto</th><td>${esc(t.nota_contexto)}</td></tr>` : ''}
    </table>
  </section>`;
}).join('');

const avisos = [...datos.avisos, ...(ia.observaciones_calidad || [])];
const r = datos.resumen;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Informe de vulnerabilidades</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#1d2939;background:#fff}
h1{margin-bottom:4px} .muted{color:#667085;font-size:13px}
.kpis{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.kpi{border:1px solid #eaecf0;border-radius:8px;padding:10px 14px;min-width:90px}
.kpi b{display:block;font-size:22px}.card{border:1px solid #eaecf0;border-radius:10px;padding:4px 16px 12px;margin:14px 0}
.badge{color:#fff;border-radius:6px;padding:2px 8px;font-size:13px;margin-right:6px}
table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;width:210px;color:#475467;vertical-align:top;padding:5px 8px 5px 0}td{padding:5px 0}
.aviso{background:#fffaeb;border:1px solid #fedf89;border-radius:8px;padding:10px 14px;font-size:14px}
</style></head><body>
<h1>Informe de vulnerabilidades</h1>
<div class="muted">Fuente: ${esc(datos.archivo)} · Generado: ${fecha} · Borrador generado por IA: requiere revisión de un analista antes de distribuirse.</div>
<div class="kpis"><div class="kpi"><b>${r.total}</b>Hallazgos</div><div class="kpi"><b>${r.P1}</b>Urgentes (P1)</div><div class="kpi"><b>${r.P2}</b>Altas (P2)</div><div class="kpi"><b>${r.P3}</b>Medias (P3)</div><div class="kpi"><b>${r.P4}</b>Bajas (P4)</div><div class="kpi"><b>${r.enKev}</b>En CISA KEV</div></div>
<h2>Resumen ejecutivo</h2><p>${esc(ia.resumen_ejecutivo || '')}</p>
<p class="muted">Equipos afectados: ${esc(datos.equipos.join(', '))}</p>
${avisos.length ? `<div class="aviso"><b>Advertencias y control de calidad</b><ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
<h2>Detalle de hallazgos</h2>${tarjetas}
<p class="muted">Priorización: P1 = CISA KEV, o CVSS ≥ 9 con EPSS ≥ 10% · P2 = CVSS ≥ 7 o EPSS ≥ 10% · P3 = CVSS ≥ 4 · P4 = resto. Plazos orientativos: ajustarlos a la política de la organización.</p>
</body></html>`;

return [{ json: { html, resumen: datos.resumen } }];
