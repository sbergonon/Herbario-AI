import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PlantInfo, GroundingSource, HistoryEntry, Preparation, DiseaseInfo, ComparisonInfo, SuggestedPlant, CareGuideInfo, ToxicityInfo, ActiveCompound } from './types';
import { identifyPlantFromImage, identifyPlantFromText, diagnosePlantDiseaseFromImage, comparePlants, findPlantsByUsage, generateCareGuide, findLocalPlants } from './services/geminiService';
import { Icon } from './components/Icons';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ManualModal } from './components/ManualModal';
import { useApiKey } from './contexts/ApiKeyContext';
import { useLanguage } from './contexts/LanguageContext';

declare global {
  interface Window { jspdf: any; html2canvas: any; }
}

// Helper for haptic feedback on supported devices
const triggerHapticFeedback = (pattern: number | number[] = 50) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration might be disabled by user settings in the browser
      console.log("Haptic feedback is not available or has been disabled by the user.");
    }
  }
};


type MainMode = 'identify' | 'diagnose' | 'remedy' | 'discover';
type AppView = 'main' | 'comparator';
type Theme = 'light' | 'dark';

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve((reader.result as string).split(',')[1]);
  reader.onerror = (error) => reject(error);
});

const blobUrlToDataUrl = (blobUrl: string): Promise<string> => new Promise((resolve, reject) => {
  fetch(blobUrl).then(res => res.blob()).then(blob => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }).catch(reject);
});

// Helper function to create a placeholder SVG image
const createPlaceholderImage = (text: string): string => {
  const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, "'");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="100%" height="100%" fill="#ecfdf5"/>
      <circle cx="200" cy="180" r="110" fill="#d1fae5"/>
      <g transform="translate(100, 80) scale(8)">
        <path stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.106.805.286 1.164m-3.14-1.465A2.25 2.25 0 0 0 6.75 5.25v1.875c0 .597.237 1.17.659 1.591l6.499 6.501c.422.422 1.002.659 1.591.659h1.875a2.25 2.25 0 0 0 2.25-2.25v-1.875a2.25 2.25 0 0 0-.659-1.591L9.25 5.512a2.25 2.25 0 0 0-1.591-.659H6.75a2.25 2.25 0 0 0-2.25 2.25v5.25c0 .621.504 1.125 1.125 1.125h5.25a1.125 1.125 0 0 0 1.125-1.125v-5.25a1.125 1.125 0 0 0-1.125-1.125h-1.5a1.125 1.125 0 0 0-1.125 1.125v1.5a3.375 3.375 0 0 0 6.75 0V9a2.25 2.25 0 0 0-2.25-2.25h-1.5a2.25 2.25 0 0 0-2.25 2.25v1.5" />
      </g>
      <text x="200" y="340" font-family="sans-serif" font-weight="bold" font-size="24" fill="#065f46" text-anchor="middle" dominant-baseline="middle">${safeText}</text>
    </svg>
  `.trim();
  // Fix: Encode URI component to handle UTF-8 characters (like accents) correctly in base64
  const base64Svg = btoa(unescape(encodeURIComponent(svg.replace(/\n/g, ''))));
  return `data:image/svg+xml;base64,${base64Svg}`;
};

// Creates a compressed thumbnail from a data URL to save storage space.
const createThumbnail = (dataUrl: string, maxSize = 400): Promise<string> => {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            resolve(dataUrl); // Not an image data URL, return as is.
            return;
        }

        // Fix: Skip SVG images to avoid "Failed to load image" errors and unnecessary rasterization.
        if (dataUrl.startsWith('data:image/svg+xml')) {
            resolve(dataUrl);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context');
                resolve(dataUrl); // Fallback to original
                return;
            }

            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Use JPEG for better compression of photographic images.
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            console.error("Failed to load image for thumbnail creation.");
            resolve(dataUrl); // Fallback to original URL on error.
        };
        img.src = dataUrl;
    });
};

// --- NOTIFICATION COMPONENT ---
const Notification: React.FC<{ message: string; onClose: () => void; }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down" role="alert" aria-live="assertive">
      <div className="flex items-center gap-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg">
        <Icon name="bookmark" className="w-5 h-5" />
        <span>{message}</span>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const SearchInput: React.FC<{ onSearch: (query: string) => void; isLoading: boolean; placeholder?: string; }> = ({ onSearch, isLoading, placeholder }) => {
  const [query, setQuery] = useState('');
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (query.trim() && !isLoading) {
        triggerHapticFeedback();
        onSearch(query.trim()); 
    }
  };
  return (
    <form onSubmit={handleSubmit} className="w-full mb-6">
      <div className="relative">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isLoading} placeholder={placeholder} className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-700 border border-green-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 transition-shadow dark:text-slate-200"/>
        <button type="submit" disabled={isLoading || !query.trim()} className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-green-600 dark:text-emerald-400 hover:text-green-800 dark:hover:text-emerald-300 disabled:text-gray-300 dark:disabled:text-slate-500 transition-colors">
          <Icon name="search" className="w-6 h-6" />
        </button>
      </div>
    </form>
  );
};

const MainInput: React.FC<{ onImageSelect: (file: File) => void; isLoading: boolean; onTextSearch: (query: string) => void; onRemedySearch: (query: string, useGeo: boolean) => void; onError: (message: string) => void; mode: MainMode; onModeChange: (mode: MainMode) => void; }> = ({ onImageSelect, isLoading, onTextSearch, onRemedySearch, onError, mode, onModeChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const [remedyQuery, setRemedyQuery] = useState('');
  const [useGeolocation, setUseGeolocation] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) { onError('The selected file is not an image. Please choose a JPG, PNG, WEBP, etc.'); if (event.target) event.target.value = ''; return; }
      onImageSelect(file);
    }
    if (event.target) event.target.value = '';
  };
  
  const handleRemedySubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (remedyQuery.trim() && !isLoading) {
        triggerHapticFeedback();
        onRemedySearch(remedyQuery.trim(), useGeolocation); 
    }
  };

  const modeConfig: { [key in MainMode]: { icon: string; titleKey: string; buttonTextKey: string, descriptionKey: string } } = {
    identify: { icon: 'leaf', titleKey: 'appName', buttonTextKey: 'identifyPlant', descriptionKey: 'identifyPlantTitle' },
    diagnose: { icon: 'bug', titleKey: 'diseaseDiagnostic', buttonTextKey: 'diagnosePlant', descriptionKey: 'diagnosePlantTitle' },
    remedy: { icon: 'mortar-pestle', titleKey: 'findRemedy', buttonTextKey: 'findRemedy', descriptionKey: 'remedySearchTitle' },
    discover: { icon: 'compass', titleKey: 'discoverTitle', buttonTextKey: 'discover', descriptionKey: 'discoverDescription' },
  };

  return (
    <div className="w-full max-w-md p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-green-200 dark:border-emerald-700 text-center">
      <div className="flex w-full bg-green-100 dark:bg-slate-700 rounded-full p-1 mb-6 transition-colors">
        {Object.entries(modeConfig).map(([key, config]) => (
          <button key={key} onClick={() => { onModeChange(key as MainMode); triggerHapticFeedback(); }} className={`w-1/4 py-2 px-1 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 ${mode === key ? 'bg-white dark:bg-slate-800 shadow text-green-800 dark:text-emerald-200' : 'text-green-700 dark:text-slate-300'}`}>
            <Icon name={config.icon} className="w-5 h-5" />
            {t(config.buttonTextKey)}
          </button>
        ))}
      </div>
      <h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t(modeConfig[mode].titleKey)}</h2>
      <p className="text-gray-600 dark:text-slate-400 mb-6">{t(modeConfig[mode].descriptionKey)}</p>
      
      {mode === 'identify' && <SearchInput onSearch={onTextSearch} isLoading={isLoading} placeholder={t('searchByNamePlaceholder')} />}
      
      {mode === 'identify' && (
        <div className="relative flex items-center my-4">
          <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
          <span className="flex-shrink mx-4 text-gray-500 dark:text-slate-400 font-semibold text-sm">{t('orSeparator')}</span>
          <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
        </div>
      )}
      
      {mode === 'remedy' && (
         <form onSubmit={handleRemedySubmit} className="w-full">
            <div className="relative">
                <input type="search" value={remedyQuery} onChange={(e) => setRemedyQuery(e.target.value)} disabled={isLoading} placeholder={t('remedySearchPlaceholder')} className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-700 border border-green-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500"/>
                <button type="submit" disabled={isLoading || !remedyQuery.trim()} className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-green-600 dark:text-emerald-400 disabled:text-gray-400 dark:disabled:text-slate-500"><Icon name="search" /></button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
                <label htmlFor="geo-toggle" className="text-sm font-medium text-gray-700 dark:text-slate-300 cursor-pointer">{t('prioritizeLocal')}</label>
                <button type="button" role="switch" aria-checked={useGeolocation} onClick={() => { setUseGeolocation(!useGeolocation); triggerHapticFeedback(); }} className={`${useGeolocation ? 'bg-green-600' : 'bg-gray-200 dark:bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}>
                    <span className={`${useGeolocation ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                </button>
            </div>
        </form>
      )}

      {(mode === 'identify' || mode === 'diagnose') && (
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
            <button onClick={() => { cameraInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isLoading} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 focus:ring-offset-2 transition-transform transform hover:scale-105">
            <Icon name="camera" className="w-5 h-5" />{t('takePhoto')}
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
            <button onClick={() => { fileInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isLoading} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-700 text-green-700 dark:text-emerald-300 font-semibold rounded-lg shadow-md border border-green-300 dark:border-slate-600 hover:bg-green-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 focus:ring-offset-2 transition-transform transform hover:scale-105">
            <Icon name="upload" className="w-5 h-5" />{t('uploadFile')}
            </button>
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-6 max-w-sm mx-auto">{t('warningDisclaimer')}</p>
    </div>
  );
};

const Loader: React.FC<{ message: string, subMessage: string }> = ({ message, subMessage }) => (
    <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 dark:border-emerald-500 mx-auto"></div>
        <p className="mt-6 text-lg font-semibold text-green-800 dark:text-emerald-200">{message}</p>
        <p className="mt-2 text-gray-600 dark:text-slate-400">{subMessage}</p>
    </div>
);

const ToxicityMeter: React.FC<{ level: ToxicityInfo['nivelToxicidad'] }> = ({ level }) => {
    const { t } = useLanguage();
    const levels = ['None', 'Low', 'Medium', 'High', 'Lethal'];
    const levelIndex = levels.indexOf(level);
    const config = {
      None: { text: t('toxicityLevel_None'), color: 'bg-green-500', barColor: 'bg-green-200 dark:bg-green-800' },
      Low: { text: t('toxicityLevel_Low'), color: 'bg-yellow-500', barColor: 'bg-yellow-200 dark:bg-yellow-800' },
      Medium: { text: t('toxicityLevel_Medium'), color: 'bg-orange-500', barColor: 'bg-orange-200 dark:bg-orange-800' },
      High: { text: t('toxicityLevel_High'), color: 'bg-red-500', barColor: 'bg-red-200 dark:bg-red-800' },
      Lethal: { text: t('toxicityLevel_Lethal'), color: 'bg-purple-600', barColor: 'bg-purple-200 dark:bg-purple-800' },
    };
    const { text, color, barColor } = config[level] || config.Low;
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('toxicityLevel')}</span>
                <span className={`text-sm font-bold ${color.replace('bg-', 'text-')}`}>{text}</span>
            </div>
            <div className={`w-full h-2.5 rounded-full flex overflow-hidden ${barColor}`}>
                {levels.map((l, i) => (
                    <div key={l} className={`w-1/5 h-full ${i <= levelIndex ? color : ''}`}></div>
                ))}
            </div>
        </div>
    );
};

interface ShareableCardProps {
  plantInfo: PlantInfo;
  imageSrc: string;
  onRef: (node: HTMLDivElement | null) => void;
}

const ShareableCard: React.FC<ShareableCardProps> = ({ plantInfo, imageSrc, onRef }) => {
    const { t } = useLanguage();
    return (
        <div ref={onRef} className="w-[400px] bg-white dark:bg-slate-800 font-sans shadow-2xl rounded-lg overflow-hidden border border-green-200 dark:border-emerald-700">
            <img src={imageSrc} alt={plantInfo.nombreComun} className="w-full h-52 object-cover" />
            <div className="p-5">
                <h2 className="text-2xl font-extrabold text-green-800 dark:text-emerald-200">{plantInfo.nombreComun}</h2>
                <p className="text-md text-gray-500 dark:text-slate-400 italic mb-3">{plantInfo.nombreCientifico}</p>
                <div className="mb-4">
                  <ToxicityMeter level={plantInfo.toxicidad.nivelToxicidad} />
                </div>
                {plantInfo.usosMedicinales && plantInfo.usosMedicinales.length > 0 && (
                    <>
                        <h3 className="font-bold text-lg text-green-900 dark:text-emerald-300 mb-2">{t('medicinalUses')}</h3>
                        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-slate-300 space-y-1">
                            {plantInfo.usosMedicinales.slice(0, 3).map((use, i) => <li key={i}>{use}</li>)}
                        </ul>
                    </>
                )}
            </div>
            <div className="px-5 py-3 bg-green-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-green-800 dark:text-emerald-400">
                <span className="font-bold">Herbario IA</span>
                <Icon name="leaf" className="w-4 h-4" />
            </div>
        </div>
    );
};

interface ResultCardProps { 
    result: HistoryEntry; 
    onReset: () => void; 
    isInHerbarium: boolean; 
    onToggleHerbarium: () => void; 
    onStartCompare?: () => void;
    onGenerateCareGuide: () => void;
    isGeneratingCareGuide: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onReset, isInHerbarium, onToggleHerbarium, onStartCompare, onGenerateCareGuide, isGeneratingCareGuide }) => {
    const { plantInfo, sources, imageSrc, mapaDistribucionSrc, careGuide, imageGenerationFailed } = result;
    const { t } = useLanguage();
    const resultCardRef = useRef<HTMLDivElement>(null);
    const shareableCardRef = useRef<HTMLDivElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showShareableCard, setShowShareableCard] = useState(false);

    if (!plantInfo) return null;

    const [sharedPrep, setSharedPrep] = useState<string | null>(null);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [t('medicinalUses')]: true, [t('toxicity')]: true, [t('distributionMap')]: true, [t('careGuide')]: true });

    const toggleSection = (title: string) => setOpenSections(prev => ({...prev, [title]: !prev[title]}));

    const handleSharePreparation = async (prep: Preparation) => {
        triggerHapticFeedback();
        const shareText = `${t('appName')} Recipe: ${prep.nombre}\n\n${t('ingredients')}:\n- ${prep.ingredientes.join('\n- ')}\n\n${t('instructions')}:\n${prep.instrucciones}\n\n${t('recommendedDose')}:\n${prep.dosis || t('dosageNotSpecified')}`;
        try {
            if (navigator.share) await navigator.share({ title: `Recipe: ${prep.nombre}`, text: shareText, url: window.location.href });
            else { await navigator.clipboard.writeText(shareText); setSharedPrep(prep.nombre); setTimeout(() => setSharedPrep(null), 2500); }
        } catch (err) {
            try { await navigator.clipboard.writeText(shareText); setSharedPrep(prep.nombre); setTimeout(() => setSharedPrep(null), 2500); } catch (clipErr) { alert('Could not share or copy preparation.'); }
        }
    };
    
    const handleShareAsImage = async () => {
        if (!shareableCardRef.current) {
            setShowShareableCard(true);
            // Wait for the next render cycle for the ref to be populated
            setTimeout(handleShareAsImage, 100);
            return;
        }
        setIsSharing(true);
        triggerHapticFeedback();

        try {
            const canvas = await window.html2canvas(shareableCardRef.current, { useCORS: true, backgroundColor: null });
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert('Could not generate image.');
                    setIsSharing(false);
                    return;
                }
                const file = new File([blob], `${plantInfo.nombreComun}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: plantInfo.nombreComun,
                        text: `${t('checkOutPlant')} ${plantInfo.nombreComun} - ${t('identifiedWith')} Herbario IA`,
                    });
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `${plantInfo.nombreComun.replace(/ /g, '_')}.png`;
                    link.click();
                }
            }, 'image/png');
        } catch (error) {
            console.error('Sharing failed:', error);
            alert('Could not share image.');
        } finally {
            setIsSharing(false);
            setShowShareableCard(false);
        }
    };

    const handleExportPdf = async () => {
        if (!resultCardRef.current || !plantInfo) return;
        setIsExporting(true);
        triggerHapticFeedback();
        const buttonsToHide = resultCardRef.current.querySelectorAll('.hide-on-export');
        buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'hidden'));
        const originalOpenSections = { ...openSections };
        const allPossibleSections = [
            careGuide ? t('careGuide') : null,
            plantInfo.usosMedicinales?.length > 0 ? t('medicinalUses') : null,
            mapaDistribucionSrc ? t('distributionMap') : null,
            plantInfo.usosCulinarios?.length > 0 ? t('culinaryUses') : null,
            plantInfo.principiosActivos?.length > 0 ? t('activeCompounds') : null,
            plantInfo.plantasConPrincipiosActivosSimilares?.length > 0 ? t('similarActivePlants') : null,
            plantInfo.toxicidad ? t('toxicity') : null,
            plantInfo.plantasSimilares?.length > 0 ? t('similarPlants') : null,
            plantInfo.preparaciones?.length > 0 ? t('preparationsAndRecipes') : null,
            sources.length > 0 ? t('sources') : null,
        ].filter(Boolean) as string[];

        const allOpenState = allPossibleSections.reduce((acc, title) => ({ ...acc, [title]: true }), {});
        setOpenSections(allOpenState);
        setTimeout(() => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            doc.html(resultCardRef.current, {
                callback: (doc: any) => {
                    doc.save(`${plantInfo.nombreComun.replace(/ /g, '_')}.pdf`);
                    setIsExporting(false);
                    setOpenSections(originalOpenSections);
                    buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'visible'));
                },
                margin: [40, 40, 40, 40],
                autoPaging: 'text',
                html2canvas: { scale: 0.7, useCORS: true },
                width: 515,
                windowWidth: resultCardRef.current.offsetWidth,
            });
        }, 500);
    };

    const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; }> = ({ title, icon, children }) => {
        const isOpen = openSections[title] ?? false;
        return (
            <div className="mb-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
                <button className="w-full flex justify-between items-center py-4 focus:outline-none text-left" onClick={() => toggleSection(title)} aria-expanded={isOpen}>
                    <div className="flex items-center min-w-0 mr-4">
                        <Icon name={icon} className="w-7 h-7 text-green-700 dark:text-emerald-400 mr-3 flex-shrink-0" />
                        <h3 className="text-xl font-bold text-green-900 dark:text-emerald-200 break-words">{title}</h3>
                    </div>
                    <Icon name="chevron-down" className={`w-6 h-6 text-gray-500 dark:text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}>
                    <div className="pl-10 pb-6 text-gray-700 dark:text-slate-300 text-base">{children}</div>
                </div>
            </div>
        );
    };

    const getToxicityBadge = (level: ToxicityInfo['nivelToxicidad']) => {
        const config = {
          None: { text: t('toxicityLevel_None'), color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
          Low: { text: t('toxicityLevel_Low'), color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
          Medium: { text: t('toxicityLevel_Medium'), color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
          High: { text: t('toxicityLevel_High'), color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
          Lethal: { text: t('toxicityLevel_Lethal'), color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
        };
        const { text, color } = config[level] || config.Low;
        return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
    };
  
  return (
    <>
    {showShareableCard && (
        <div className="fixed top-0 left-[-9999px]" aria-hidden="true">
            <ShareableCard plantInfo={plantInfo} imageSrc={imageSrc} onRef={(node) => shareableCardRef.current = node} />
        </div>
    )}
    <div ref={resultCardRef} className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-green-200 dark:border-emerald-800">
        <div className="p-6 md:p-8">
            <div className="md:flex md:gap-8">
                <div className="md:w-1/3 mb-6 md:mb-0">
                    <img src={imageSrc} alt={plantInfo.nombreComun} className="rounded-xl shadow-lg w-full object-cover aspect-square"/>
                    {imageGenerationFailed && (
                        <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                                {t('imageGenerationFailedWarning')}
                            </p>
                        </div>
                    )}
                </div>
                <div className="md:w-2/3">
                    <div className="mb-4">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-green-800 dark:text-emerald-200 break-words">{plantInfo.nombreComun}</h2>
                        <p className="text-lg sm:text-xl text-gray-500 dark:text-slate-400 italic mt-1 break-words">{plantInfo.nombreCientifico}</p>
                        {plantInfo.sinonimos?.length > 0 && <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 break-words"><strong>{t('alsoKnownAs')}:</strong> {plantInfo.sinonimos.join(', ')}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button onClick={handleShareAsImage} disabled={isSharing} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isSharing ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="share-up" className="w-4 h-4" />}
                            {isSharing ? t('sharing') : t('share')}
                        </button>
                        {onStartCompare && (<button onClick={() => { onStartCompare(); triggerHapticFeedback(); }} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"><Icon name="compare" className="w-4 h-4" />{t('compare')}</button>)}
                        <button onClick={onToggleHerbarium} className={`hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${ isInHerbarium ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600' }`}><Icon name="bookmark" className="w-4 h-4" />{isInHerbarium ? t('saved') : t('save')}</button>
                        <button onClick={handleExportPdf} disabled={isExporting} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isExporting ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="download" className="w-4 h-4" />}
                            {isExporting ? t('exporting') : t('exportToPdf')}
                        </button>
                    </div>

                    <ToxicityMeter level={plantInfo.toxicidad.nivelToxicidad} />
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed mt-4 break-words">{plantInfo.descripcionGeneral}</p>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-green-50 dark:bg-emerald-900/40 rounded-lg"><Icon name="globe" className="w-8 h-8 text-green-600 dark:text-emerald-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-green-800 dark:text-emerald-300">{t('habitat')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{plantInfo.habitat}</p></div>
                        <div className="p-4 bg-green-50 dark:bg-emerald-900/40 rounded-lg"><Icon name="sparkles" className="w-8 h-8 text-green-600 dark:text-emerald-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-green-800 dark:text-emerald-300">{t('flowering')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{plantInfo.floweringSeason}</p></div>
                        <div className="p-4 bg-green-50 dark:bg-emerald-900/40 rounded-lg"><Icon name="shield" className="w-8 h-8 text-green-600 dark:text-emerald-500 mx-auto mb-2" /><h4 className="font-semibold text-sm text-green-800 dark:text-emerald-300">{t('conservation')}</h4><p className="text-sm text-gray-600 dark:text-slate-400 break-words">{plantInfo.conservationStatus}</p></div>
                    </div>
                </div>
            </div>
            <div className="mt-8 border-t border-green-200 dark:border-emerald-800 pt-2">
              {!careGuide && (
                <div className="my-4 text-center">
                    <button onClick={() => { onGenerateCareGuide(); triggerHapticFeedback(); }} disabled={isGeneratingCareGuide} className="hide-on-export px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-transform transform hover:scale-105 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-wait">
                        {isGeneratingCareGuide ? (
                            <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>{t('generating')}</span>
                        ) : (
                            <span className="flex items-center gap-2"><Icon name="sparkles" className="w-5 h-5"/>{t('generateCareGuide')}</span>
                        )}
                    </button>
                </div>
              )}
              {careGuide && (
                <Section title={t('careGuide')} icon="watering-can">
                    <div className="space-y-4 break-words">
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="watering-can" className="w-5 h-5" />{t('watering')}</h4>
                            <p><strong className="font-semibold">{t('frequency')}:</strong> {careGuide.riego.frecuencia}</p>
                            <p><strong className="font-semibold">{t('method')}:</strong> {careGuide.riego.metodo}</p>
                            <p className="mt-2 text-sm italic">{careGuide.riego.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="sun" className="w-5 h-5" />{t('light')}</h4>
                            <p><strong className="font-semibold">{t('level')}:</strong> {careGuide.luz.nivel}</p>
                            <p><strong className="font-semibold">{t('location')}:</strong> {careGuide.luz.ubicacion}</p>
                             <p className="mt-2 text-sm italic">{careGuide.luz.consejo}</p>
                        </div>
                         <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="leaf" className="w-5 h-5" />{t('soil')}</h4>
                            <p><strong className="font-semibold">{t('type')}:</strong> {careGuide.suelo.tipo}</p>
                            <p><strong className="font-semibold">{t('drainage')}:</strong> {careGuide.suelo.drenaje}</p>
                            <p className="mt-2 text-sm italic">{careGuide.suelo.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200">{t('temperatureAndHumidity')}</h4>
                            <p><strong className="font-semibold">{t('temperature')}:</strong> {careGuide.temperaturaHumedad.temperatura}</p>
                            <p><strong className="font-semibold">{t('humidity')}:</strong> {careGuide.temperaturaHumedad.humedad}</p>
                            <p className="mt-2 text-sm italic">{careGuide.temperaturaHumedad.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200">{t('fertilization')}</h4>
                            <p><strong className="font-semibold">{t('frequency')}:</strong> {careGuide.fertilizacion.frecuencia}</p>
                            <p><strong className="font-semibold">{t('type')}:</strong> {careGuide.fertilizacion.tipo}</p>
                            <p className="mt-2 text-sm italic">{careGuide.fertilizacion.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="bug" className="w-5 h-5" />{t('pruningAndPests')}</h4>
                            <p><strong className="font-semibold">{t('pruning')}:</strong> {careGuide.podaPestes.poda}</p>
                            <p><strong className="font-semibold">{t('commonPests')}:</strong> {careGuide.podaPestes.pestesComunes}</p>
                            <p className="mt-2 text-sm italic">{careGuide.podaPestes.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="repot" className="w-5 h-5" />{t('repotting')}</h4>
                            <p><strong className="font-semibold">{t('frequency')}:</strong> {careGuide.trasplante.frecuencia}</p>
                            <p><strong className="font-semibold">{t('instructions')}:</strong> {careGuide.trasplante.instrucciones}</p>
                            <p className="mt-2 text-sm italic">{careGuide.trasplante.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="scissors" className="w-5 h-5" />{t('propagation')}</h4>
                            <p><strong className="font-semibold">{t('methods')}:</strong> {careGuide.propagacion.metodos}</p>
                            <p><strong className="font-semibold">{t('instructions')}:</strong> {careGuide.propagacion.instrucciones}</p>
                            <p className="mt-2 text-sm italic">{careGuide.propagacion.consejo}</p>
                        </div>
                        <div className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 flex items-center gap-2"><Icon name="lightbulb" className="w-5 h-5" />{t('additionalTips')}</h4>
                            <p><strong className="font-semibold">{t('airPurification')}:</strong> {careGuide.consejosAdicionales.purificacionAire}</p>
                            <p><strong className="font-semibold">{t('petSafety')}:</strong> {careGuide.consejosAdicionales.seguridadMascotas}</p>
                            <p className="mt-2"><strong className="font-semibold">{t('funFact')}:</strong> <span className="italic">{careGuide.consejosAdicionales.datoCurioso}</span></p>
                        </div>
                    </div>
                </Section>
              )}
              {plantInfo.usosMedicinales?.length > 0 && <Section title={t('medicinalUses')} icon="leaf"><ul className="list-disc pl-5 space-y-1">{plantInfo.usosMedicinales.map((uso, i) => <li key={i} className="break-words">{uso}</li>)}</ul></Section>}
              {mapaDistribucionSrc && <Section title={t('distributionMap')} icon="map"><div className="space-y-4"><img src={mapaDistribucionSrc} alt={`Map of ${plantInfo.nombreComun}`} className="rounded-lg shadow-md w-full object-contain" /><p className="break-words">{plantInfo.distribucionGeografica}</p></div></Section>}
              {plantInfo.usosCulinarios?.length > 0 && <Section title={t('culinaryUses')} icon="utensils"><ul className="list-disc pl-5 space-y-1">{plantInfo.usosCulinarios.map((uso, i) => <li key={i} className="break-words">{uso}</li>)}</ul></Section>}
              {plantInfo.principiosActivos?.length > 0 && (
                <Section title={t('activeCompounds')} icon="beaker">
                    <div className="space-y-4">
                    {plantInfo.principiosActivos.map((pa, i) => (
                        <div key={i} className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                        <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 break-words">{pa.nombre}</h4>
                        <p className="text-gray-700 dark:text-slate-300 mt-1 break-words">{pa.usos}</p>
                        </div>
                    ))}
                    </div>
                </Section>
              )}
              {plantInfo.plantasConPrincipiosActivosSimilares?.length > 0 && (
                <Section title={t('similarActivePlants')} icon="beaker">
                    <div className="space-y-4">{plantInfo.plantasConPrincipiosActivosSimilares.map((similar, i) => (
                        <div key={i} className="p-4 border border-green-200 dark:border-emerald-700 rounded-lg bg-green-50 dark:bg-emerald-900/40">
                            <h4 className="font-bold text-lg text-green-900 dark:text-emerald-200 break-words">{similar.nombreComun}</h4><p className="text-sm text-gray-600 dark:text-slate-400 italic mb-2 break-words">{similar.nombreCientifico}</p>
                            <p className="font-semibold text-gray-700 dark:text-slate-300 break-words">{t('sharedActiveCompound')}:</p><p className="text-gray-700 dark:text-slate-300 break-words">{similar.principioActivoCompartido}</p>
                        </div>))}</div>
                </Section>
              )}
              <Section title={t('toxicity')} icon="cross">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <h4 className="font-semibold text-gray-800 dark:text-slate-200">{t('toxicityLevel')}:</h4>
                        {getToxicityBadge(plantInfo.toxicidad.nivelToxicidad)}
                    </div>
                    <p className="bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300 p-4 rounded-r-lg break-words">{plantInfo.toxicidad.descripcion}</p>
                    {plantInfo.toxicidad.compuestosToxicos.length > 0 && (<div><h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('toxicCompounds')}:</h4><ul className="list-disc pl-5 text-sm space-y-1">{plantInfo.toxicidad.compuestosToxicos.map((c, i) => <li key={i} className="break-words">{c}</li>)}</ul></div>)}
                    {plantInfo.toxicidad.sistemasAfectados.length > 0 && (<div><h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('affectedSystems')}:</h4><ul className="list-disc pl-5 text-sm space-y-1">{plantInfo.toxicidad.sistemasAfectados.map((s, i) => <li key={i} className="break-words">{s}</li>)}</ul></div>)}
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                        <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2"><Icon name="cross" className="w-5 h-5" />{t('firstAid')}</h4>
                        <p className="mt-2 text-red-700 dark:text-red-300 text-sm break-words">{plantInfo.toxicidad.primerosAuxilios}</p>
                    </div>
                </div>
              </Section>
              {plantInfo.plantasSimilares?.length > 0 && (
                <Section title={t('similarPlants')} icon="cross">
                    <div className="space-y-4">{plantInfo.plantasSimilares.map((similar, i) => (
                        <div key={i} className="p-4 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/40">
                            <h4 className="font-bold text-lg text-amber-900 dark:text-amber-200 break-words">{similar.nombreComun}</h4><p className="text-sm text-amber-700 dark:text-amber-400 italic mb-2 break-words">{similar.nombreCientifico}</p>
                            <p className="font-semibold text-amber-800 dark:text-amber-300">{t('keyDifference')}:</p><p className="text-amber-800 dark:text-amber-300 break-words">{similar.diferenciaClave}</p>
                        </div>))}</div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-400"><strong>{t('importantDisclaimerSimilar')}</strong></p>
                </Section>
              )}
              {plantInfo.preparaciones?.length > 0 && (
              <Section title={t('preparationsAndRecipes')} icon="pot">
                {plantInfo.preparaciones.map((prep, i) => (
                  <div key={i} className="mb-6 p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-lg text-green-800 dark:text-emerald-300 break-words">{prep.nombre}</h4>
                        <button onClick={() => handleSharePreparation(prep)} className={`hide-on-export inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${ sharedPrep === prep.nombre ? 'bg-blue-100 text-blue-800 focus:ring-blue-500 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600' }`} disabled={sharedPrep === prep.nombre}><Icon name={sharedPrep === prep.nombre ? 'clipboard-check' : 'share'} className="w-3 h-3" />{sharedPrep === prep.nombre ? t('copied') : t('share')}</button>
                    </div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('ingredients')}:</h5><ul className="list-disc pl-5 text-gray-600 dark:text-slate-400">{prep.ingredientes.map((ing, j) => <li key={j} className="break-words">{ing}</li>)}</ul></div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('instructions')}:</h5><p className="text-gray-600 dark:text-slate-400 break-words">{prep.instrucciones}</p></div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('recommendedDose')}:</h5><p className="text-gray-600 dark:text-slate-400 break-words">{prep.dosis || t('dosageNotSpecified')}</p></div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('possibleSideEffects')}:</h5><div className="mt-1 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-md"><p className="text-amber-800 dark:text-amber-300 text-sm break-words">{prep.efectosSecundarios}</p></div></div>
                    <div className="mb-3"><h5 className="font-semibold text-gray-700 dark:text-slate-300">{t('historicalContext')}:</h5><p className="text-gray-600 dark:text-slate-400 italic break-words">{prep.contextoHistorico}</p></div>
                  </div>
                ))}
              </Section>
              )}
              {sources.length > 0 && (<Section title={t('sources')} icon="link"><ul className="space-y-2">{sources.map((source, i) => (<li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors flex items-start gap-2"><span className="flex-shrink-0 pt-1"><Icon name="link" className="w-4 h-4" /></span><span className="truncate">{source.title}</span></a></li>))}</ul></Section>)}
            </div>
        </div>
        <div className="p-6 bg-gray-50 dark:bg-slate-900/50 text-center"><button onClick={() => { onReset(); triggerHapticFeedback(); }} className="hide-on-export px-8 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-transform transform hover:scale-105">{t('anotherQuery')}</button></div>
    </div>
    </>
  );
};

// Fix: Defined a separate props interface for DiseaseResultCard to avoid type errors.
interface DiseaseResultCardProps {
  result: HistoryEntry;
  onReset: () => void;
  isInHerbarium: boolean;
  onToggleHerbarium: () => void;
}

const DiseaseResultCard: React.FC<DiseaseResultCardProps> = ({ result, onReset, isInHerbarium, onToggleHerbarium }) => {
    const { diseaseInfo, imageSrc } = result;
    const { t } = useLanguage();
    const resultCardRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    if (!diseaseInfo) return null;
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [t('symptoms')]: true, [t('causes')]: true, [t('organicTreatment')]: true, [t('chemicalTreatment')]: true, [t('prevention')]: true, });
    const toggleSection = (title: string) => setOpenSections(prev => ({...prev, [title]: !prev[title]}));
    
    const handleExportPdf = async () => {
        if (!resultCardRef.current || !diseaseInfo) return;
        setIsExporting(true);
        triggerHapticFeedback();
        const buttonsToHide = resultCardRef.current.querySelectorAll('.hide-on-export');
        buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'hidden'));
        const originalOpenSections = { ...openSections };
        const allPossibleSections = [
            diseaseInfo.sintomas.length > 0 ? t('symptoms') : null,
            diseaseInfo.causas.length > 0 ? t('causes') : null,
            diseaseInfo.tratamientoOrganico.length > 0 ? t('organicTreatment') : null,
            diseaseInfo.tratamientoQuimico.length > 0 ? t('chemicalTreatment') : null,
            diseaseInfo.prevencion.length > 0 ? t('prevention') : null,
        ].filter(Boolean) as string[];

        const allOpenState = allPossibleSections.reduce((acc, title) => ({ ...acc, [title]: true }), {});
        setOpenSections(allOpenState);
        setTimeout(() => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            doc.html(resultCardRef.current, {
                callback: (doc: any) => {
                    doc.save(`${diseaseInfo.nombreEnfermedad.replace(/ /g, '_')}.pdf`);
                    setIsExporting(false);
                    setOpenSections(originalOpenSections);
                    buttonsToHide.forEach(btn => ((btn as HTMLElement).style.visibility = 'visible'));
                },
                margin: [40, 40, 40, 40],
                autoPaging: 'text',
                html2canvas: { scale: 0.7, useCORS: true },
                width: 515,
                windowWidth: resultCardRef.current.offsetWidth,
            });
        }, 500);
    };

    const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; }> = ({ title, icon, children }) => {
        const isOpen = openSections[title] ?? false;
        return (
            <div className="mb-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
                <button className="w-full flex justify-between items-center py-4 focus:outline-none text-left" onClick={() => toggleSection(title)} aria-expanded={isOpen}>
                     <div className="flex items-center min-w-0 mr-4">
                        <Icon name={icon} className="w-7 h-7 text-green-700 dark:text-emerald-400 mr-3 flex-shrink-0" />
                        <h3 className="text-xl font-bold text-green-900 dark:text-emerald-200 break-words">{title}</h3>
                    </div>
                    <Icon name="chevron-down" className={`w-6 h-6 text-gray-500 dark:text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}><div className="pl-10 pb-6 text-gray-700 dark:text-slate-300 text-base">{children}</div></div>
            </div>
        );
    };
    return (
        <div ref={resultCardRef} className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-green-200 dark:border-emerald-800">
            <div className="p-6 md:p-8">
                <div className="md:flex md:gap-8">
                    <div className="md:w-1/3 mb-6 md:mb-0"><img src={imageSrc} alt={`Plant with ${diseaseInfo.nombreEnfermedad}`} className="rounded-xl shadow-lg w-full object-cover aspect-square"/></div>
                    <div className="md:w-2/3">
                        <div className="mb-4">
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-green-800 dark:text-emerald-200 break-words">{diseaseInfo.nombreEnfermedad}</h2>
                            {diseaseInfo.plantaAfectada.length > 0 && <p className="text-md text-gray-500 dark:text-slate-400 mt-1 break-words">{t('commonlyAffects')}: {diseaseInfo.plantaAfectada.join(', ')}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button disabled={true} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed"><Icon name="compare" className="w-4 h-4" />{t('compare')}</button>
                            <button onClick={onToggleHerbarium} className={`hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${ isInHerbarium ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}><Icon name="bookmark" className="w-4 h-4" />{isInHerbarium ? t('saved') : t('save')}</button>
                            <button onClick={handleExportPdf} disabled={isExporting} className="hide-on-export inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                                {isExporting ? <span className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></span> : <Icon name="download" className="w-4 h-4" />}
                                {isExporting ? t('exporting') : t('exportToPdf')}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="mt-8 border-t border-green-200 dark:border-emerald-800 pt-2">
                    {diseaseInfo.sintomas.length > 0 && <Section title={t('symptoms')} icon="bug"><ul className="list-disc pl-5 space-y-1">{diseaseInfo.sintomas.map((s, i) => <li key={i} className="break-words">{s}</li>)}</ul></Section>}
                    {diseaseInfo.causas.length > 0 && <Section title={t('causes')} icon="sparkles"><ul className="list-disc pl-5 space-y-1">{diseaseInfo.causas.map((c, i) => <li key={i} className="break-words">{c}</li>)}</ul></Section>}
                    {diseaseInfo.tratamientoOrganico.length > 0 && <Section title={t('organicTreatment')} icon="leaf"><ul className="list-disc pl-5 space-y-1">{diseaseInfo.tratamientoOrganico.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ul></Section>}
                    {diseaseInfo.tratamientoQuimico.length > 0 && <Section title={t('chemicalTreatment')} icon="beaker"><ul className="list-disc pl-5 space-y-1">{diseaseInfo.tratamientoQuimico.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ul></Section>}
                    {diseaseInfo.prevencion.length > 0 && <Section title={t('prevention')} icon="shield"><ul className="list-disc pl-5 space-y-1">{diseaseInfo.prevencion.map((p, i) => <li key={i} className="break-words">{p}</li>)}</ul></Section>}
                </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-slate-900/50 text-center"><button onClick={() => { onReset(); triggerHapticFeedback(); }} className="hide-on-export px-8 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-transform transform hover:scale-105">{t('anotherQuery')}</button></div>
        </div>
    );
};

const HistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; history: HistoryEntry[]; onSelectItem: (item: HistoryEntry) => void; onClearHistory: () => void; }> = ({ isOpen, onClose, history, onSelectItem, onClearHistory }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center"><h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t('historyModalTitle')}</h2><button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="overflow-y-auto p-2 flex-grow">
          {history.length > 0 ? (<ul>{history.map((item) => { const title = item.plantInfo?.nombreComun || item.diseaseInfo?.nombreEnfermedad || '...'; const icon = item.type === 'plant' ? 'leaf' : 'bug'; return (<li key={item.id}><button onClick={() => { onSelectItem(item); triggerHapticFeedback(); }} className="w-full text-left p-4 flex items-center gap-4 rounded-lg hover:bg-green-50 dark:hover:bg-emerald-900/50 transition-colors"><img src={item.imageSrc} alt={title} className="w-16 h-16 object-cover rounded-md shadow-sm flex-shrink-0" /><div className="flex-grow"><p className="font-semibold text-green-800 dark:text-emerald-300 flex items-center gap-2"><Icon name={icon} className="w-4 h-4 text-gray-400 dark:text-slate-500" /> {title}</p><p className="text-sm text-gray-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p></div></button></li>);})}</ul>) : (<div className="text-center p-10"><Icon name="history" className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-slate-400">{t('noHistory')}</p></div>)}
        </div>
        {history.length > 0 && (<div className="p-4 border-t border-gray-200 dark:border-slate-700 text-right"><button onClick={() => { triggerHapticFeedback(); if (window.confirm(t('clearHistoryConfirm'))) { onClearHistory();}}} className="px-4 py-2 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">{t('clearHistory')}</button></div>)}
      </div>
    </div>
  );
};

const HerbariumModal: React.FC<{ isOpen: boolean; onClose: () => void; herbarium: HistoryEntry[]; onSelectItem: (item: HistoryEntry) => void; onRemoveItem: (id: string) => void; onExport: () => void; sortOrder: string; onSortOrderChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; nameFilter: string; onNameFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void; useFilter: string; onUseFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onStartCompare: (item: HistoryEntry) => void; }> = ({ isOpen, onClose, herbarium, onSelectItem, onRemoveItem, onExport, sortOrder, onSortOrderChange, nameFilter, onNameFilterChange, useFilter, onUseFilterChange, onStartCompare }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0"><h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200">{t('herbariumModalTitle')}</h2><button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="search" className="w-5 h-5 text-gray-400" /></span><input type="text" placeholder={t('filterByName')} value={nameFilter} onChange={onNameFilterChange} className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-emerald-500 dark:text-slate-200"/></div>
                <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="leaf" className="w-5 h-5 text-gray-400" /></span><input type="text" placeholder={t('filterByUse')} value={useFilter} onChange={onUseFilterChange} className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-emerald-500 dark:text-slate-200"/></div>
                <div className="md:col-span-2"><select value={sortOrder} onChange={onSortOrderChange} className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-emerald-500 dark:text-slate-200"><option value="date-desc">{t('sortDateDesc')}</option><option value="date-asc">{t('sortDateAsc')}</option><option value="name-asc">{t('sortNameAsc')}</option><option value="name-desc">{t('sortNameDesc')}</option></select></div>
            </div>
        </div>
        <div className="overflow-y-auto p-2 flex-grow">
          {herbarium.length > 0 ? (<ul>{herbarium.map((item) => { const title = item.plantInfo?.nombreComun || item.diseaseInfo?.nombreEnfermedad || '...'; const icon = item.type === 'plant' ? 'leaf' : 'bug'; return (<li key={item.id} className="p-2 flex items-center gap-2 group"><button onClick={() => { onSelectItem(item); triggerHapticFeedback(); }} className="w-full text-left flex items-center gap-4 rounded-lg hover:bg-green-50 dark:hover:bg-emerald-900/50 transition-colors p-2 flex-grow"><img src={item.imageSrc} alt={title} className="w-16 h-16 object-cover rounded-md shadow-sm flex-shrink-0" /><div className="flex-grow"><p className="font-semibold text-green-800 dark:text-emerald-300 flex items-center gap-2"><Icon name={icon} className="w-4 h-4 text-gray-400 dark:text-slate-500" /> {title}</p><p className="text-sm text-gray-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</p></div></button>{item.type === 'plant' && (<button onClick={(e) => { e.stopPropagation(); onStartCompare(item); triggerHapticFeedback(); }} className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" aria-label={t('compare')}><Icon name="compare" className="w-5 h-5" /></button>)}<button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); triggerHapticFeedback(); }} className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" aria-label={t('removeFromHerbarium')}><Icon name="trash" className="w-5 h-5" /></button></li>);})}</ul>) : (<div className="text-center p-10"><Icon name="book" className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-slate-400">{t('noHerbarium')}</p></div>)}
        </div>
        {herbarium.length > 0 && (<div className="p-4 border-t border-gray-200 dark:border-slate-700 text-right flex-shrink-0"><button onClick={() => { onExport(); triggerHapticFeedback(); }} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">{t('exportToJson')}</button></div>)}
      </div>
    </div>
  );
};

const SuggestedPlantsList: React.FC<{ suggestions: SuggestedPlant[]; query: string; onSelect: (plantName: string) => void; onReset: () => void; }> = ({ suggestions, query, onSelect, onReset }) => {
  const { t } = useLanguage();
  return (
    <div className="w-full max-w-md p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-green-200 dark:border-emerald-700 text-center">
      <h2 className="text-2xl font-bold text-green-900 dark:text-emerald-200 mb-2">{t('remedySuggestionsTitle', {query})}</h2>
      <p className="text-gray-600 dark:text-slate-400 mb-6">{t('remedySuggestionsSubtitle')}</p>
      <ul className="space-y-3 text-left">{suggestions.map((plant, index) => (<li key={index}><button onClick={() => { onSelect(plant.nombreComun); triggerHapticFeedback(); }} className="w-full p-4 bg-green-50 dark:bg-emerald-900/40 rounded-lg shadow-sm hover:shadow-md hover:bg-green-100 dark:hover:bg-emerald-900/80 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-emerald-500 transition-all transform hover:scale-105"><h3 className="font-bold text-lg text-green-800 dark:text-emerald-300">{plant.nombreComun}</h3><p className="text-sm text-gray-700 dark:text-slate-300">{plant.relevancia}</p></button></li>))}</ul>
      <button onClick={onReset} className="mt-8 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">{t('anotherSearch')}</button>
    </div>
  );
};

const DiscoveryView: React.FC<{ onSelectPlant: (plantName: string) => void; onSelectCategory: (category: string) => void; }> = ({ onSelectPlant, onSelectCategory }) => {
    const { t, language } = useLanguage();
    const { effectiveApiKey } = useApiKey();
    const [plantOfTheDay, setPlantOfTheDay] = useState('');
    const [localPlants, setLocalPlants] = useState<SuggestedPlant[] | null>(null);
    const [localPlantsStatus, setLocalPlantsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [localPlantsMessage, setLocalPlantsMessage] = useState('');
    
    useEffect(() => {
        const today = new Date().toDateString();
        const storedDate = localStorage.getItem('plantOfTheDayDate');
        const storedPlant = localStorage.getItem('plantOfTheDay');
        if (storedDate === today && storedPlant) {
            setPlantOfTheDay(storedPlant);
        } else {
            const plants = ['Manzanilla', 'Lavanda', 'Menta', 'Romero', 'Diente de León', 'Ortiga', 'Caléndula', 'Aloe Vera', 'Ginseng', 'Equinácea'];
            const randomPlant = plants[Math.floor(Math.random() * plants.length)];
            setPlantOfTheDay(randomPlant);
            localStorage.setItem('plantOfTheDay', randomPlant);
            localStorage.setItem('plantOfTheDayDate', today);
        }
    }, []);

    const categories = useMemo(() => [
        { key: 'category_relaxation', icon: 'sparkles', value: language === 'es' ? 'Relajación y Estrés' : 'Relaxation & Stress', query: language === 'es' ? 'Estrés o ansiedad' : 'Stress or anxiety' },
        { key: 'category_digestion', icon: 'leaf', value: language === 'es' ? 'Salud Digestiva' : 'Digestive Health', query: language === 'es' ? 'indigestión' : 'indigestion' },
        { key: 'category_skin', icon: 'shield', value: language === 'es' ? 'Cuidado de la Piel' : 'Skin Care', query: language === 'es' ? 'irritación de la piel' : 'skin irritation' },
        { key: 'category_first_aid', icon: 'cross', value: language === 'es' ? 'Primeros Auxilios' : 'First Aid', query: language === 'es' ? 'cortes o quemaduras leves' : 'minor cuts or burns' },
    ], [language]);

    const getLocation = (): Promise<{ latitude: number; longitude: number }> => new Promise((resolve, reject) => { 
        if (!navigator.geolocation) { reject(new Error("Geolocation not supported.")); return; }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            (error) => reject(error),
            { timeout: 10000 }
        );
    });

    const handleFindLocalPlants = async () => {
        triggerHapticFeedback();
        setLocalPlantsStatus('loading');
        setLocalPlantsMessage(t('gettingLocation'));
        try {
            const location = await getLocation();
            setLocalPlantsMessage(t('findingPlants'));
            const plants = await findLocalPlants(effectiveApiKey!, location, language);
            setLocalPlants(plants);
            setLocalPlantsStatus('idle');
        } catch (err: any) {
            console.error(err);
            setLocalPlantsStatus('error');
            setLocalPlantsMessage(err.code === 1 ? t('locationPermissionDenied') : t('unexpectedError'));
        }
    };

    return (
        <div className="w-full max-w-md p-6 sm:p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-green-200 dark:border-emerald-700">
            <h2 className="text-2xl font-bold text-center text-green-900 dark:text-emerald-200 mb-6">{t('discoverTitle')}</h2>
            
            <div className="mb-8">
                <h3 className="font-semibold text-lg text-gray-700 dark:text-slate-300 mb-3">{t('plantOfTheDay')}</h3>
                <button onClick={() => { onSelectPlant(plantOfTheDay); triggerHapticFeedback(); }} className="w-full p-4 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900 dark:to-green-900 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 text-left">
                    <p className="text-2xl font-bold text-green-800 dark:text-emerald-200">{plantOfTheDay}</p>
                </button>
            </div>

            <div className="mb-8">
                <h3 className="font-semibold text-lg text-gray-700 dark:text-slate-300 mb-3">{t('exploreCategories')}</h3>
                <div className="grid grid-cols-2 gap-3">
                    {categories.map(cat => (
                        <button key={cat.key} onClick={() => { onSelectCategory(cat.query); triggerHapticFeedback(); }} className="p-3 bg-green-50 dark:bg-emerald-900/50 rounded-lg shadow-sm hover:shadow-md hover:bg-green-100 dark:hover:bg-emerald-900/80 transition-all flex items-center gap-3">
                            <Icon name={cat.icon} className="w-6 h-6 text-green-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="font-semibold text-sm text-green-800 dark:text-emerald-300">{cat.value}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-lg text-gray-700 dark:text-slate-300 mb-3">{t('plantsNearYou')}</h3>
                {localPlantsStatus === 'idle' && !localPlants && (
                    <button onClick={handleFindLocalPlants} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-transform transform hover:scale-105 flex items-center justify-center gap-2">
                        <Icon name="globe" className="w-5 h-5" />
                        {t('findLocalPlantsButton')}
                    </button>
                )}
                {localPlantsStatus === 'loading' && (
                    <div className="text-center p-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                        <p className="text-blue-700 dark:text-blue-300">{localPlantsMessage}</p>
                    </div>
                )}
                 {localPlantsStatus === 'error' && <p className="text-center p-4 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 rounded-lg">{localPlantsMessage}</p>}
                 {localPlants && (
                    <ul className="space-y-3 text-left">
                        {localPlants.map((plant, index) => (
                            <li key={index}>
                                <button onClick={() => { onSelectPlant(plant.nombreComun); triggerHapticFeedback(); }} className="w-full p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-100 dark:hover:bg-blue-900/80 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 transition-all">
                                    <h4 className="font-bold text-md text-blue-800 dark:text-blue-300">{plant.nombreComun}</h4>
                                    <p className="text-xs text-blue-700 dark:text-blue-400">{plant.relevancia}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                 )}
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

function App() {
  const [view, setView] = useState<AppView>('main');
  const [image, setImage] = useState<{ file: File; src: string; mimeType: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTextSearching, setIsTextSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [herbarium, setHerbarium] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHerbariumOpen, setIsHerbariumOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [mainMode, setMainMode] = useState<MainMode>('identify');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [comparisonPlants, setComparisonPlants] = useState<{ plantA: HistoryEntry | null, plantB: HistoryEntry | null }>({ plantA: null, plantB: null });
  const [comparisonResult, setComparisonResult] = useState<ComparisonInfo | null>(null);
  const [suggestedPlants, setSuggestedPlants] = useState<SuggestedPlant[] | null>(null);
  const [remedyQuery, setRemedyQuery] = useState('');
  const [isGeneratingCareGuide, setIsGeneratingCareGuide] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  
  const { effectiveApiKey } = useApiKey();
  const { t, language, setLanguage } = useLanguage();

  const [herbariumSortOrder, setHerbariumSortOrder] = useState('date-desc');
  const [herbariumNameFilter, setHerbariumNameFilter] = useState('');
  const [herbariumUseFilter, setHerbariumUseFilter] = useState('');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    triggerHapticFeedback();
  };


  useEffect(() => {
    try {
        const storedHistory = localStorage.getItem('plantHistory');
        if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
        }
    } catch (e) {
        console.error("Failed to load or parse history from localStorage. Data might be corrupt.", e);
    }
    try {
        const storedHerbarium = localStorage.getItem('plantHerbarium');
        if (storedHerbarium) {
            setHerbarium(JSON.parse(storedHerbarium));
        }
    } catch (e) {
        console.error("Failed to load or parse herbarium from localStorage. Data might be corrupt.", e);
    }
  }, []);

  useEffect(() => {
    if (!effectiveApiKey) {
      setIsApiKeyModalOpen(true);
    }
  }, [effectiveApiKey]);

  const saveHistory = (newHistory: HistoryEntry[]) => { const sorted = newHistory.sort((a, b) => b.timestamp - a.timestamp); setHistory(sorted); localStorage.setItem('plantHistory', JSON.stringify(sorted)); };
  const saveHerbarium = (newHerbarium: HistoryEntry[]) => { setHerbarium(newHerbarium); localStorage.setItem('plantHerbarium', JSON.stringify(newHerbarium)); };
  
  const handleReset = useCallback(() => { 
    setImage(null); 
    setCurrentResult(null); 
    setError(null); 
    setIsLoading(false); 
    setIsTextSearching(false); 
    setView('main'); 
    setComparisonPlants({ plantA: null, plantB: null }); 
    setComparisonResult(null); 
    setSuggestedPlants(null); 
    setRemedyQuery(''); 
    setMainMode('identify');
  }, []);
  
  const handleImageSelect = useCallback((file: File) => { handleReset(); const src = URL.createObjectURL(file); setImage({ file, src, mimeType: file.type }); }, [handleReset]);
  
  const handleProcessResult = async (newEntry: HistoryEntry) => {
    triggerHapticFeedback([100, 30, 100]); // Success feedback
    try {
        const thumbImageSrc = await createThumbnail(newEntry.imageSrc);
        const thumbMapSrc = newEntry.mapaDistribucionSrc ? await createThumbnail(newEntry.mapaDistribucionSrc) : undefined;
        
        const finalEntry = {
            ...newEntry,
            imageSrc: thumbImageSrc,
            mapaDistribucionSrc: thumbMapSrc,
        };

        setCurrentResult(finalEntry);
        saveHistory([finalEntry, ...history].slice(0, 30));
    } catch (error) {
        console.error("Error creating thumbnails for history:", error);
        // Fallback to saving the original entry
        setCurrentResult(newEntry);
        saveHistory([newEntry, ...history].slice(0, 30));
    }
  };

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> => new Promise((resolve) => { if (!navigator.geolocation) { resolve(null); } navigator.geolocation.getCurrentPosition( (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => resolve(null), { timeout: 10000 } ); });
  
  const processImage = async () => {
    if (!image) return;
    setIsLoading(true); setIsTextSearching(false); setError(null); setCurrentResult(null);
    if (!effectiveApiKey) { setError(t('apiKeyError')); setIsApiKeyModalOpen(true); setIsLoading(false); return; }
    try {
        const base64Image = await fileToBase64(image.file);
        const imageSrcDataUrl = await blobUrlToDataUrl(image.src);
        if (mainMode === 'identify') {
            const location = await getLocation();
            const { plantInfo, sources, mapaDistribucionSrc } = await identifyPlantFromImage(effectiveApiKey, base64Image, image.mimeType, location, language);
            await handleProcessResult({ id: `${Date.now()}-${plantInfo.nombreCientifico}`, timestamp: Date.now(), imageSrc: imageSrcDataUrl, type: 'plant', plantInfo, sources, mapaDistribucionSrc: mapaDistribucionSrc ?? undefined });
        } else {
            const { diseaseInfo, sources } = await diagnosePlantDiseaseFromImage(effectiveApiKey, base64Image, image.mimeType, language);
            await handleProcessResult({ id: `${Date.now()}-${diseaseInfo.nombreEnfermedad}`, timestamp: Date.now(), imageSrc: imageSrcDataUrl, type: 'disease', diseaseInfo, sources });
        }
    } catch (err: any) {
        const errorMessage = err.message || t('unexpectedError'); setError(errorMessage);
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource has been exhausted') || errorMessage.toLowerCase().includes('api key not valid')) { setIsApiKeyModalOpen(true); }
    } finally { setIsLoading(false); setImage(null); }
};

  const handleTextSearch = async (query: string) => {
    handleReset(); 
    setMainMode('identify');
    setIsLoading(true); 
    setIsTextSearching(true);
    if (!effectiveApiKey) { setError(t('apiKeyError')); setIsApiKeyModalOpen(true); setIsLoading(false); return; }
    try {
        const { plantInfo, sources, imageSrc, mapaDistribucionSrc, imageGenerationFailed } = await identifyPlantFromText(effectiveApiKey, query, language);
        const finalImageSrc = imageSrc || createPlaceholderImage(plantInfo.nombreComun);
        await handleProcessResult({ 
            id: `${Date.now()}-${plantInfo.nombreCientifico}`, 
            timestamp: Date.now(), 
            imageSrc: finalImageSrc, 
            type: 'plant', 
            plantInfo, 
            sources, 
            mapaDistribucionSrc: mapaDistribucionSrc ?? undefined,
            imageGenerationFailed: imageGenerationFailed
        });
    } catch (err: any) {
        const errorMessage = err.message || t('unexpectedError');
        setError(errorMessage);
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource has been exhausted') || errorMessage.toLowerCase().includes('api key not valid')) { setIsApiKeyModalOpen(true); }
    } finally { setIsLoading(false); setIsTextSearching(false); }
  };
  
  const handleRemedySearch = async (query: string, useGeo: boolean) => {
    handleReset(); 
    setMainMode('remedy');
    setIsLoading(true); 
    setRemedyQuery(query);
    if (!effectiveApiKey) { setError(t('apiKeyError')); setIsApiKeyModalOpen(true); setIsLoading(false); return; }
    try {
        const location = useGeo ? await getLocation() : null;
        const suggestions = await findPlantsByUsage(effectiveApiKey, query, location, language);
        setSuggestedPlants(suggestions);
    } catch (err: any) {
        const errorMessage = err.message || t('unexpectedError'); setError(errorMessage);
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('api key not valid')) { setIsApiKeyModalOpen(true); }
    } finally { setIsLoading(false); }
  };
  
  const handleGenerateCareGuide = async () => {
    if (!currentResult || !currentResult.plantInfo) return;
    setIsGeneratingCareGuide(true);
    setError(null);
    try {
        const careGuide = await generateCareGuide(effectiveApiKey, currentResult.plantInfo, language);
        triggerHapticFeedback([100, 30, 100]); // Success feedback
        const updatedResult = { ...currentResult, careGuide };
        setCurrentResult(updatedResult);
        // Update history and herbarium with the new data
        const newHistory = history.map(h => h.id === updatedResult.id ? updatedResult : h);
        saveHistory(newHistory);
        const newHerbarium = herbarium.map(h => h.id === updatedResult.id ? updatedResult : h);
        saveHerbarium(newHerbarium);
    } catch (err: any) {
        setError(err.message || t('unexpectedError'));
    } finally {
        setIsGeneratingCareGuide(false);
    }
  };

  const handleViewHistoryItem = (item: HistoryEntry) => { setCurrentResult(item); setIsHistoryOpen(false); setIsHerbariumOpen(false); setView('main'); };
  
  const handleToggleHerbarium = async () => {
      if (!currentResult) return;
      triggerHapticFeedback();
      const exists = herbarium.some(entry => entry.id === currentResult.id);
      if (exists) {
          saveHerbarium(herbarium.filter(entry => entry.id !== currentResult.id));
      } else {
           try {
              const [thumbImageSrc, thumbMapSrc] = await Promise.all([
                  createThumbnail(currentResult.imageSrc),
                  currentResult.mapaDistribucionSrc ? createThumbnail(currentResult.mapaDistribucionSrc) : Promise.resolve(undefined)
              ]);
              const finalEntry = {
                  ...currentResult,
                  imageSrc: thumbImageSrc,
                  mapaDistribucionSrc: thumbMapSrc,
              };
              saveHerbarium([finalEntry, ...herbarium]);
              setNotification(t('savedToHerbarium'));
          } catch (err: any) {
              console.error("Could not create thumbnail for herbarium:", err);
              saveHerbarium([currentResult, ...herbarium]);
              setNotification(t('savedToHerbarium'));
          }
      }
  };

  const handleRemoveFromHerbarium = (id: string) => saveHerbarium(herbarium.filter(entry => entry.id !== id));
  const handleCloseHerbarium = () => { setIsHerbariumOpen(false); setHerbariumNameFilter(''); setHerbariumUseFilter(''); setHerbariumSortOrder('date-desc'); };
  const handleStartCompare = (plantEntry: HistoryEntry) => { setComparisonPlants({ plantA: plantEntry, plantB: null }); setComparisonResult(null); setCurrentResult(null); setError(null); setView('comparator'); setIsHerbariumOpen(false); };
  const filteredAndSortedHerbarium = useMemo(() => {
    return [...herbarium].filter(item => (item.plantInfo?.nombreComun || item.diseaseInfo?.nombreEnfermedad || '').toLowerCase().includes(herbariumNameFilter.toLowerCase()))
      .filter(item => !herbariumUseFilter || (item.type === 'plant' && item.plantInfo?.usosMedicinales.some(uso => uso.toLowerCase().includes(herbariumUseFilter.toLowerCase()))))
      .sort((a, b) => {
        const nameA = a.plantInfo?.nombreComun || a.diseaseInfo?.nombreEnfermedad || ''; const nameB = b.plantInfo?.nombreComun || b.diseaseInfo?.nombreEnfermedad || '';
        switch (herbariumSortOrder) { case 'name-asc': return nameA.localeCompare(nameB); case 'name-desc': return nameB.localeCompare(nameA); case 'date-asc': return a.timestamp - b.timestamp; default: return b.timestamp - a.timestamp; }
      });
  }, [herbarium, herbariumSortOrder, herbariumNameFilter, herbariumUseFilter]);

  const handleExportHerbarium = useCallback(() => {
    if (filteredAndSortedHerbarium.length === 0) { alert("The herbarium is empty or there are no results for the applied filters."); return; }
    const exportData = filteredAndSortedHerbarium.map(entry => {
        let summary = '';
        if (entry.type === 'plant' && entry.plantInfo) {
            summary = `Uses: ${entry.plantInfo.usosMedicinales.join(', ') || 'N/A'}. Toxicity: ${entry.plantInfo.toxicidad.descripcion || 'N/A'}`;
        } else if (entry.type === 'disease' && entry.diseaseInfo) {
            summary = `Symptoms: ${entry.diseaseInfo.sintomas.join(', ') || 'N/A'}`;
        }
        return { 
            type: entry.type, 
            name: entry.plantInfo?.nombreComun || entry.diseaseInfo?.nombreEnfermedad, 
            scientificName: entry.plantInfo?.nombreCientifico || 'N/A', 
            savedDate: new Date(entry.timestamp).toISOString(), 
            summary: summary
        };
    });
    const jsonString = JSON.stringify(exportData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `herbarium_export_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  }, [filteredAndSortedHerbarium]);

    const renderMainView = () => {
        if (isLoading) return <Loader message={t(isTextSearching ? 'textSearchLoading' : 'analyzing')} subMessage={t(isTextSearching ? 'textSearchLoadingSub' : 'loadingMessage')} />;
        if (error) return (
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md w-full">
            <Icon name="cross" className="w-16 h-16 text-red-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">{t('errorTitle')}</h3><p className="text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>
            <button onClick={handleReset} className="mt-6 px-6 py-2 bg-red-600 dark:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">{isApiKeyModalOpen ? t('close') : t('tryAgain')}</button>
        </div>
        );
        if (currentResult) {
            const isInHerbarium = herbarium.some(entry => entry.id === currentResult.id);
            if (currentResult.type === 'plant' && currentResult.plantInfo) return <ResultCard result={currentResult} onReset={handleReset} isInHerbarium={isInHerbarium} onToggleHerbarium={handleToggleHerbarium} onStartCompare={() => handleStartCompare(currentResult)} onGenerateCareGuide={handleGenerateCareGuide} isGeneratingCareGuide={isGeneratingCareGuide} />;
            if (currentResult.type === 'disease' && currentResult.diseaseInfo) return <DiseaseResultCard result={currentResult} onReset={handleReset} isInHerbarium={isInHerbarium} onToggleHerbarium={handleToggleHerbarium} />;
        }
        if (image) return (
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
            <img src={image.src} alt="Selected Plant" className="max-h-64 w-auto mx-auto rounded-lg shadow-md mb-6" /><h3 className="text-xl font-bold text-green-900 dark:text-emerald-200 mb-6">{t('readyToAnalyze')}</h3>
            <div className="flex justify-center gap-4"><button onClick={() => { setImage(null); triggerHapticFeedback(); }} className="px-6 py-3 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold rounded-lg shadow-md border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600">{t('changePhoto')}</button><button onClick={() => { processImage(); triggerHapticFeedback(); }} className="px-6 py-3 bg-green-600 dark:bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 dark:hover:bg-emerald-700">{t('analyze')}</button></div>
        </div>
        );
        if (suggestedPlants) return <SuggestedPlantsList suggestions={suggestedPlants} query={remedyQuery} onSelect={handleTextSearch} onReset={handleReset} />;
        
        const showDiscovery = mainMode === 'discover';

        return (
        <div className="flex flex-col items-center gap-4">
            {showDiscovery ? <DiscoveryView onSelectPlant={handleTextSearch} onSelectCategory={(category) => handleRemedySearch(category, false)} /> : <MainInput onImageSelect={handleImageSelect} isLoading={isLoading} onTextSearch={handleTextSearch} onRemedySearch={handleRemedySearch} onError={setError} mode={mainMode} onModeChange={setMainMode} />}
            
            <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                {history.length > 0 && <button onClick={() => { setIsHistoryOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60"><Icon name="history" className="w-5 h-5" />{t('history')}</button>}
                {herbarium.length > 0 && <button onClick={() => { setIsHerbariumOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60"><Icon name="book" className="w-5 h-5" />{t('myHerbarium')}</button>}
                <button onClick={() => { setIsManualOpen(true); triggerHapticFeedback(); }} className="inline-flex items-center justify-center gap-2 px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors bg-white/60 dark:bg-slate-800/60">
                    <Icon name="help" className="w-5 h-5" />
                    {t('appManual')}
                </button>
            </div>
        </div>
        );
    };

    const renderComparatorView = () => {
        const { plantA, plantB } = comparisonPlants;
        if (!plantA || !plantA.plantInfo) return (<div>Error: source plant not selected.<button onClick={handleReset}>Go Back</button></div>);

        const handleComparisonSearch = async (query: string) => {
            setIsLoading(true); setError(null); setComparisonResult(null);
            try {
                const { plantInfo, sources, imageSrc, mapaDistribucionSrc } = await identifyPlantFromText(effectiveApiKey, query, language);
                const finalImageSrc = imageSrc || createPlaceholderImage(plantInfo.nombreComun);
                setComparisonPlants(prev => ({ ...prev, plantB: { id: `${Date.now()}-${plantInfo.nombreCientifico}`, timestamp: Date.now(), imageSrc: finalImageSrc, type: 'plant', plantInfo, sources, mapaDistribucionSrc: mapaDistribucionSrc ?? undefined } }));
            } catch (err: any) { setError(err.message || 'Could not find the plant to compare.'); } finally { setIsLoading(false); }
        };

        const handleGenerateComparison = async () => {
            if (!comparisonPlants.plantA?.plantInfo || !comparisonPlants.plantB?.plantInfo) return;
            setIsLoading(true); setError(null); setComparisonResult(null);
            try {
                const result = await comparePlants(effectiveApiKey, comparisonPlants.plantA.plantInfo, comparisonPlants.plantB.plantInfo, language);
                setComparisonResult(result);
                triggerHapticFeedback([100, 30, 100]);
            } catch (err: any) { setError(err.message || 'Could not generate the comparison.'); } finally { setIsLoading(false); }
        }

        const getToxicityBadge = (level: string) => {
            const config = {
              None: { text: t('toxicityLevel_None'), color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
              Low: { text: t('toxicityLevel_Low'), color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
              Medium: { text: t('toxicityLevel_Medium'), color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
              High: { text: t('toxicityLevel_High'), color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
              Lethal: { text: t('toxicityLevel_Lethal'), color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
              'N/A': { text: 'N/A', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
            };
            const { text, color } = config[level as keyof typeof config] || config.Low;
            return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${color}`}>{text}</span>;
        };

        return (
            <div className="w-full max-w-5xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden my-8 border border-green-200 dark:border-emerald-800 p-6 sm:p-8">
                <h2 className="text-3xl font-bold text-center text-green-900 dark:text-emerald-200 mb-6">{t('botanicalComparator')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 items-start">
                    <div className="text-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg"><img src={plantA.imageSrc} alt={plantA.plantInfo.nombreComun} className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg" /><h3 className="font-bold text-xl text-green-800 dark:text-emerald-300">{plantA.plantInfo.nombreComun}</h3><p className="text-sm italic text-gray-500 dark:text-slate-400">{plantA.plantInfo.nombreCientifico}</p></div>
                    <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">{comparisonPlants.plantB ? (<div className="text-center"><img src={comparisonPlants.plantB.imageSrc} alt={comparisonPlants.plantB.plantInfo?.nombreComun} className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg" /><h3 className="font-bold text-xl text-green-800 dark:text-emerald-300">{comparisonPlants.plantB.plantInfo?.nombreComun}</h3><p className="text-sm italic text-gray-500 dark:text-slate-400">{comparisonPlants.plantB.plantInfo?.nombreCientifico}</p></div>) : (<div className="text-center"><h3 className="font-bold text-xl mb-4 text-gray-700 dark:text-slate-300">{t('selectPlantB')}</h3><SearchInput onSearch={handleComparisonSearch} isLoading={isLoading} /></div>)}</div>
                </div>
                <div className="text-center mb-8"><button onClick={() => { handleGenerateComparison(); triggerHapticFeedback(); }} disabled={!comparisonPlants.plantB || isLoading} className="px-8 py-4 bg-green-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-transform transform hover:scale-105"><div className="flex items-center gap-3"><Icon name="compare" className="w-6 h-6" /><span>{isLoading && !comparisonResult ? t('generating') : t('generateComparison')}</span></div></button></div>
                {isLoading && !comparisonResult && <Loader message={t('generatingComparison')} subMessage="" />}
                {error && <p className="text-red-500 text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">{error}</p>}
                {comparisonResult && (
                    <div className="space-y-6 mt-8 border-t border-gray-200 dark:border-slate-700 pt-8">
                        <div>
                            <h3 className="text-2xl font-bold mb-4 text-center">{t('comparativeAnalysis')}</h3>
                            <p className="mb-6 bg-green-50 dark:bg-emerald-900/40 p-4 rounded-lg text-gray-700 dark:text-slate-300">{comparisonResult.resumenComparativo}</p>
                        </div>
                        
                        <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="leaf" className="w-5 h-5 text-green-600 dark:text-emerald-500" />{t('medicinalUses')}</h4>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div><h5 className="font-semibold mb-2">{t('similarities')}</h5><ul className="list-disc pl-5 space-y-1">{comparisonResult.usosMedicinales.similitudes.map((s,i) => <li key={i}>{s}</li>) || <li>-</li>}</ul></div>
                                <div><h5 className="font-semibold mb-2">{t('differences')}</h5><ul className="list-disc pl-5 space-y-1">{comparisonResult.usosMedicinales.diferencias.map((d,i) => <li key={i}>{d}</li>) || <li>-</li>}</ul></div>
                            </div>
                        </div>

                        <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="beaker" className="w-5 h-5 text-green-600 dark:text-emerald-500" />{t('principiosActivos')}</h4>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div><h5 className="font-semibold mb-2">{t('compartidos')}</h5><ul className="list-disc pl-5 space-y-1">{comparisonResult.principiosActivos.compartidos.map((s,i) => <li key={i}>{s}</li>) || <li>-</li>}</ul></div>
                                <div>
                                    <h5 className="font-semibold mb-2">{t('unicos')}</h5>
                                    <p className="font-medium">{t('unicosPlantaA', { plantName: plantA.plantInfo.nombreComun })}</p>
                                    <ul className="list-disc pl-5 space-y-1 mb-2">{comparisonResult.principiosActivos.unicos.plantaA.map((d,i) => <li key={i}>{d}</li>) || <li>-</li>}</ul>
                                    <p className="font-medium">{t('unicosPlantaB', { plantName: plantB?.plantInfo?.nombreComun || 'B' })}</p>
                                    <ul className="list-disc pl-5 space-y-1">{comparisonResult.principiosActivos.unicos.plantaB.map((d,i) => <li key={i}>{d}</li>) || <li>-</li>}</ul>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/40">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-amber-900 dark:text-amber-200"><Icon name="cross" className="w-5 h-5" />{t('toxicity')}</h4>
                            <p className="mb-4 text-sm">{comparisonResult.toxicidad.comparacion}</p>
                            <div className="flex justify-around text-center text-sm font-semibold">
                                <div className="flex flex-col items-center gap-1"><span>{plantA.plantInfo.nombreComun}</span>{getToxicityBadge(comparisonResult.toxicidad.nivelPlantaA)}</div>
                                <div className="flex flex-col items-center gap-1"><span>{plantB?.plantInfo?.nombreComun}</span>{getToxicityBadge(comparisonResult.toxicidad.nivelPlantaB)}</div>
                            </div>
                        </div>

                        <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                             <h4 className="font-bold text-lg mb-3 flex items-center gap-2"><Icon name="globe" className="w-5 h-5 text-green-600 dark:text-emerald-500" />{t('diferenciasBotanicas')}</h4>
                             <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div><h5 className="font-semibold mb-2">{t('habitat')}</h5><p>{comparisonResult.diferenciasBotanicas.habitat}</p></div>
                                <div><h5 className="font-semibold mb-2">{t('apariencia')}</h5><p>{comparisonResult.diferenciasBotanicas.apariencia}</p></div>
                             </div>
                        </div>
                    </div>
                )}
                <div className="mt-8 text-center border-t border-gray-200 dark:border-slate-700 pt-6"><button onClick={() => { handleReset(); triggerHapticFeedback(); }} className="px-6 py-2 text-gray-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">{t('backToMainSearch')}</button></div>
            </div>
        );
    }
  
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-emerald-100 via-green-100 to-lime-200 dark:from-slate-800 dark:via-emerald-950 dark:to-green-950 flex flex-col items-center justify-center p-4 overflow-y-auto relative">
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 p-1 rounded-full shadow-md">
            <button onClick={() => { setLanguage('es'); triggerHapticFeedback(); }} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'es' ? 'bg-green-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>ES</button>
            <button onClick={() => { setLanguage('en'); triggerHapticFeedback(); }} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'en' ? 'bg-green-600 text-white' : 'text-gray-700 dark:text-slate-300'}`}>EN</button>
            <div className="w-px h-5 bg-gray-300 dark:bg-slate-600"></div>
            <button onClick={toggleTheme} className="p-2 rounded-full text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label={t('toggleTheme')}>
                <Icon name={theme === 'light' ? 'moon' : 'sun'} className="w-5 h-5" />
            </button>
        </div>
      </div>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleReset} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSelectItem={handleViewHistoryItem} onClearHistory={() => saveHistory([])} />
      <HerbariumModal isOpen={isHerbariumOpen} onClose={handleCloseHerbarium} herbarium={filteredAndSortedHerbarium} onSelectItem={handleViewHistoryItem} onRemoveItem={handleRemoveFromHerbarium} onExport={handleExportHerbarium} sortOrder={herbariumSortOrder} onSortOrderChange={(e) => setHerbariumSortOrder(e.target.value)} nameFilter={herbariumNameFilter} onNameFilterChange={(e) => setHerbariumNameFilter(e.target.value)} useFilter={herbariumUseFilter} onUseFilterChange={(e) => setHerbariumUseFilter(e.target.value)} onStartCompare={handleStartCompare} />
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      {view === 'main' ? renderMainView() : renderComparatorView()}
    </main>
  );
}

export default App;