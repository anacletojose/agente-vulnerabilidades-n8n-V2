// Etapa 1 · Preparar y sanitizar el texto del reporte (determinístico)
const MAX_CHARS = 60000; // límite para controlar costo y ventana de contexto
const form = $('Subir reporte').first();
let texto = String($input.first().json.text || '');

// Normalizar espacios y saltos de línea
texto = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
if (!texto) {
  throw new Error('El PDF no tiene texto extraíble (¿es una imagen escaneada? requiere OCR).');
}
// Evitar que el contenido "cierre" los delimitadores que usamos en el prompt
texto = texto.replace(/<\/?reporte>/gi, '');

const truncado = texto.length > MAX_CHARS;
if (truncado) texto = texto.slice(0, MAX_CHARS);

// Lista de control: CVEs detectados por regex (sirve para verificar al LLM después)
const cvesDetectados = [...new Set((texto.match(/CVE-\d{4}-\d{4,7}/gi) || []).map(c => c.toUpperCase()))];

return [{
  json: {
    reporte: texto,
    contexto: String(form.json['Contexto'] || '').trim() || 'Sin contexto adicional.',
    archivo: form.binary?.Reporte?.fileName || 'reporte.pdf',
    cvesDetectados,
    truncado,
  },
}];
