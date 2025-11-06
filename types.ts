

export interface Preparation {
  nombre: string;
  ingredientes: string[];
  instrucciones: string;
  dosis: string;
  efectosSecundarios: string;
  contextoHistorico: string;
}

export interface SimilarPlant {
  nombreComun: string;
  nombreCientifico: string;
  diferenciaClave: string;
}

export interface SimilarActivePlant {
  nombreComun: string;
  nombreCientifico: string;
  principioActivoCompartido: string;
}

export interface PlantInfo {
  nombreComun: string;
  nombreCientifico: string;
  sinonimos: string[];
  descripcionGeneral: string;
  habitat: string;
  distribucionGeografica: string;
  floweringSeason: string;
  conservationStatus: string;
  usosMedicinales: string[];
  usosCulinarios: string[];
  principiosActivos: string[];
  toxicidad: string;
  preparaciones: Preparation[];
  plantasSimilares: SimilarPlant[];
  plantasConPrincipiosActivosSimilares: SimilarActivePlant[];
}

export interface DiseaseInfo {
  nombreEnfermedad: string;
  plantaAfectada: string[];
  sintomas: string[];
  causas: string[];
  tratamientoOrganico: string[];
  tratamientoQuimico: string[];
  prevencion: string[];
}

export interface CareGuideInfo {
    riego: { frecuencia: string; metodo: string; consejo: string };
    luz: { nivel: string; ubicacion: string; consejo: string };
    suelo: { tipo: string; drenaje: string; consejo: string };
    temperaturaHumedad: { temperatura: string; humedad: string; consejo: string };
    fertilizacion: { frecuencia: string; tipo: string; consejo: string };
    podaPestes: { poda: string; pestesComunes: string; consejo: string };
    trasplante: { frecuencia: string; instrucciones: string; consejo: string };
    propagacion: { metodos: string; instrucciones: string; consejo: string };
    consejosAdicionales: { purificacionAire: string; seguridadMascotas: string; datoCurioso: string };
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  imageSrc: string; // Stored as a data URL for persistence
  type: 'plant' | 'disease';
  plantInfo?: PlantInfo;
  diseaseInfo?: DiseaseInfo;
  sources: GroundingSource[];
  mapaDistribucionSrc?: string; // Optional data URL for the map
  careGuide?: CareGuideInfo; // Optional care guide
}

export interface ComparisonInfo {
  resumenComparativo: string;
  usosMedicinales: {
    similitudes: string[];
    diferencias: string[];
  };
  principiosActivos: {
    compartidos: string[];
    unicos: {
      plantaA: string[];
      plantaB: string[];
    };
  };
  toxicidad: {
    comparacion: string;
    nivelPlantaA: string;
    nivelPlantaB: string;
  };
  diferenciasBotanicas: {
    habitat: string;
    apariencia: string;
  };
}

export interface SuggestedPlant {
  nombreComun: string;
  relevancia: string;
}