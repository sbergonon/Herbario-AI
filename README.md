# AI Herbarium

AI Herbarium is a modern, mobile-first web application designed for plant enthusiasts. It leverages the power of Google's Gemini AI to identify plants from photos, diagnose diseases, and provide a wealth of information about their uses, properties, and care.

## Key Features

- **Multi-Modal Plant Identification**: Identify plants instantly by taking a photo, uploading an image, or searching by name. The app considers geolocation to improve accuracy with local flora.
- **Plant Disease Diagnosis**: Snap a photo of a sick plant, and the AI will diagnose potential diseases, pests, or nutritional deficiencies, offering organic and chemical treatment options.
- **Remedy Finder**: Search for plants based on symptoms or traditional uses (e.g., "headache relief"). The search can prioritize plants native to your current location.
- **Detailed Plant Profiles**: Get comprehensive information for each identified plant, including:
  - **Botanical Data**: Scientific name, synonyms, description, habitat, and conservation status.
  - **Uses**: Detailed medicinal and culinary applications.
  - **Science**: Key active compounds and toxicity warnings.
  - **Practical Guides**: Traditional preparation recipes with instructions, dosage, and historical context.
  - **Safety**: Clear comparisons with similar-looking toxic plants to avoid confusion.
  - **Distribution Map**: An AI-generated map showing the plant's native and naturalized regions.
- **Comprehensive AI-Generated Care Guides**: Go beyond identification. Generate detailed guides covering:
    - Watering, Light, Soil, Temperature, Fertilization, and Pest Control.
    - **Repotting**: Learn when and how to give your plant a new home.
    - **Propagation**: Simple instructions to multiply your plants.
    - **Bonus Insights**: Discover if your plant purifies the air, if it's safe for pets, and other fun facts.
- **Botanical Comparator**: A unique tool to compare two different plants side-by-side, analyzing their medicinal uses, active compounds, and toxicity levels.
- **Personal Herbarium**: Save your favorite or most relevant findings to a personal, filterable, and sortable collection. You can also export your herbarium data to a JSON file.
- **Session History**: Automatically saves your recent queries for quick access.
- **Bilingual Interface**: Fully available in both English and Spanish.

## How to Use

1.  **Select a Mode**: Choose between `Identify`, `Diagnose`, or `Remedy`.
2.  **Provide Input**:
    - For **Identify**: Take a photo, upload an image, or type the plant's name.
    - For **Diagnose**: Upload a photo of the affected plant.
    - For **Remedy**: Type a symptom or use and optionally enable geolocation for local results.
3.  **Analyze**: The AI will process your request and return a detailed information card.
4.  **Explore**: Navigate through the different sections of the result.
5.  **Generate Care Guide**: If you identified a plant, click the "Generate Care Guide" button to get tailored instructions.
6.  **Save & Compare**: Save the plant to your personal Herbarium or use the Compare tool to analyze it against another plant.

## Technology Stack

- **Frontend**: React (with Hooks)
- **AI**: Google Gemini API (`gemini-2.5-flash` for analysis, `imagen-4.0-generate-001` for image generation)
- **Styling**: Tailwind CSS
- **Deployment**: Runs directly in the browser using ES modules and an import map.

## Disclaimer

This application is intended for educational and informational purposes only. It is not a substitute for professional medical, veterinary, or botanical advice. Always consult with a qualified expert before consuming any plant or applying any treatment. AI-based identification may not be 100% accurate.