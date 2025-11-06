import { GoogleGenAI, GroundingChunk, Type, Modality } from "@google/genai";
import { PlantInfo, GroundingSource, Preparation, SimilarPlant, SimilarActivePlant, DiseaseInfo, ComparisonInfo, SuggestedPlant, CareGuideInfo } from '../types';

if (!process.env.API_KEY) {
  // This check is now less critical as the key is passed in, but good for fallback awareness.
}

const getAiClient = (apiKey: string): GoogleGenAI => {
  if (!apiKey) {
    throw new Error("No API key was provided to initialize the AI client.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- SPANISH PROMPTS ---

const generateJsonPrompt_es = (context: string) => `
Eres un experto botánico y herbolario. ${context}. Después de identificarla, proporciona la siguiente información en un objeto JSON estructurado con las siguientes claves EXACTAS: "nombreComun", "nombreCientifico", "sinonimos", "descripcionGeneral", "habitat", "distribucionGeografica", "floweringSeason", "conservationStatus", "usosMedicinales", "usosCulinarios", "principiosActivos", "toxicidad", "preparaciones", "plantasSimilares" y "plantasConPrincipiosActivosSimilares".

- Para "sinonimos", proporciona una lista de otros nombres comunes por los que se conoce la planta. Si no hay sinónimos comunes, devuelve una lista vacía [].
- Para "habitat", describe el hábitat natural de la planta (tipo de suelo, clima, región).
- Para "distribucionGeografica", describe las regiones del mundo donde la planta es nativa y donde ha sido introducida o se ha naturalizado.
- Para "floweringSeason", indica la estación o meses en que la planta suele florecer.
- Para "conservationStatus", proporciona el estado de conservación según la UICN (p. ej., 'Preocupación Menor', 'Vulnerable', 'En Peligro') y una breve explicación si es relevante. Si no está evaluada, indícalo.
- Para "usosMedicinales", proporciona una lista de usos tradicionales y modernos.
- Para "usosCulinarios", proporciona una lista de strings. Cada string debe ser una descripción detallada de un uso culinario. Si no tiene usos culinarios conocidos, devuelve una lista vacía [].
- Para "principiosActivos", lista los componentes químicos clave responsables de sus efectos (p. ej., 'Aconitina'). Esta lista no debe estar vacía si la planta es conocida por sus propiedades medicinales o toxicidad. Menciona si se usan en medicamentos comerciales.
- Para "toxicidad", describe claramente cualquier riesgo, parte tóxica, y a quién afecta (humanos, mascotas). Si no es tóxica, indícalo.
- Para "preparaciones", genera una lista de recetas o métodos de preparación. Para cada preparación, incluye un objeto con las claves "nombre", "ingredientes", "instrucciones", "dosis", "efectosSecundarios", y "contextoHistorico".
- Para "plantasSimilares", proporciona una lista de 1 a 3 plantas con las que se confunde comúnmente. Para cada una, incluye un objeto con "nombreComun", "nombreCientifico", y "diferenciaClave".
- Para "plantasConPrincipiosActivosSimilares", proporciona una lista de 1 a 3 plantas que compartan un principio activo clave. Para cada una, incluye un objeto con "nombreComun", "nombreCientifico" y "principioActivoCompartido".

Si no puedes identificar la planta con certeza, responde con un objeto JSON que contenga solo una clave: "error", con el valor "No se pudo identificar la planta.".

La respuesta DEBE ser únicamente el objeto JSON, sin texto introductorio ni markdown. **Todas las claves solicitadas son obligatorias.** Si no hay información para un campo de tipo array (como 'sinonimos'), devuelve una lista vacía []. Si no hay información para un campo de tipo string, devuelve una cadena vacía '' o un valor descriptivo como 'No disponible'. No omitas ninguna clave.
`;

const generateDiseaseJsonPrompt_es = (context: string) => `
Eres un experto fitopatólogo y agrónomo. ${context}. Analiza la imagen para identificar la enfermedad, plaga o deficiencia nutricional más probable. Proporciona la siguiente información en un objeto JSON estructurado con las siguientes claves EXACTAS: "nombreEnfermedad", "plantaAfectada", "sintomas", "causas", "tratamientoOrganico", "tratamientoQuimico", "prevencion".

- Si no puedes identificar el problema con certeza, responde con un objeto JSON que contenga solo una clave: "error", con el valor "No se pudo diagnosticar el problema de la planta.".
La respuesta DEBE ser únicamente el objeto JSON, sin texto introductorio ni markdown. **Todas las claves solicitadas son obligatorias.** Si no hay información para un campo de tipo array, devuelve una lista vacía [].
`;

const generateCompareJsonPrompt_es = (plantA: PlantInfo, plantB: PlantInfo) => `
Eres un botánico comparativo y farmacólogo experto. Compara la Planta A y la Planta B y genera un análisis en un objeto JSON con las claves EXACTAS: "resumenComparativo", "usosMedicinales", "principiosActivos", "toxicidad", y "diferenciasBotanicas".

- "usosMedicinales": Un objeto con "similitudes" y "diferencias".
- "principiosActivos": Un objeto con "compartidos" y "unicos" (con claves "plantaA" y "plantaB").
- "toxicidad": Un objeto con "comparacion", "nivelPlantaA", y "nivelPlantaB".
- "diferenciasBotanicas": Un objeto con "habitat" y "apariencia".

Planta A: ${plantA.nombreComun} (${plantA.nombreCientifico})
Planta B: ${plantB.nombreComun} (${plantB.nombreCientifico})

La respuesta DEBE ser únicamente el objeto JSON, sin texto introductorio ni markdown. **Todas las claves solicitadas son obligatorias.**
`;

const generateFindPlantsPrompt_es = (usage: string, location: { latitude: number; longitude: number } | null) => {
  let prompt = `Eres un etnobotánico experto. Basado en la indicación "${usage}", genera una lista de hasta 5 plantas útiles.`;
  if (location) {
    prompt += ` Prioriza plantas nativas de la región alrededor de la latitud ${location.latitude} y longitud ${location.longitude}.`;
  }
  prompt += `\nLa respuesta DEBE ser un array JSON de objetos, cada uno con claves "nombreComun" y "relevancia", las cuales son obligatorias. No incluyas markdown.
  Ejemplo: [{"nombreComun": "Manzanilla", "relevancia": "Conocida por sus propiedades calmantes y digestivas."}]`;
  return prompt;
};

const generateCareGuidePrompt_es = (plant: PlantInfo) => `
Eres un horticultor y jardinero experto. Genera una guía de cuidado detallada para la planta "${plant.nombreComun} (${plant.nombreCientifico})".
La respuesta DEBE ser un objeto JSON con las siguientes claves EXACTAS: "riego", "luz", "suelo", "temperaturaHumedad", "fertilizacion", "podaPestes", "trasplante", "propagacion", y "consejosAdicionales".
- Cada clave debe contener un objeto con sub-claves que describan el cuidado de forma concisa y práctica.
- Para "trasplante", incluye "frecuencia", "instrucciones" y "consejo".
- Para "propagacion", incluye "metodos", "instrucciones" y "consejo".
- Para "consejosAdicionales", incluye "purificacionAire" (si la planta purifica el aire), "seguridadMascotas" (si es segura para mascotas y niños) y "datoCurioso".
- Sé específico y da consejos prácticos para un jardinero aficionado.
La respuesta DEBE ser únicamente el objeto JSON, sin texto introductorio ni markdown. **Todas las claves solicitadas son obligatorias.**
`;

// --- ENGLISH PROMPTS ---

const generateJsonPrompt_en = (context: string) => `
You are an expert botanist and herbalist. ${context}. After identifying it, provide the following information in a structured JSON object with the following EXACT keys: "nombreComun", "nombreCientifico", "sinonimos", "descripcionGeneral", "habitat", "distribucionGeografica", "floweringSeason", "conservationStatus", "usosMedicinales", "usosCulinarios", "principiosActivos", "toxicidad", "preparaciones", "plantasSimilares", and "plantasConPrincipiosActivosSimilares".

- For "sinonimos", provide a list of other common names. If none, return an empty list [].
- For "habitat", describe the natural habitat.
- For "distribucionGeografica", describe the regions where the plant is native and introduced.
- For "floweringSeason", indicate the season or months of flowering.
- For "conservationStatus", provide the IUCN conservation status (e.g., 'Least Concern', 'Vulnerable'). If not assessed, state that.
- For "usosMedicinales", provide a list of traditional and modern uses.
- For "usosCulinarios", provide a list of strings, each being a detailed description of a culinary use. If not edible, return an empty list [].
- For "principiosActivos", list the key chemical components responsible for its effects (e.g., 'Aconitine'). This list must not be empty if the plant is known for its medicinal properties or toxicity. Mention if they are used in commercial drugs.
- For "toxicidad", clearly describe any risks, toxic parts, and who it affects (humans, pets). If not toxic, state that.
- For "preparaciones", generate a list of preparation methods. For each, include an object with "nombre", "ingredientes", "instrucciones", "dosis", "efectosSecundarios", and "contextoHistorico".
- For "plantasSimilares", provide a list of 1-3 commonly confused plants. For each, include an object with "nombreComun", "nombreCientifico", and "diferenciaClave".
- For "plantasConPrincipiosActivosSimilares", provide a list of 1-3 plants that share a key active compound. For each, include an object with "nombreComun", "nombreCientifico", and "principioActivoCompartido".

If you cannot identify the plant with certainty, respond with a JSON object containing only one key: "error", with the value "Could not identify the plant.".

The response MUST be only the JSON object, without introductory text or markdown. **All requested keys are mandatory.** If there's no information for an array-type field (like 'sinonimos'), return an empty list []. If there's no information for a string-type field, return an empty string '' or a descriptive value like 'Not available'. Do not omit any keys.
`;

const generateDiseaseJsonPrompt_en = (context: string) => `
You are an expert plant pathologist and agronomist. ${context}. Analyze the image to identify the most likely disease, pest, or nutritional deficiency. Provide the following information in a structured JSON object with the following EXACT keys: "nombreEnfermedad", "plantaAfectada", "sintomas", "causas", "tratamientoOrganico", "tratamientoQuimico", "prevencion".

- If you cannot identify the problem with certainty, respond with a JSON object containing only one key: "error", with the value "Could not diagnose the plant problem.".
The response MUST be only the JSON object, without introductory text or markdown. **All requested keys are mandatory.** If there is no information for an array-type field, return an empty list [].
`;

const generateCompareJsonPrompt_en = (plantA: PlantInfo, plantB: PlantInfo) => `
You are an expert comparative botanist and pharmacologist. Compare Plant A and Plant B and generate an analysis in a JSON object with the EXACT keys: "resumenComparativo", "usosMedicinales", "principiosActivos", "toxicidad", and "diferenciasBotanicas".

- "usosMedicinales": An object with "similitudes" and "diferencias".
- "principiosActivos": An object with "compartidos" and "unicos" (with keys "plantaA" and "plantaB").
- "toxicidad": An object with "comparacion", "nivelPlantaA", and "nivelPlantaB".
- "diferenciasBotanicas": An object with "habitat" and "apariencia".

Plant A: ${plantA.nombreComun} (${plantA.nombreCientifico})
Plant B: ${plantB.nombreComun} (${plantB.nombreCientifico})

The response MUST be only the JSON object, without introductory text or markdown. **All requested keys are mandatory.**
`;

const generateFindPlantsPrompt_en = (usage: string, location: { latitude: number; longitude: number } | null) => {
  let prompt = `You are an expert ethnobotanist. Based on the indication "${usage}", generate a list of up to 5 useful plants.`;
  if (location) {
    prompt += ` Prioritize plants native to the region around latitude ${location.latitude} and longitude ${location.longitude}.`;
  }
  prompt += `\nThe response MUST be a JSON array of objects, each with keys "nombreComun" and "relevancia", which are mandatory. Do not include markdown.
  Example: [{"nombreComun": "Chamomile", "relevancia": "Known for its calming and digestive properties."}]`;
  return prompt;
};

const generateCareGuidePrompt_en = (plant: PlantInfo) => `
You are an expert horticulturist and gardener. Generate a detailed care guide for the plant "${plant.nombreComun} (${plant.nombreCientifico})".
The response MUST be a JSON object with the following EXACT keys: "riego", "luz", "suelo", "temperaturaHumedad", "fertilizacion", "podaPestes", "trasplante", "propagacion", and "consejosAdicionales".
- Each key must contain an object with sub-keys describing care concisely and practically.
- For "trasplante" (repotting), include "frecuencia", "instrucciones", and "consejo".
- For "propagacion" (propagation), include "metodos", "instrucciones", and "consejo".
- For "consejosAdicionales" (additional tips), include "purificacionAire" (if the plant purifies air), "seguridadMascotas" (if it's safe for pets and children), and "datoCurioso" (fun fact).
- Be specific and provide practical tips for an amateur gardener.
The response MUST be only the JSON object, without introductory text or markdown. **All requested keys are mandatory.**
`;


// --- SCHEMA & SANITIZERS (Language-agnostic) ---

const plantInfoSchema = { /* ... (schema remains the same) ... */ };
const diseaseInfoSchema = { /* ... (schema remains the same) ... */ };

function sanitizePlantInfo(data: any): PlantInfo | null {
    if (!data || typeof data !== 'object') return null;
    if (data.error) return null;
    const sanitized: PlantInfo = {
        nombreComun: String(data.nombreComun || 'Name not available'),
        nombreCientifico: String(data.nombreCientifico || 'Scientific name not available'),
        sinonimos: Array.isArray(data.sinonimos) ? data.sinonimos.filter((s: any) => typeof s === 'string') : [],
        descripcionGeneral: String(data.descripcionGeneral || 'No description available.'),
        habitat: String(data.habitat || 'Habitat not available.'),
        distribucionGeografica: String(data.distribucionGeografica || 'Geographic distribution not available.'),
        floweringSeason: String(data.floweringSeason || 'Flowering season not available.'),
        conservationStatus: String(data.conservationStatus || 'Not assessed.'),
        toxicidad: String(data.toxicidad || 'Toxicity information not available.'),
        usosMedicinales: Array.isArray(data.usosMedicinales) ? data.usosMedicinales.filter((u: any) => typeof u === 'string') : [],
        usosCulinarios: Array.isArray(data.usosCulinarios) ? data.usosCulinarios.filter((u: any) => typeof u === 'string') : [],
        principiosActivos: Array.isArray(data.principiosActivos) ? data.principiosActivos.filter((p: any) => typeof p === 'string') : [],
        preparaciones: [],
        plantasSimilares: [],
        plantasConPrincipiosActivosSimilares: [],
    };
    if (Array.isArray(data.preparaciones)) {
        sanitized.preparaciones = data.preparaciones.map((p: any): Preparation | null => {
                if (!p || typeof p !== 'object') return null;
                return {
                    nombre: String(p.nombre || 'Unnamed Preparation'),
                    ingredientes: Array.isArray(p.ingredientes) ? p.ingredientes.filter((i: any) => typeof i === 'string') : [],
                    instrucciones: String(p.instrucciones || 'No instructions.'),
                    dosis: String(p.dosis || 'Dosage not specified.'),
                    efectosSecundarios: String(p.efectosSecundarios || 'No known side effects reported.'),
                    contextoHistorico: String(p.contextoHistorico || 'No historical context.'),
                };
            }).filter((p): p is Preparation => p !== null);
    }
    if (Array.isArray(data.plantasSimilares)) {
        sanitized.plantasSimilares = data.plantasSimilares.map((p: any): SimilarPlant | null => {
                if (!p || typeof p !== 'object' || !p.nombreComun || !p.diferenciaClave) return null;
                return {
                    nombreComun: String(p.nombreComun),
                    nombreCientifico: String(p.nombreCientifico || 'N/A'),
                    diferenciaClave: String(p.diferenciaClave),
                };
            }).filter((p): p is SimilarPlant => p !== null);
    }
    if (Array.isArray(data.plantasConPrincipiosActivosSimilares)) {
        sanitized.plantasConPrincipiosActivosSimilares = data.plantasConPrincipiosActivosSimilares.map((p: any): SimilarActivePlant | null => {
                if (!p || typeof p !== 'object' || !p.nombreComun || !p.principioActivoCompartido) return null;
                return {
                    nombreComun: String(p.nombreComun),
                    nombreCientifico: String(p.nombreCientifico || 'N/A'),
                    principioActivoCompartido: String(p.principioActivoCompartido),
                };
            }).filter((p): p is SimilarActivePlant => p !== null);
    }
    if (sanitized.nombreComun === 'Name not available' && sanitized.nombreCientifico === 'Scientific name not available') {
        return null;
    }
    return sanitized;
}

function sanitizeDiseaseInfo(data: any): DiseaseInfo | null {
    if (!data || typeof data !== 'object') return null;
    if (data.error) return null;
    const sanitized: DiseaseInfo = {
        nombreEnfermedad: String(data.nombreEnfermedad || 'Diagnosis not available'),
        plantaAfectada: Array.isArray(data.plantaAfectada) ? data.plantaAfectada.filter((s: any) => typeof s === 'string') : [],
        sintomas: Array.isArray(data.sintomas) ? data.sintomas.filter((s: any) => typeof s === 'string') : [],
        causas: Array.isArray(data.causas) ? data.causas.filter((c: any) => typeof c === 'string') : [],
        tratamientoOrganico: Array.isArray(data.tratamientoOrganico) ? data.tratamientoOrganico.filter((t: any) => typeof t === 'string') : [],
        tratamientoQuimico: Array.isArray(data.tratamientoQuimico) ? data.tratamientoQuimico.filter((t: any) => typeof t === 'string') : [],
        prevencion: Array.isArray(data.prevencion) ? data.prevencion.filter((p: any) => typeof p === 'string') : [],
    };
    if (sanitized.nombreEnfermedad === 'Diagnosis not available' || sanitized.sintomas.length === 0) {
        return null;
    }
    return sanitized;
}


// --- UTILITY FUNCTIONS ---

const getJsonFromResponse = (text: string) => {
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            try { return JSON.parse(match[1]); } catch (parseError) { throw new Error("Model response contained malformed JSON inside a code block."); }
        }
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const jsonString = text.substring(startIndex, endIndex + 1);
            try { return JSON.parse(jsonString); } catch (finalParseError) { /* continue to array check */ }
        }
        const arrayStartIndex = text.indexOf('[');
        const arrayEndIndex = text.lastIndexOf(']');
        if (arrayStartIndex !== -1 && arrayEndIndex !== -1 && arrayEndIndex > arrayStartIndex) {
            const arrayString = text.substring(arrayStartIndex, arrayEndIndex + 1);
            try { return JSON.parse(arrayString); } catch (arrayParseError) { throw new Error("Model response is not a valid JSON array. Please try again."); }
        }
        throw new Error("Model response is not valid JSON. Please try again.");
    }
};

const handleApiError = (error: unknown) => {
    console.error("API call error:", error);
    if (error instanceof Error) {
        if (error.message.includes('429') || error.message.toLowerCase().includes('resource has been exhausted')) {
            throw new Error("The free query limit has been reached. Please enter your own API key to continue.");
        }
        throw error;
    }
    throw new Error("Could not get a response from the model. Please check your query or try again later.");
};

// --- CORE API FUNCTIONS ---

const getPlantInfo = async (apiKey: string, parts: any[], useGrounding: boolean): Promise<{ plantInfo: PlantInfo; sources: GroundingSource[] }> => {
  try {
    const ai = getAiClient(apiKey);
    const config: any = {};
    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = 'application/json';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: config,
    });

    const data = getJsonFromResponse(response.text);
    if (!data) throw new Error("Could not extract structured information from the model's response.");
    if (data.error) throw new Error(data.error);

    const sanitizedData = sanitizePlantInfo(data);
    if (!sanitizedData) {
        throw new Error("The model's response was not in the expected format. The plant may not have been recognized.");
    }
    
    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: GroundingChunk) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Untitled Source'
        })).filter(source => source.uri) || [];

    return { plantInfo: sanitizedData, sources };
  } catch (error) {
    handleApiError(error);
    throw new Error("Unhandled API error");
  }
};

async function generateDistributionMap(apiKey: string, plantInfo: PlantInfo, language: 'es' | 'en'): Promise<string | null> {
    if (!plantInfo.distribucionGeografica || plantInfo.distribucionGeografica.includes('no disponible') || plantInfo.distribucionGeografica.includes('not available')) {
        return null;
    }
    try {
        const ai = getAiClient(apiKey);
        const prompt_text = language === 'es' 
            ? `Mapa del mundo estilo atlas que muestra la distribución geográfica de ${plantInfo.nombreCientifico}. Descripción: "${plantInfo.distribucionGeografica}". Resalta claramente las áreas mencionadas.`
            : `Atlas-style world map showing the geographic distribution of ${plantInfo.nombreCientifico}. Description: "${plantInfo.distribucionGeografica}". Clearly highlight the mentioned areas on the map.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt_text }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/jpeg;base64,${base64ImageBytes}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Error generating distribution map:", error);
        return null;
    }
}

export const identifyPlantFromImage = async (
  apiKey: string,
  base64Image: string,
  mimeType: string,
  location: { latitude: number; longitude: number } | null,
  language: 'es' | 'en'
): Promise<{ plantInfo: PlantInfo; sources: GroundingSource[], mapaDistribucionSrc: string | null }> => {
  const imagePart = { inlineData: { data: base64Image, mimeType } };
  let context: string;
  if (language === 'es') {
      context = "Identifica la planta en la siguiente imagen";
      if (location) context += ` y considera que fue encontrada cerca de la latitud ${location.latitude} y longitud ${location.longitude} para mejorar la precisión.`;
  } else {
      context = "Identify the plant in the following image";
      if (location) context += ` and consider it was found near latitude ${location.latitude} and longitude ${location.longitude} to improve accuracy.`;
  }
  const promptGenerator = language === 'es' ? generateJsonPrompt_es : generateJsonPrompt_en;
  const textPart = { text: promptGenerator(context) };
  const { plantInfo, sources } = await getPlantInfo(apiKey, [imagePart, textPart], true);
  const mapaDistribucionSrc = await generateDistributionMap(apiKey, plantInfo, language);
  return { plantInfo, sources, mapaDistribucionSrc };
};

export const identifyPlantFromText = async (
  apiKey: string,
  plantName: string,
  language: 'es' | 'en'
): Promise<{ plantInfo: PlantInfo; sources: GroundingSource[]; imageSrc: string | null, mapaDistribucionSrc: string | null, imageError?: boolean }> => {
    const context = language === 'es' ? `Busca información sobre la planta llamada "${plantName}"` : `Find information about the plant named "${plantName}"`;
    const promptGenerator = language === 'es' ? generateJsonPrompt_es : generateJsonPrompt_en;
    const textPart = { text: promptGenerator(context) };
    const { plantInfo, sources } = await getPlantInfo(apiKey, [textPart], false);
    const mapaDistribucionSrc = await generateDistributionMap(apiKey, plantInfo, language);

    try {
        const ai = getAiClient(apiKey);
        const imagePrompt = language === 'es' 
            ? `Una fotografía realista y botánicamente precisa de ${plantInfo.nombreCientifico} (${plantInfo.nombreComun}), mostrando claramente sus flores y hojas en su hábitat natural.`
            : `A realistic and botanically accurate photograph of ${plantInfo.nombreCientifico} (${plantInfo.nombreComun}), clearly showing its flowers and leaves in its natural habitat.`;
        
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: imagePrompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                return { plantInfo, sources, imageSrc: imageUrl, mapaDistribucionSrc };
            }
        }
        // If loop completes without returning, no image was found
        return { plantInfo, sources, imageSrc: null, mapaDistribucionSrc, imageError: true };
    } catch (error) {
        console.error("Error generating image:", error);
        return { plantInfo, sources, imageSrc: null, mapaDistribucionSrc, imageError: true };
    }
};

export const diagnosePlantDiseaseFromImage = async (
    apiKey: string,
    base64Image: string,
    mimeType: string,
    language: 'es' | 'en'
): Promise<{ diseaseInfo: DiseaseInfo; sources: GroundingSource[] }> => {
    try {
        const ai = getAiClient(apiKey);
        const imagePart = { inlineData: { data: base64Image, mimeType } };
        const context = language === 'es' ? "Analiza la siguiente imagen de una planta que parece enferma o dañada." : "Analyze the following image of a plant that appears sick or damaged.";
        const promptGenerator = language === 'es' ? generateDiseaseJsonPrompt_es : generateDiseaseJsonPrompt_en;
        const textPart = { text: promptGenerator(context) };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: { responseMimeType: 'application/json' },
        });

        const data = getJsonFromResponse(response.text);
        if (!data) throw new Error("Could not extract structured information from the model's response.");
        if (data.error) throw new Error(data.error);
        
        const sanitizedData = sanitizeDiseaseInfo(data);
        if (!sanitizedData) {
            throw new Error("The model's response for the disease was not in the expected format.");
        }
        const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: GroundingChunk) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Untitled Source'
        })).filter(source => source.uri) || [];
        return { diseaseInfo: sanitizedData, sources };
    } catch (error) {
        handleApiError(error);
        throw new Error("Unhandled API error in diagnosis");
    }
};

function sanitizeComparisonInfo(data: any): ComparisonInfo | null {
    if (!data || typeof data !== 'object') return null;
    const getString = (val: any, defaultVal = 'N/A'): string => String(val || defaultVal);
    const getStringArray = (val: any): string[] => Array.isArray(val) ? val.filter(item => typeof item === 'string') : [];
    return {
        resumenComparativo: getString(data.resumenComparativo),
        usosMedicinales: { similitudes: getStringArray(data.usosMedicinales?.similitudes), diferencias: getStringArray(data.usosMedicinales?.diferencias) },
        principiosActivos: { compartidos: getStringArray(data.principiosActivos?.compartidos), unicos: { plantaA: getStringArray(data.principiosActivos?.unicos?.plantaA), plantaB: getStringArray(data.principiosActivos?.unicos?.plantaB) } },
        toxicidad: { comparacion: getString(data.toxicidad?.comparacion), nivelPlantaA: getString(data.toxicidad?.nivelPlantaA, 'N/A'), nivelPlantaB: getString(data.toxicidad?.nivelPlantaB, 'N/A') },
        diferenciasBotanicas: { habitat: getString(data.diferenciasBotanicas?.habitat), apariencia: getString(data.diferenciasBotanicas?.apariencia) },
    };
}

export const comparePlants = async (
    apiKey: string,
    plantA: PlantInfo,
    plantB: PlantInfo,
    language: 'es' | 'en'
): Promise<ComparisonInfo> => {
    try {
        const ai = getAiClient(apiKey);
        const promptGenerator = language === 'es' ? generateCompareJsonPrompt_es : generateCompareJsonPrompt_en;
        const textPart = { text: promptGenerator(plantA, plantB) };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: { responseMimeType: 'application/json' },
        });

        const data = getJsonFromResponse(response.text);
        if (!data) throw new Error("The model's response for the comparison is empty.");
        if (data.error) throw new Error(data.error);
        
        const sanitizedData = sanitizeComparisonInfo(data);
        if (!sanitizedData) {
            throw new Error("Could not process the comparison from the model.");
        }
        return sanitizedData;
    } catch (error) {
        handleApiError(error);
        throw new Error("Unhandled error in plant comparison");
    }
};

function sanitizeSuggestedPlants(data: any): SuggestedPlant[] | null {
  if (!Array.isArray(data)) return null;
  const sanitized: SuggestedPlant[] = data.map((item: any): SuggestedPlant | null => {
      if (typeof item === 'object' && item !== null && typeof item.nombreComun === 'string' && typeof item.relevancia === 'string') {
        return { nombreComun: item.nombreComun, relevancia: item.relevancia };
      }
      return null;
    }).filter((item): item is SuggestedPlant => item !== null);
  return sanitized.length > 0 ? sanitized : null;
}

export const findPlantsByUsage = async (
    apiKey: string,
    usage: string,
    location: { latitude: number; longitude: number } | null,
    language: 'es' | 'en'
): Promise<SuggestedPlant[]> => {
    try {
        const ai = getAiClient(apiKey);
        const promptGenerator = language === 'es' ? generateFindPlantsPrompt_es : generateFindPlantsPrompt_en;
        const textPart = { text: promptGenerator(usage, location) };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: { responseMimeType: 'application/json' },
        });

        const data = getJsonFromResponse(response.text);
        if (!data) throw new Error("The model's response for remedy search is empty.");
        if (data.error) throw new Error(data.error);

        const sanitizedData = sanitizeSuggestedPlants(data);
        if (!sanitizedData) {
            throw new Error("Could not find valid suggestions from the model.");
        }
        return sanitizedData;
    } catch (error) {
        handleApiError(error);
        throw new Error("Unhandled error in remedy search.");
    }
};

function sanitizeCareGuide(data: any): CareGuideInfo | null {
    if (!data || typeof data !== 'object') return null;
    const s = (val: any, defaultVal = 'N/A') => String(val || defaultVal);
    const getObj = (obj: any) => obj && typeof obj === 'object' ? obj : {};
    
    const riego = getObj(data.riego);
    const luz = getObj(data.luz);
    const suelo = getObj(data.suelo);
    const temperaturaHumedad = getObj(data.temperaturaHumedad);
    const fertilizacion = getObj(data.fertilizacion);
    const podaPestes = getObj(data.podaPestes);
    const trasplante = getObj(data.trasplante);
    const propagacion = getObj(data.propagacion);
    const consejosAdicionales = getObj(data.consejosAdicionales);

    return {
        riego: { frecuencia: s(riego.frecuencia), metodo: s(riego.metodo), consejo: s(riego.consejo) },
        luz: { nivel: s(luz.nivel), ubicacion: s(luz.ubicacion), consejo: s(luz.consejo) },
        suelo: { tipo: s(suelo.tipo), drenaje: s(suelo.drenaje), consejo: s(suelo.consejo) },
        temperaturaHumedad: { temperatura: s(temperaturaHumedad.temperatura), humedad: s(temperaturaHumedad.humedad), consejo: s(temperaturaHumedad.consejo) },
        fertilizacion: { frecuencia: s(fertilizacion.frecuencia), tipo: s(fertilizacion.tipo), consejo: s(fertilizacion.consejo) },
        podaPestes: { poda: s(podaPestes.poda), pestesComunes: s(podaPestes.pestesComunes), consejo: s(podaPestes.consejo) },
        trasplante: { frecuencia: s(trasplante.frecuencia), instrucciones: s(trasplante.instrucciones), consejo: s(trasplante.consejo) },
        propagacion: { metodos: s(propagacion.metodos), instrucciones: s(propagacion.instrucciones), consejo: s(propagacion.consejo) },
        consejosAdicionales: { purificacionAire: s(consejosAdicionales.purificacionAire), seguridadMascotas: s(consejosAdicionales.seguridadMascotas), datoCurioso: s(consejosAdicionales.datoCurioso) },
    };
}


export const generateCareGuide = async (
    apiKey: string,
    plant: PlantInfo,
    language: 'es' | 'en'
): Promise<CareGuideInfo> => {
    try {
        const ai = getAiClient(apiKey);
        const promptGenerator = language === 'es' ? generateCareGuidePrompt_es : generateCareGuidePrompt_en;
        const textPart = { text: promptGenerator(plant) };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: { responseMimeType: 'application/json' },
        });

        const data = getJsonFromResponse(response.text);
        if (!data) throw new Error("The model's response for the care guide is empty.");
        if (data.error) throw new Error(data.error);

        const sanitizedData = sanitizeCareGuide(data);
        if (!sanitizedData) {
            throw new Error("Could not process the care guide from the model.");
        }
        return sanitizedData;
    } catch (error) {
        handleApiError(error);
        throw new Error("Unhandled error in care guide generation.");
    }
};