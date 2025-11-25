import { GoogleGenAI } from "@google/genai";
import { UserPreferences, ItineraryResult, GroundingSource, ItineraryStep, Theme, Transport } from "../types";
import { TRANSLATIONS } from "../constants";

// Helper to determine if a key looks valid
const isValidKey = (key: string | undefined): boolean => {
    if (!key) return false;
    return key.startsWith("AIza") && key.length > 35;
};

const getApiKey = (): string => {
  // INTENTO DIRECTO: Acceso literal para asegurar que Vite realice el reemplazo estático.
  // @ts-ignore
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (viteKey && isValidKey(viteKey)) {
    return viteKey;
  }

  // FALLBACKS (Solo si falla el principal)
  let fallbackKey = "";
  try {
     // @ts-ignore
     if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        fallbackKey = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || "";
     }
  } catch (e) {}

  if (fallbackKey && isValidKey(fallbackKey)) return fallbackKey;

  // SI LLEGAMOS AQUÍ, ES UN ERROR.
  // Recopilamos info de depuración para mostrarla en pantalla.
  let envDump = "{}";
  try {
    // @ts-ignore
    envDump = JSON.stringify(import.meta.env || {}, null, 2);
  } catch (e) { envDump = "Error reading env"; }

  throw new Error(`
    [ERROR CRÍTICO: API KEY NO DETECTADA]
    
    La aplicación no recibe la clave 'VITE_GEMINI_API_KEY'.

    --- DATOS DE DEPURACIÓN (Lo que ve la app) ---
    ${envDump}
    ----------------------------------------------

    SI EL OBJETO DE ARRIBA ESTÁ VACÍO O NO TIENE TU CLAVE:
    1. En Render > Environment: Asegúrate de que la clave se llama 'VITE_GEMINI_API_KEY'.
    2. IMPRESCINDIBLE: Haz un 'Manual Deploy' > 'Clear build cache & deploy'. 
       (Vite necesita recompilar para 'quemar' la variable dentro del código JS).
  `);
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

  let themeLabel = t.themes[prefs.theme].label;
  
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

  let dateContext = "Fecha no especificada. Asume horarios de apertura estándar (primavera/verano).";
  
  if (prefs.startDate) {
      const date = new Date(prefs.startDate);
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = days[date.getDay()];
      
      dateContext = `
      FECHA EXACTA DE INICIO: ${prefs.startDate} (${dayName}).
      
      LOGÍSTICA TEMPORAL CRÍTICA (OBLIGATORIO):
      1. CALENDARIO REAL: Calcula qué día de la semana cae cada día del itinerario.
      2. CIERRES DE LUNES: Ten en cuenta que el "Museu de les Terres de l'Ebre" y muchos monumentos cierran los LUNES. Si el itinerario incluye un Lunes, programa actividades de naturaleza o exteriores ese día, no museos.
      3. EVENTOS LOCALES: Verifica si la fecha coincide con la "Festa del Mercat a la Plaça" (Mayo), "Festes Majors" (Agosto), "Fira de Mostres" (Diciembre) o jornadas gastronómicas (Carxofa, Arròs). Si coincide, INCLÚYELO como actividad prioritaria.
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
    2. Usa nombres oficiales para lugares.
    3. Sugiere horarios y precios aproximados.
    
    FORMATO DE RESPUESTA OBLIGATORIO:
    Usa EXACTAMENTE este formato para cada paso:

    <<<STEP>>>
    DAY: [Número de día]
    TIME: [Momento del día]
    TITLE: [Nombre corto de la actividad]
    IMAGE: [Dejar vacío]
    DESCRIPTION: [Descripción detallada]
    <<<END_STEP>>>
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
        systemInstruction: `Eres un experto en turismo de las Terres de l'Ebre. ${langInstruction}`,
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
        const descParts = content.split(/DESCRIPTION:\s*/);
        const description = descParts.length > 1 ? descParts[1].trim() : "";

        if (titleMatch && description) {
            steps.push({
                id: `step-${index++}`,
                day: dayMatch ? dayMatch[1].trim() : "1",
                timeOfDay: timeMatch ? timeMatch[1].trim() : "Varios",
                title: titleMatch ? titleMatch[1].trim() : "Actividad",
                imageUrl: undefined,
                description: description
            });
        }
    }

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) sources.push({ title: chunk.web.title, url: chunk.web.uri, type: 'web' });
        if (chunk.maps) sources.push({ title: chunk.maps.title, url: chunk.maps.uri, type: 'map' });
      });
    }

    const uniqueSources = sources.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);

    return { markdown: text, steps: steps, sources: uniqueSources };

  } catch (error: any) {
    console.error("Error generating itinerary:", error);
    throw error;
  }
};
