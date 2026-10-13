# Agente multiagente para el análisis seguro de reportes de vulnerabilidades

Workflow de **n8n** que procesa reportes de seguridad en PDF ---por
ejemplo, resultados de escáneres, pentests o auditorías--- y produce un
informe HTML con hallazgos normalizados, prioridades calculadas mediante
reglas explícitas, análisis redactado por IA y planes de remediación
propuestos.

El flujo incorpora una inspección específica para detectar posibles
intentos de *prompt injection*, manipulación de prioridades y
solicitudes de exfiltración de información incrustadas en los
documentos. Está pensado como material práctico para experimentar con
agentes de IA aplicados a ciberseguridad; no reemplaza la revisión de un
analista.

## Flujo general

``` text
PDF + contexto opcional
        │
        ├── Extracción y normalización de hallazgos
        │
        └── Inspección de seguridad documental
                    │
            Consolidación de resultados
                    │
       EPSS + catálogo CISA KEV + reglas
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
 Analista de vulnerabilidades  Agente de plan de remediación
          │                    │
          └─────────┬──────────┘
                    ▼
       Combinación de ambas salidas
                    │
          Generación del informe HTML
                    │
             Presentación al usuario
```

## Qué hace cada etapa

  -----------------------------------------------------------------------
  Etapa                   Función                 Mecanismo principal
  ----------------------- ----------------------- -----------------------
  1\. Entrada             Presenta un formulario  Formulario de n8n
                          para cargar un PDF y,   
                          opcionalmente, agregar  
                          contexto sobre la       
                          organización o sus      
                          activos.                

  2\. Preparación         Extrae el texto,        Código
                          normaliza espacios y    
                          saltos de línea,        
                          identifica CVE con      
                          patrones y limita el    
                          texto procesado a       
                          60.000 caracteres. Si   
                          no hay texto extraíble, 
                          se detiene y solicita   
                          un PDF con texto        
                          seleccionable u OCR     
                          previo.                 

  3\. Extracción          Convierte los hallazgos Modelo Gemini con
                          del documento a una     esquema de salida
                          estructura definida:    
                          nombre, CVE/CWE,        
                          severidad reportada,    
                          activos, evidencia y    
                          remediación mencionada. 

  4\. Normalización       Asigna identificadores  Código
                          como `H-01`, valida el  
                          formato de los CVE y    
                          descarta                
                          identificadores que el  
                          extractor haya generado 
                          pero que no aparezcan   
                          en el texto detectado.  
                          Registra advertencias   
                          si faltan hallazgos o   
                          hay inconsistencias.    

  5\. Inspección          Busca indicadores como  Reglas
  documental              caracteres invisibles,  determinísticas +
                          comentarios o etiquetas modelo Gemini
                          HTML, frases de         
                          anulación de            
                          instrucciones, intentos 
                          de alterar prioridades  
                          y solicitudes de        
                          revelar secretos. Un    
                          segundo componente de   
                          IA evalúa el texto y    
                          clasifica las señales.  

  6\. Enriquecimiento y   Consulta EPSS y el      APIs públicas + código
  priorización            catálogo CISA KEV;      
                          combina esa información 
                          con CVSS o una          
                          estimación basada en la 
                          severidad reportada y   
                          aplica reglas de        
                          prioridad explícitas.   

  7\. Análisis en         Dos agentes trabajan    Dos agentes Gemini
  paralelo                sobre los hallazgos     
                          priorizados: uno        
                          redacta el análisis     
                          técnico/ejecutivo y     
                          otro elabora un plan de 
                          remediación por         
                          hallazgo. Ambos pueden  
                          consultar NVD cuando    
                          corresponda.            

  8\. Integración         Combina las salidas de  Nodos Merge y Code
                          ambos agentes y         
                          normaliza los planes;   
                          si falta un plan,       
                          agrega recomendaciones  
                          conservadoras y         
                          advertencias.           

  9\. Presentación        Construye una página    Código + formulario de
                          HTML con resumen,       respuesta
                          detalle de cada         
                          hallazgo, métricas,     
                          recomendación y plan de 
                          remediación.            
  -----------------------------------------------------------------------

## Cómo se determina la prioridad

La prioridad se calcula mediante reglas en el nodo
**`Enriquecer y priorizar`**; los agentes reciben los resultados y
tienen instrucciones de no modificarlos.

  -----------------------------------------------------------------------
  Prioridad               Regla aplicada          Plazo sugerido
  ----------------------- ----------------------- -----------------------
  **P1 · Urgente**        El CVE figura en CISA   7 días
                          KEV, o CVSS es igual o  
                          superior a 9 y EPSS es  
                          igual o superior a 0,1  
                          (10 %).                 

  **P2 · Alta**           CVSS es igual o         30 días
                          superior a 7, o EPSS es 
                          igual o superior a 0,1  
                          (10 %), si no se aplicó 
                          P1.                     

  **P3 · Media**          CVSS es igual o         90 días
                          superior a 4, si no se  
                          aplicó una prioridad    
                          anterior.               

  **P4 · Baja**           No se cumple ninguna    Próxima ventana de
                          condición anterior.     mantenimiento
  -----------------------------------------------------------------------

Cuando el reporte no proporciona CVSS, el flujo usa una correspondencia
aproximada a partir de la severidad reportada: Crítica → 9, Alta → 7,
Media → 4, Baja → 0,1 e Informativa → 0. Esto es una regla de respaldo,
no una medición CVSS obtenida del producto.

-   **EPSS** estima la probabilidad de que una vulnerabilidad sea
    explotada; no confirma por sí sola una explotación real.
-   **CISA KEV** identifica vulnerabilidades conocidas por haber sido
    explotadas. La presencia en el catálogo activa P1 en este workflow.
-   Si EPSS o KEV no están disponibles, el flujo agrega advertencias; la
    prioridad puede quedar calculada con información incompleta.
-   Las prioridades y los plazos son criterios de ejemplo y deben
    ajustarse a la política de riesgos de la organización.

## Los dos agentes

### Analista de vulnerabilidades

Prepara un resumen para gerencia y una explicación técnica por hallazgo:
descripción simple, impacto para el negocio, recomendación y
observaciones de calidad. Para hallazgos con CVE de prioridad P1 o P2,
tiene instrucciones de consultar NVD, con un máximo de seis consultas.
No debe inventar versiones, parches ni activos, ni incluir instrucciones
de explotación.

### Generar plan de remediación

Trabaja en paralelo con el analista y genera un plan estructurado para
cada identificador recibido. El plan incluye:

-   Objetivo.
-   Acciones propuestas y ordenadas.
-   Prerrequisitos.
-   Validación posterior.
-   Procedimiento de reversión.
-   Riesgos del cambio.
-   Datos faltantes.
-   Nivel de confianza y necesidad de aprobación.

Para cada hallazgo que incluye un CVE, el agente tiene instrucciones de
consultar NVD ---un CVE por llamada, hasta seis consultas--- para
corroborar la descripción y los datos oficiales antes de recomendar una
remediación. Si NVD falla o no aporta datos, debe continuar con la
información disponible y dejar constancia de la limitación.

Los planes son **propuestas informativas**. El workflow no aplica
parches ni ejecuta cambios sobre los sistemas. La combinación posterior
conserva los hallazgos y añade valores conservadores o advertencias
cuando no se obtiene un plan estructurado.

## Seguridad documental y límites

El flujo incluye dos mecanismos complementarios:

1.  **Inspección determinística:** busca ciertos patrones de texto,
    caracteres de formato invisibles, comentarios y etiquetas HTML
    potencialmente activas, además de secuencias largas compatibles con
    Base64.
2.  **Detector con IA:** clasifica posibles intentos de prompt
    injection, manipulación de clasificación, exfiltración,
    interferencia con herramientas u ocultamiento de instrucciones.

El resultado se incorpora como `seguridad_documental`, junto con
evidencias, categorías, confianza y una acción recomendada. Si el
documento se marca como sospechoso, el flujo agrega una advertencia y
recomienda revisión humana; el agente analista tiene instrucciones de no
suprimir hallazgos por esa razón y el agente de remediación debe pedir
aprobación ante señales sospechosas o incertidumbre.

**Importante:** estas comprobaciones son defensas de apoyo, no una
garantía de detección. Puede haber falsos positivos y falsos negativos;
los documentos y los resultados generados deben revisarse antes de
distribuirse o actuar sobre ellos.

## Requisitos

-   Una instalación de n8n con soporte para los nodos incluidos en el
    JSON.
-   Credenciales de Google Gemini configuradas en los cuatro nodos de
    modelo: extractor, detector, analista y plan de remediación.
-   Acceso a Internet desde n8n para consultar los servicios públicos de
    EPSS, CISA KEV y NVD.
-   Permisos de red que permitan a n8n realizar solicitudes HTTP a esos
    servicios.
-   PDF con texto extraíble. Los PDF escaneados pueden requerir OCR
    antes de cargarlos.
-   La API key de NVD es opcional; puede ayudar con los límites de
    consulta, según las condiciones vigentes del servicio.

Las credenciales no se incluyen en el JSON exportado. Deben configurarse
desde la instancia de n8n y mantenerse fuera del workflow compartido.

## Instalación e importación

1.  Iniciá n8n y abrí su interfaz web.
2.  Importá el archivo
    `Agente_multiagente_Gemini_V2_paralelo_remediacion_con_NVD_fix_schema.json`
    como un workflow nuevo.
3.  Abrí cada nodo de modelo Gemini y seleccioná o creá las credenciales
    correspondientes.
4.  Revisá las credenciales, los parámetros de los nodos y el acceso de
    red a EPSS, CISA KEV y NVD.
5.  Guardá el workflow y realizá una prueba con un reporte ficticio o
    autorizado antes de usar documentos reales.

Los nombres de nodos y las opciones de interfaz pueden variar entre
versiones de n8n. Si el JSON no se importa correctamente, comprobá la
compatibilidad de la versión instalada y de los nodos LangChain/Gemini.

## Uso

1.  Ejecutá el workflow para abrir el formulario.
2.  Cargá un PDF de auditoría, pentest o escaneo.
3.  Opcionalmente, completá **Contexto** con datos útiles, por ejemplo,
    si un activo está expuesto a Internet o qué función de negocio
    cumple.
4.  Esperá a que finalicen la extracción, la inspección documental, las
    consultas de enriquecimiento y los dos agentes.
5.  Revisá el informe HTML. Prestá especial atención a las advertencias
    de calidad, las señales de seguridad documental, los datos faltantes
    y los planes que requieran aprobación.

## Privacidad y uso responsable

-   Los textos del PDF y el contexto se envían a los modelos de Google
    Gemini configurados. Verificá las condiciones de privacidad,
    retención y tratamiento de datos del proveedor antes de procesar
    reportes reales.
-   Los hallazgos pueden revelar nombres internos de servidores,
    topología, debilidades y otros datos sensibles. Usá datos ficticios
    o sanitizados para pruebas y restringí el acceso a los resultados.
-   No cargues credenciales, claves API ni secretos que no sean
    necesarios para el análisis.
-   El texto del reporte se trata como dato no confiable; las
    instrucciones incluidas en él no deben modificar las reglas de los
    agentes. Esta mitigación no elimina por completo el riesgo de prompt
    injection.
-   Las recomendaciones deben ser revisadas y aprobadas por personal
    autorizado. Evaluá impacto, ventana de mantenimiento, respaldo y
    reversión antes de aplicar cualquier cambio.
-   El informe generado es un borrador asistido por IA, no una
    certificación de seguridad ni una garantía de que todas las
    vulnerabilidades fueron detectadas.

## Posibles mejoras

-   Añadir aprobación humana formal antes de exportar o distribuir el
    informe.
-   Incorporar pruebas automáticas con documentos benignos y documentos
    que contengan intentos controlados de prompt injection.
-   Medir precisión, exhaustividad, falsos positivos y falsos negativos
    del detector documental.
-   Añadir inventario de activos y criticidad de negocio a las reglas de
    priorización.
-   Exportar el informe a PDF y crear tickets en una herramienta de
    gestión de incidencias.
-   Registrar las consultas realizadas, las fuentes consultadas y la
    justificación de cada recomendación para facilitar la auditoría.
-   Evaluar el comportamiento de los agentes ante fallos de APIs,
    respuestas incompletas y datos contradictorios.
