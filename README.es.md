# Herbario IA

Herbario IA es una aplicación web moderna y orientada a dispositivos móviles, diseñada para entusiastas de las plantas. Utiliza el poder de la IA de Gemini de Google para identificar plantas a partir de fotos, diagnosticar enfermedades y proporcionar una gran cantidad of información sobre sus usos, propiedades y cuidados.

## Características Principales

- **Identificación Multimodal de Plantas**: Identifica plantas al instante tomando una foto, subiendo una imagen o buscando por nombre. La aplicación tiene en cuenta la geolocalización para mejorar la precisión con la flora local.
- **Diagnóstico de Enfermedades de Plantas**: Toma una foto de una planta enferma y la IA diagnosticará posibles enfermedades, plagas o deficiencias nutricionales, ofreciendo opciones de tratamiento orgánico y químico.
- **Buscador de Remedios**: Busca plantas basándote en síntomas o usos tradicionales (p. ej., "alivio para el dolor de cabeza"). La búsqueda puede priorizar plantas nativas de tu ubicación actual.
- **Perfiles Detallados de Plantas**: Obtén información completa para cada planta identificada, incluyendo:
  - **Datos Botánicos**: Nombre científico, sinónimos, descripción, hábitat y estado de conservación.
  - **Usos**: Aplicaciones medicinales y culinarias detalladas.
  - **Ciencia**: Compuestos activos clave y advertencias de toxicidad.
  - **Guías Prácticas**: Recetas de preparación tradicionales con instrucciones, dosis y contexto histórico.
  - **Seguridad**: Comparaciones claras con plantas tóxicas de apariencia similar para evitar confusiones.
  - **Mapa de Distribución**: Un mapa generado por IA que muestra las regiones nativas y naturalizadas de la planta.
- **Guías de Cuidado Completas Generadas por IA**: Ve más allá de la identificación. Genera guías detalladas que cubren:
    - Riego, Luz, Suelo, Temperatura, Fertilización y Control de Plagas.
    - **Trasplante**: Aprende cuándo y cómo darle a tu planta un nuevo hogar.
    - **Propagación**: Instrucciones sencillas para multiplicar tus plantas.
    - **Consejos Adicionales**: Descubre si tu planta purifica el aire, si es segura para mascotas y otros datos curiosos.
- **Comparador Botánico**: Una herramienta única para comparar dos plantas diferentes una al lado de la otra, analizando sus usos medicinales, compuestos activos y niveles de toxicidad.
- **Herbario Personal**: Guarda tus hallazgos favoritos o más relevantes en una colección personal, filtrable y ordenable. También puedes exportar los datos de tu herbario a un archivo JSON.
- **Historial de Sesión**: Guarda automáticamente tus consultas recientes para un acceso rápido.
- **Interfaz Bilingüe**: Totalmente disponible en español e inglés.

## Cómo Usar

1.  **Selecciona un Modo**: Elige entre `Identificar`, `Diagnosticar` o `Remedio`.
2.  **Proporciona la Entrada**:
    - Para **Identificar**: Toma una foto, sube una imagen o escribe el nombre de la planta.
    - Para **Diagnosticar**: Sube una foto de la planta afectada.
    - Para **Remedio**: Escribe un síntoma o uso y, opcionalmente, activa la geolocalización para obtener resultados locales.
3.  **Analizar**: La IA procesará tu solicitud y devolverá una ficha de información detallada.
4.  **Explora**: Navega por las diferentes secciones del resultado.
5.  **Generar Guía de Cuidado**: Si has identificado una planta, haz clic en el botón "Generar Guía de Cuidado" para obtener instrucciones personalizadas.
6.  **Guarda y Compara**: Guarda la planta en tu Herbario personal o usa la herramienta de Comparar para analizarla frente a otra planta.

## Pila Tecnológica

- **Frontend**: React (con Hooks)
- **IA**: Google Gemini API (`gemini-2.5-flash` para análisis, `imagen-4.0-generate-001` para generación de imágenes)
- **Estilos**: Tailwind CSS
- **Despliegue**: Se ejecuta directamente en el navegador usando módulos ES y un `import map`.

## Descargo de Responsabilidad

Esta aplicación está destinada únicamente a fines educativos e informativos. No sustituye el consejo profesional médico, veterinario o botánico. Consulta siempre a un experto cualificado antes de consumir cualquier planta o aplicar cualquier tratamiento. La identificación basada en IA puede no ser 100% precisa.