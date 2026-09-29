# Agente de análisis de reportes de vulnerabilidades en n8n

Agente construido en [n8n](https://n8n.io) que lee reportes de seguridad en PDF (escáneres, pentests, auditorías) y genera un **informe priorizado de vulnerabilidades**: nombre, importancia, equipos afectados, descripción simple, impacto, explotación activa, recomendación y plazo.

Material del taller *Agentes en n8n aplicados a ciberseguridad*.

## Cómo funciona

```
PDF ─► 1. Ingesta ─► 2. Extracción (LLM) ─► 3. Enriquecimiento y priorización ─► 4. Agente analista ─► 5. Informe HTML
        sanitizar     texto → JSON           EPSS + CISA KEV + reglas             redacta, consulta NVD
```

| Etapa | Qué hace | Quién decide |
| --- | --- | --- |
| 1 · Ingesta | Formulario, extracción del texto del PDF, limpieza y límite de tamaño | Código |
| 2 · Extracción | Convierte el reporte a JSON con un esquema fijo | LLM (cadena, no agente) |
| 3 · Priorización | Consulta [FIRST EPSS](https://www.first.org/epss/) y [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) y aplica reglas explícitas | Reglas en código |
| 4 · Análisis | Redacta para público técnico y gerencial; usa [NVD](https://nvd.nist.gov/developers/vulnerabilities) como herramienta cuando lo necesita | Agente |
| 5 · Entrega | Arma el informe con una plantilla fija | Código |

La importancia **no la decide el LLM**: se calcula con reglas auditables.

| Prioridad | Condición | Plazo sugerido |
| --- | --- | --- |
| P1 · Urgente | En CISA KEV, o CVSS ≥ 9 y EPSS ≥ 10 % | 7 días |
| P2 · Alta | CVSS ≥ 7 o EPSS ≥ 10 % | 30 días |
| P3 · Media | CVSS ≥ 4 | 90 días |
| P4 · Baja | Resto | Próxima ventana de mantenimiento |

Las reglas están en `snippets/3_enriquecer_y_priorizar.js` y se pueden adaptar a la política de cada organización.

## Contenido del repositorio

| Ruta | Descripción |
| --- | --- |
| `workflows/agente_vulnerabilidades_n8n_claude.json` | Workflow con Claude (Haiku 4.5 para extraer, Sonnet 5 para el analista) |
| `workflows/agente_vulnerabilidades_n8n_openai.json` | Mismo workflow con OpenAI (`gpt-5-mini`) |
| `reportes-ejemplo/` | Dos reportes **ficticios** para probar: uno tipo escáner y uno narrativo de pentest |
| `snippets/` | Código de los nodos Code y prompts de cada versión, para construirlo paso a paso |

## Requisitos

- n8n 2.40 o superior (self-hosted o n8n Cloud)
- API key de Anthropic (versión Claude) o de OpenAI (versión OpenAI)
- Acceso a Internet hacia `api.first.org`, `www.cisa.gov` y `services.nvd.nist.gov`
- Opcional: [API key de NVD](https://nvd.nist.gov/developers/request-an-api-key) para evitar límites de consultas

## Instalación

1. Levantar n8n, por ejemplo con Docker:
   ```bash
   docker volume create n8n_data
   docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
   ```
2. Abrir `http://localhost:5678`, crear un workflow vacío y en el menú **⋯ → Import from File…** elegir uno de los JSON de `workflows/`.
3. Abrir cada nodo de modelo (Claude u OpenAI) y crear la credencial con la API key.
4. Guardar con Ctrl+S.

## Uso

1. Clic en **Execute workflow**: se abre el formulario.
2. Subir un PDF de `reportes-ejemplo/`.
3. Opcional: completar **Contexto** con información de los equipos, por ejemplo:
   ```
   fw-perimetral-01 y vpn-gw-01 están expuestos a Internet. app-interna-03 es el ERP de facturación.
   ```
   El contexto enriquece el impacto y las recomendaciones, pero no cambia la prioridad.
4. En 1 o 2 minutos el informe aparece en el navegador.

## Seguridad

- Los reportes de vulnerabilidades son información sensible: su contenido se envía al proveedor del modelo. Para reportes reales, usar APIs sin retención de datos o un modelo local (por ejemplo con Ollama).
- El contenido del reporte se trata como dato y no como instrucción, para mitigar la inyección de prompts.
- El informe generado es un **borrador que debe revisar un analista** antes de distribuirse.
- Los reportes de ejemplo usan una empresa ficticia, IPs de documentación (RFC 5737) y redes privadas.

## Mejoras posibles

Aprobación humana antes del envío (Slack/Gmail *Send and Wait for Approval*), nodo Guardrails, parser determinístico para exportaciones `.nessus` u OpenVAS, inventario de activos para priorizar por criticidad, creación de tickets (Jira, GLPI) y evaluaciones del agente con n8n *Evaluations*.
