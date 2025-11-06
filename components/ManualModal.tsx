
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManualContentEs: React.FC = () => (
  <>
    <h1 className="text-4xl font-extrabold text-green-800 dark:text-emerald-200 mb-4">Herbario IA</h1>
    <p className="text-lg leading-relaxed mb-6">Herbario IA es una aplicación web moderna y orientada a dispositivos móviles, diseñada para entusiastas de las plantas. Utiliza el poder de la IA de Gemini de Google para identificar plantas a partir de fotos, diagnosticar enfermedades y proporcionar una gran cantidad de información sobre sus usos, propiedades y cuidados.</p>
    
    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Características Principales</h2>
    <ul className="list-disc list-inside space-y-3 mb-6 text-lg">
      <li><strong className="font-semibold">Identificación Multimodal de Plantas</strong>: Identifica plantas al instante tomando una foto, subiendo una imagen o buscando por nombre. La aplicación tiene en cuenta la geolocalización para mejorar la precisión con la flora local.</li>
      <li><strong className="font-semibold">Diagnóstico de Enfermedades de Plantas</strong>: Toma una foto de una planta enferma y la IA diagnosticará posibles enfermedades, plagas o deficiencias nutricionales, ofreciendo opciones de tratamiento orgánico y químico.</li>
      <li><strong className="font-semibold">Buscador de Remedios</strong>: Busca plantas basándote en síntomas o usos tradicionales (p. ej., "alivio para el dolor de cabeza"). La búsqueda puede priorizar plantas nativas de tu ubicación actual.</li>
      <li><strong className="font-semibold">Perfiles Detallados de Plantas</strong>: Obtén información completa para cada planta identificada, incluyendo:
        <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
          <li><strong>Datos Botánicos</strong>: Nombre científico, sinónimos, descripción, hábitat y estado de conservación.</li>
          <li><strong>Usos</strong>: Aplicaciones medicinales y culinarias detalladas.</li>
          <li><strong>Ciencia</strong>: Compuestos activos clave y advertencias de toxicidad.</li>
          <li><strong>Guías Prácticas</strong>: Recetas de preparación tradicionales con instrucciones, dosis y contexto histórico.</li>
          <li><strong>Seguridad</strong>: Comparaciones claras con plantas tóxicas de apariencia similar para evitar confusiones.</li>
          <li><strong>Mapa de Distribución</strong>: Un mapa generado por IA que muestra las regiones nativas y naturalizadas de la planta.</li>
        </ul>
      </li>
      <li><strong className="font-semibold">Guías de Cuidado Completas Generadas por IA</strong>: Ve más allá de la identificación. Genera guías detalladas que cubren:
        <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
            <li>Riego, Luz, Suelo, Temperatura, Fertilización y Control de Plagas.</li>
            <li><strong>Trasplante</strong>: Aprende cuándo y cómo darle a tu planta un nuevo hogar.</li>
            <li><strong>Propagación</strong>: Instrucciones sencillas para multiplicar tus plantas.</li>
            <li><strong>Consejos Adicionales</strong>: Descubre si tu planta purifica el aire, si es segura para mascotas y otros datos curiosos.</li>
        </ul>
      </li>
      <li><strong className="font-semibold">Comparador Botánico</strong>: Una herramienta única para comparar dos plantas diferentes una al lado de la otra, analizando sus usos medicinales, compuestos activos y niveles de toxicidad.</li>
      <li><strong className="font-semibold">Herbario Personal</strong>: Guarda tus hallazgos favoritos o más relevantes en una colección personal, filtrable y ordenable. También puedes exportar los datos de tu herbario a un archivo JSON.</li>
      <li><strong className="font-semibold">Historial de Sesión</strong>: Guarda automáticamente tus consultas recientes para un acceso rápido.</li>
      <li><strong className="font-semibold">Interfaz Bilingüe</strong>: Totalmente disponible en español e inglés.</li>
    </ul>

    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Cómo Usar</h2>
    <ol className="list-decimal list-inside space-y-3 mb-6 text-lg">
      <li><strong className="font-semibold">Selecciona un Modo</strong>: Elige entre <code>Identificar</code>, <code>Diagnosticar</code> o <code>Remedio</code>.</li>
      <li><strong className="font-semibold">Proporciona la Entrada</strong>:
        <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
          <li>Para <strong>Identificar</strong>: Toma una foto, sube una imagen o escribe el nombre de la planta.</li>
          <li>Para <strong>Diagnosticar</strong>: Sube una foto de la planta afectada.</li>
          <li>Para <strong>Remedio</strong>: Escribe un síntoma o uso y, opcionalmente, activa la geolocalización para obtener resultados locales.</li>
        </ul>
         <div className="mt-4 p-4 bg-green-50 dark:bg-emerald-900/40 border border-green-200 dark:border-emerald-800 rounded-lg text-base">
            <h4 className="font-semibold text-lg text-green-800 dark:text-emerald-300 mb-2">Consejos para la Mejor Foto de Identificación</h4>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Enfócate en una característica clave:</strong> En lugar de fotografiar toda la planta, toma un primer plano nítido de una parte distintiva (una flor, una hoja, un fruto).</li>
                <li><strong>Buena iluminación, sin sombras:</strong> La luz natural y difusa es ideal. Evita el sol directo que crea sombras fuertes y la oscuridad que produce fotos borrosas.</li>
                <li><strong>Fondo simple:</strong> Aísla la planta de otras para evitar confusiones. Si puedes, usa el cielo o tu mano como fondo.</li>
                <li><strong>Una sola planta por foto:</strong> Asegúrate de que solo la planta que quieres identificar aparezca en el encuadre.</li>
                <li><strong>Enfoque perfecto:</strong> Una foto borrosa no servirá. Toca la pantalla de tu móvil para enfocar la parte más importante de la planta.</li>
            </ul>
        </div>
      </li>
      <li><strong className="font-semibold">Analizar</strong>: La IA procesará tu solicitud y devolverá una ficha de información detallada.</li>
      <li><strong className="font-semibold">Explora</strong>: Navega por las diferentes secciones del resultado.</li>
      <li><strong className="font-semibold">Generar Guía de Cuidado</strong>: Si has identificado una planta, haz clic en el botón "Generar Guía de Cuidado" para obtener instrucciones personalizadas.</li>
      <li><strong className="font-semibold">Guarda y Compara</strong>: Guarda la planta en tu Herbario personal o usa la herramienta de Comparar para analizarla frente a otra planta.</li>
    </ol>
    
    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Pila Tecnológica</h2>
    <ul className="list-disc list-inside space-y-3 mb-6 text-lg">
      <li><strong className="font-semibold">Frontend</strong>: React (con Hooks)</li>
      <li><strong className="font-semibold">IA</strong>: Google Gemini API (<code>gemini-2.5-flash</code> para análisis, <code>imagen-4.0-generate-001</code> para generación de imágenes)</li>
      <li><strong className="font-semibold">Estilos</strong>: Tailwind CSS</li>
      <li><strong className="font-semibold">Despliegue</strong>: Se ejecuta directamente en el navegador usando módulos ES y un <code>import map</code>.</li>
    </ul>
    
    <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Descargo de Responsabilidad</h2>
    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300 rounded-r-lg">
        <p>Esta aplicación está destinada únicamente a fines educativos e informativos. No sustituye el consejo profesional médico, veterinario o botánico. Consulta siempre a un experto cualificado antes de consumir cualquier planta o aplicar cualquier tratamiento. La identificación basada en IA puede no ser 100% precisa.</p>
    </div>
  </>
);

const ManualContentEn: React.FC = () => (
    <>
        <h1 className="text-4xl font-extrabold text-green-800 dark:text-emerald-200 mb-4">AI Herbarium</h1>
        <p className="text-lg leading-relaxed mb-6">AI Herbarium is a modern, mobile-first web application designed for plant enthusiasts. It leverages the power of Google's Gemini AI to identify plants from photos, diagnose diseases, and provide a wealth of information about their uses, properties, and care.</p>
        
        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Key Features</h2>
        <ul className="list-disc list-inside space-y-3 mb-6 text-lg">
            <li><strong className="font-semibold">Multi-Modal Plant Identification</strong>: Identify plants instantly by taking a photo, uploading an image, or searching by name. The app considers geolocation to improve accuracy with local flora.</li>
            <li><strong className="font-semibold">Plant Disease Diagnosis</strong>: Snap a photo of a sick plant, and the AI will diagnose potential diseases, pests, or nutritional deficiencies, offering organic and chemical treatment options.</li>
            <li><strong className="font-semibold">Remedy Finder</strong>: Search for plants based on symptoms or traditional uses (e.g., "headache relief"). The search can prioritize plants native to your current location.</li>
            <li><strong className="font-semibold">Detailed Plant Profiles</strong>: Get comprehensive information for each identified plant, including:
                <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
                    <li><strong>Botanical Data</strong>: Scientific name, synonyms, description, habitat, and conservation status.</li>
                    <li><strong>Uses</strong>: Detailed medicinal and culinary applications.</li>
                    <li><strong>Science</strong>: Key active compounds and toxicity warnings.</li>
                    <li><strong>Practical Guides</strong>: Traditional preparation recipes with instructions, dosage, and historical context.</li>
                    <li><strong>Safety</strong>: Clear comparisons with similar-looking toxic plants to avoid confusion.</li>
                    <li><strong>Distribution Map</strong>: An AI-generated map showing the plant's native and naturalized regions.</li>
                </ul>
            </li>
            <li><strong className="font-semibold">Comprehensive AI-Generated Care Guides</strong>: Go beyond identification. Generate detailed guides covering:
                <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
                    <li>Watering, Light, Soil, Temperature, Fertilization, and Pest Control.</li>
                    <li><strong>Repotting</strong>: Learn when and how to give your plant a new home.</li>
                    <li><strong>Propagation</strong>: Simple instructions to multiply your plants.</li>
                    <li><strong>Bonus Insights</strong>: Discover if your plant purifies the air, if it's safe for pets, and other fun facts.</li>
                </ul>
            </li>
            <li><strong className="font-semibold">Botanical Comparator</strong>: A unique tool to compare two different plants side-by-side, analyzing their medicinal uses, active compounds, and toxicity levels.</li>
            <li><strong className="font-semibold">Personal Herbarium</strong>: Save your favorite or most relevant findings to a personal, filterable, and sortable collection. You can also export your herbarium data to a JSON file.</li>
            <li><strong className="font-semibold">Session History</strong>: Automatically saves your recent queries for quick access.</li>
            <li><strong className="font-semibold">Bilingual Interface</strong>: Fully available in both English and Spanish.</li>
        </ul>

        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">How to Use</h2>
        <ol className="list-decimal list-inside space-y-3 mb-6 text-lg">
            <li><strong className="font-semibold">Select a Mode</strong>: Choose between <code>Identify</code>, <code>Diagnose</code>, or <code>Remedy</code>.</li>
            <li><strong className="font-semibold">Provide Input</strong>:
                <ul className="list-['-_'] list-inside space-y-2 mt-2 pl-6">
                    <li>For <strong>Identify</strong>: Take a photo, upload an image, or type the plant's name.</li>
                    <li>For <strong>Diagnose</strong>: Upload a photo of the affected plant.</li>
                    <li>For <strong>Remedy</strong>: Type a symptom or use and optionally enable geolocation for local results.</li>
                </ul>
                <div className="mt-4 p-4 bg-green-50 dark:bg-emerald-900/40 border border-green-200 dark:border-emerald-800 rounded-lg text-base">
                    <h4 className="font-semibold text-lg text-green-800 dark:text-emerald-300 mb-2">Tips for the Best Identification Photo</h4>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Focus on a key feature:</strong> Instead of photographing the whole plant, get a sharp close-up of a distinctive part (a flower, a leaf, a fruit).</li>
                        <li><strong>Good lighting, no shadows:</strong> Natural, diffused light is ideal. Avoid direct sun that creates harsh shadows and darkness that results in blurry photos.</li>
                        <li><strong>Simple background:</strong> Isolate the plant from others to avoid confusion. If you can, use the sky or your hand as a background.</li>
                        <li><strong>One plant per photo:</strong> Make sure only the plant you want to identify appears in the frame.</li>
                        <li><strong>Perfect focus:</strong> A blurry photo won't work. Tap your phone's screen to focus on the most important part of the plant.</li>
                    </ul>
                </div>
            </li>
            <li><strong className="font-semibold">Analyze</strong>: The AI will process your request and return a detailed information card.</li>
            <li><strong className="font-semibold">Explore</strong>: Navigate through the different sections of the result.</li>
            <li><strong className="font-semibold">Generate Care Guide</strong>: If you identified a plant, click the "Generate Care Guide" button to get tailored instructions.</li>
            <li><strong className="font-semibold">Save &amp; Compare</strong>: Save the plant to your personal Herbarium or use the Compare tool to analyze it against another plant.</li>
        </ol>
        
        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Technology Stack</h2>
        <ul className="list-disc list-inside space-y-3 mb-6 text-lg">
            <li><strong className="font-semibold">Frontend</strong>: React (with Hooks)</li>
            <li><strong className="font-semibold">AI</strong>: Google Gemini API (<code>gemini-2.5-flash</code> for analysis, <code>imagen-4.0-generate-001</code> for image generation)</li>
            <li><strong className="font-semibold">Styling</strong>: Tailwind CSS</li>
            <li><strong className="font-semibold">Deployment</strong>: Runs directly in the browser using ES modules and an import map.</li>
        </ul>
        
        <h2 className="text-3xl font-bold text-green-900 dark:text-emerald-200 mt-8 mb-4 border-b border-gray-300 dark:border-slate-700 pb-2">Disclaimer</h2>
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300 rounded-r-lg">
            <p>This application is intended for educational and informational purposes only. It is not a substitute for professional medical, veterinary, or botanical advice. Always consult with a qualified expert before consuming any plant or applying any treatment. AI-based identification may not be 100% accurate.</p>
        </div>
    </>
);


export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
    const { language, t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t('appManual')}</h2>
                    <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="overflow-y-auto p-4 sm:p-8 text-slate-800 dark:text-slate-200 font-sans">
                    {language === 'es' ? <ManualContentEs /> : <ManualContentEn />}
                </div>
            </div>
        </div>
    );
};
