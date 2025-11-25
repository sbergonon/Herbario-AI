import { GoogleGenAI } from "@google/genai";
import { UserPreferences, ItineraryResult, GroundingSource, ItineraryStep, Theme, Transport } from "../types";
import { TRANSLATIONS } from "../constants";

// Helper to determine if a key looks valid
const isValidKey = (key: string | undefined): boolean => {
    if (!key) return false;
    // Basic Google API Key validation: Must start with AIza and be approx 39 chars
    return key.startsWith("AIza") && key.length > 35;
};

const getApiKey = (): string => {
  let key: string | undefined = undefined;

  // 1. Try Standard Vite (The correct way)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_GEMINI_API_KEY;
  }

  // 2. Fallback: Try checking for just "API_KEY" or "GEMINI_API_KEY" in Vite
  // (Usually Vite blocks this, but custom configs might allow it)
  // @ts-ignore
  if (!key && typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.API_KEY || import.meta.env.GEMINI_API_KEY;
  }

  // 3. Fallback: Try process.env (Node/Webpack compatibility mode)
  // Sometimes Render builds expose variables here depending on the build command
  if (!key && typeof process !== 'undefined' && process.env) {
      key = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  }
  
  // Cleaning: Remove whitespace and accidental quotes
  key = key ? key.trim().replace(/^['"]|['"]$/g, '') : "";

  // 1. Check if missing
  if (!key) {
      // DIAGNOSTIC LOGIC
      let debugMsg = "No se detectaron variables.";
      try {
          // @ts-ignore
          if (typeof import.meta !== 'undefined' && import.meta.env) {
             // @ts-ignore
             // Get keys that start with VITE_ to show the user what IS available
             const keys = Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'));
             if (keys.length > 0) {
                 debugMsg = `Variables VITE_ detectadas: ${keys.join(', ')}`;
             } else {
                 debugMsg = "El objeto import.meta.env existe pero no tiene variables que empiecen por VITE_.";
             }
          }
      } catch (e) {
          debugMsg = "Error al leer variables de entorno.";
      }

      throw new Error(`
        [ERROR: CLAVE NO ENCONTRADA]
        
        DIAGNÓSTICO EN VIVO:
        ${debugMsg}
        
        SI 'VITE_GEMINI_API_KEY' NO ESTÁ EN LA LISTA DE ARRIBA:
        1. Render Dashboard > Environment: ¿Está bien escrita? (Sin espacios, VITE_ al inicio).
        2. IMPORTANTE: Si cambiaste la variable hace poco, debes ir a "Manual Deploy > Clear build cache & deploy". Vite "cocina" las variables al compilar; si no recompilas limpiando caché, no verá el cambio.
      `);
  }

  // 2. Check if it's a placeholder (The Common Error)
  if (key.includes("PLACEHOLDER") || key.includes("tu_clave_aqui") || key.startsWith("YOUR_")) {
      throw new Error(`
        [ERROR CRÍTICO: ARCHIVO .ENV DETECTADO]
        La app está leyendo una clave falsa de un archivo local.
        Asegúrate de haber borrado '.env' o '.env.local' de GitHub.
      `);
  }

  // 3. Validate format
  if (!isValidKey(key)) {
       throw new Error(`La API Key detectada no es válida (Longitud: ${key.length}). Debe empezar por 'AIza'. Revisa que no haya espacios al principio o al final en Render.`);
  }

  return key;
};

const getAiClient = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
};

export const generateStepImage = async (title: string, description: string): Promise<string | null> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `Generate a high quality, photorealistic travel photography image of: ${title} in Amposta, Spain. The image should be bright, inviting, and suitable for a tourist guide. Context: ${description.slice(0, 200)}.` }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "4:3"
                }
            }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                 return `data:image/png;base64,${part.inlineData.data}`;
             }
        }
        return null;
    } catch (error) {
        console.error("Image gen error", error);
        return null;
    }
};

export const generateItinerary = async (prefs: UserPreferences): Promise<ItineraryResult> => {
  const modelId = 'gemini-2.5-flash';
  const t = TRANSLATIONS[prefs.language];

  // Get readable labels for the AI context
  let themeLabel = t.themes[prefs.theme].label;
  
  // Custom Mix Logic
  if (prefs.theme === Theme.CUSTOM) {
    if (prefs.customThemes && prefs.customThemes.length > 0) {
        const subThemeLabels = prefs.customThemes.map(th => t.themes[th].label).join(", ");
        themeLabel = `ITINERARIO PERSONALIZADO (MIX) que combine elementos de: ${subThemeLabels}. Organiza la ruta mezclando estos temas de forma lógica.`;
    } else {
        themeLabel = "Mix General: Lo mejor de Amposta (Historia, Naturaleza y Gastronomía).";
    }
  }

  const durationLabel = `${prefs.duration} ${prefs.duration === 1 ? t.label_day : t.label_days}`;
  const transportLabel = t.transports[prefs.transport];

  let transportInstruction = "";
  let locationScope = "El itinerario debe centrarse en la ciudad de Amposta y el Delta del Ebro.";
  let langInstruction = `RESPOND IN ${prefs.language === 'ca' ? 'CATALAN' : prefs.language === 'es' ? 'SPANISH' : 'ENGLISH'}.`;

  if (prefs.transport === Transport.RIVER) {
    if (prefs.includeUpriver) {
        transportInstruction = "El usuario desea una experiencia fluvial COMPLETA remontando el río Ebro. OBLIGATORIO: Dedica al menos medio día o un día entero a visitar TORTOSA (Catedral, Castillo de la Suda) o MIRAVET (Castillo Templario, Paso de Barca) llegando en barco o combinando barco/bus si es necesario. IMPRESCINDIBLE: Incluye horarios de salida de barcos desde Amposta, precios aproximados, dirección del embarcadero en Amposta y en destino.";
        locationScope = "El itinerario debe incluir Amposta y expandirse obligatoriamente río arriba hacia Tortosa o Miravet.";
    } else {
        transportInstruction = "El usuario está interesado en transporte fluvial por el Delta. INCLUYE OBLIGATORIAMENTE opciones de cruceros por la desembocadura. IMPRESCINDIBLE: En la descripción de la actividad fluvial, incluye la DIRECCIÓN EXACTA del embarcadero o punto de salida en Amposta.";
    }
  } else if (prefs.transport === Transport.BUS) {
    transportInstruction = "El usuario viaja en Autobús. IMPRESCINDIBLE: Indica claramente la dirección de la Estación de Autobuses de Amposta o las paradas específicas (ubicación de la parada) para llegar a los puntos de interés sugeridos.";
  } else if (prefs.transport === Transport.TRAIN) {
    transportInstruction = "El usuario viaja en TREN. IMPRESCINDIBLE: Ten en cuenta que la estación es 'L'Aldea-Amposta-Tortosa' (a unos km del centro). Incluye información sobre cómo llegar del tren al centro (Bus/Taxi) y coordina los tiempos.";
  } else if (prefs.transport === Transport.BIKE) {
    transportInstruction = "El usuario se mueve en BICICLETA. Prioriza rutas por carriles bici, caminos rurales del Delta (Caminos de Sirga) y la Vía Verde. Sugiere lugares donde aparcar la bici si es necesario.";
  } else if (prefs.transport === Transport.MIX) {
    if (prefs.customTransports && prefs.customTransports.length > 0) {
        const mixLabels = prefs.customTransports.map(tr => t.transports[tr]).join(", ");
        transportInstruction = `El usuario utilizará una COMBINACIÓN de transportes personalizada: ${mixLabels}. Para cada desplazamiento del itinerario, especifica explícitamente cuál de estos medios es el más lógico y eficiente (ej. "Ir a pie al castillo", "Tomar el coche para ir al Delta").`;
    } else {
        transportInstruction = "El usuario utilizará una combinación óptima de transporte (A pie por el centro, coche o taxi para distancias largas). Sugiere la mejor opción logística para cada tramo.";
    }
  } else {
    transportInstruction = `Transporte disponible: ${transportLabel}`;
  }

  // Enhanced Date Logic
  let dateContext = "Fecha no especificada. Asume horarios de apertura estándar (primavera/verano).";
  
  if (prefs.startDate) {
      const date = new Date(prefs.startDate);
      // Determine day of week in Spanish for the prompt context
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = days[date.getDay()];
      
      dateContext = `
      FECHA EXACTA DE INICIO: ${prefs.startDate} (${dayName}).
      
      LOGÍSTICA TEMPORAL CRÍTICA (OBLIGATORIO):
      1. CALENDARIO REAL: Calcula qué día de la semana cae cada día del itinerario.
      2. CIERRES DE LUNES: Ten en cuenta que el "Museu de les Terres de l'Ebre" y muchos monumentos cierran los LUNES. Si el itinerario incluye un Lunes, programa actividades de naturaleza o exteriores ese día, no museos.
      3. EVENTOS LOCALES: Verifica si la fecha coincide con la "Festa del Mercat a la Plaça" (Mayo), "Festes Majors" (Agosto), "Fira de Mostres" (Diciembre) o jornadas gastronómicas (Carxofa, Arròs). Si coincide, INCLÚYELO como actividad prioritaria.
      4. HORARIOS ESTACIONALES: Si es invierno, recuerda que anochece pronto (actividades exteriores por la mañana). Si es verano, sugiere evitar horas centrales de calor al aire libre.
      `;
  }

  const prompt = `
    Actúa como un guía turístico experto local de Amposta y Terres de l'Ebre (Tarragona, España).
    Crea un itinerario detallado basado en las siguientes preferencias:
    
    - Idioma de respuesta: ${langInstruction}
    - Tema Principal: ${themeLabel}
    - Duración: ${durationLabel}
    - ${dateContext}
    - ${transportInstruction}
    ${prefs.additionalInfo ? `- Notas adicionales del usuario: ${prefs.additionalInfo}` : ''}

    REQUISITOS IMPORTANTES:
    1. Alcance Geográfico: ${locationScope}
    2. Usa nombres oficiales para lugares (monumentos, restaurantes) para facilitar su localización en mapas.
    3. Sugiere horarios y precios aproximados de entradas a monumentos (ej. Castillo de Miravet, MónNatura, etc.).
    4. LOGÍSTICA DE TRANSPORTE: Si el medio es Bus o Barco, es vital incluir la dirección física de la parada o el muelle. Para Miravet/Tortosa, especifica claramente cómo conectar.
    
    FORMATO DE RESPUESTA OBLIGATORIO:
    Para permitir que la aplicación procese el itinerario, DEBES estructurar cada paso/actividad usando EXACTAMENTE el siguiente formato delimitado. No uses formato de lista markdown normal para la estructura principal, usa estos bloques:

    <<<STEP>>>
    DAY: [Número de día, ej: 1]
    TIME: [Momento del día, ej: Mañana / Mediodía / Tarde / Noche (Traducido al idioma destino)]
    TITLE: [Nombre corto de la actividad o lugar]
    IMAGE: [Si conoces una URL válida de Wikimedia Commons para este lugar, ponla aquí. Si no, déjalo vacío]
    DESCRIPTION: [Descripción detallada en el idioma solicitado (${prefs.language}). Incluye por qué visitar, precios, horarios. **Si has detectado que es un día festivo o de cierre (ej. Lunes), menciónalo explícitamente aquí**.]
    <<<END_STEP>>>

    Repite este bloque para cada actividad del itinerario.
    Asegúrate de cubrir todos los días solicitados.
  `;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [
            { googleSearch: {} }, 
            { googleMaps: {} }
        ],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: 40.7130, // Amposta Latitude
              longitude: 0.5805 // Amposta Longitude
            }
          }
        },
        systemInstruction: `Eres un experto en turismo de las Terres de l'Ebre con conocimiento detallado de horarios de apertura, festivos locales y logística. ${langInstruction}`,
        temperature: 0.4,
      },
    });

    const text = response.text || "Error generating itinerary.";
    
    const steps: ItineraryStep[] = [];
    const stepRegex = /<<<STEP>>>([\s\S]*?)<<<END_STEP>>>/g;
    let match;
    let index = 0;

    while ((match = stepRegex.exec(text)) !== null) {
        const content = match[1];
        const dayMatch = content.match(/DAY:\s*(.*)/);
        const timeMatch = content.match(/TIME:\s*(.*)/);
        const titleMatch = content.match(/TITLE:\s*(.*)/);
        const imageMatch = content.match(/IMAGE:\s*(.*)/);
        
        const descParts = content.split(/DESCRIPTION:\s*/);
        const description = descParts.length > 1 ? descParts[1].trim() : "";

        if (titleMatch && description) {
            steps.push({
                id: `step-${index++}`,
                day: dayMatch ? dayMatch[1].trim() : "1",
                timeOfDay: timeMatch ? timeMatch[1].trim() : "Varios",
                title: titleMatch ? titleMatch[1].trim() : "Actividad",
                imageUrl: imageMatch && imageMatch[1].trim().length > 5 ? imageMatch[1].trim() : undefined,
                description: description
            });
        }
    }

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title,
            url: chunk.web.uri,
            type: 'web'
          });
        }
        if (chunk.maps) {
           sources.push({
             title: chunk.maps.title,
             url: chunk.maps.uri,
             type: 'map'
           });
        }
      });
    }

    const uniqueSources = sources.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);

    return {
      markdown: text,
      steps: steps,
      sources: uniqueSources
    };

  } catch (error: any) {
    console.error("Error generating itinerary:", error);
    
    // Pass through the clean error message from getAiClient if possible
    throw error;
  }
};