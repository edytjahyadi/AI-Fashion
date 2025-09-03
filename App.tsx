
import React, { useReducer, ChangeEvent, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createVirtualTryOnImage } from './services/geminiService';
import ImageFrame from './components/PolaroidCard';
import Footer from './components/Footer';
import { GeneratedImage } from './types';
import { Shirt, User, Sparkles } from 'lucide-react';

const POSE_PROMPTS = [
    'A relaxed standing pose, hands in pockets, slightly turned to the side, with a confident smile.',
    'A dynamic walking pose as if on a catwalk, one leg in front of the other.',
    'Sitting on a minimalist studio chair, one leg crossed over the other, looking directly at the camera.',
    'A close-up pose from the waist up, shoulders slightly angled, highlighting the clothing details.',
];

const primaryButtonStyles = "font-bold text-lg uppercase tracking-wider text-center text-black bg-teal-400 py-3 px-8 rounded-sm transform transition-all duration-300 hover:scale-105 hover:-rotate-3 hover:bg-teal-300 shadow-[3px_3px_0px_1px_rgba(0,0,0,0.2)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:hover:bg-teal-400";
const secondaryButtonStyles = "font-bold text-lg uppercase tracking-wider text-center text-white bg-transparent border-2 border-white/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";

type AppState = {
    appStatus: 'idle' | 'sources_ready' | 'processing' | 'results_ready';
    sourceModelImage: string | null;
    sourceClothingImage: string | null;
    imageResults: GeneratedImage[];
};

type AppAction =
    | { type: 'UPLOAD_IMAGE'; payload: { index: 0 | 1; dataUrl: string } }
    | { type: 'START_PROCESSING' }
    | { type: 'UPDATE_RESULT'; payload: { index: number; result: GeneratedImage } }
    | { type: 'FINISH_PROCESSING' }
    | { type: 'RESET' };

const initialState: AppState = {
    appStatus: 'idle',
    sourceModelImage: null,
    sourceClothingImage: null,
    imageResults: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'UPLOAD_IMAGE':
            const newState = {
                ...state,
                sourceModelImage: action.payload.index === 0 ? action.payload.dataUrl : state.sourceModelImage,
                sourceClothingImage: action.payload.index === 1 ? action.payload.dataUrl : state.sourceClothingImage,
            };
            if (newState.sourceModelImage && newState.sourceClothingImage) {
                return { ...newState, appStatus: 'sources_ready', imageResults: [] };
            }
            return newState;
        case 'START_PROCESSING':
            return {
                ...state,
                appStatus: 'processing',
                imageResults: POSE_PROMPTS.map(() => ({ status: 'pending' })),
            };
        case 'UPDATE_RESULT':
            const newResults = [...state.imageResults];
            newResults[action.payload.index] = action.payload.result;
            return { ...state, imageResults: newResults };
        case 'FINISH_PROCESSING':
             const allDone = state.imageResults.every(img => img.status === 'done' || img.status === 'error');
             if(allDone){
                return { ...state, appStatus: 'results_ready' };
             }
             return state;
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

/**
 * Adds a watermark to an image using the Canvas API.
 * @param imageUrl The base64 data URL of the image.
 * @returns A promise that resolves with the new base64 data URL of the watermarked image.
 */
const addWatermark = (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Add watermark
            const watermarkText = 'MA';
            const fontSize = Math.max(24, canvas.width * 0.04); // Responsive font size
            ctx.font = `700 ${fontSize}px Montserrat`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // Subtle white
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            const padding = canvas.width * 0.03; // Responsive padding
            ctx.fillText(watermarkText, canvas.width - padding, canvas.height - padding);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for watermarking'));
        };
        img.src = imageUrl;
    });
};


function App() {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { appStatus, sourceModelImage, sourceClothingImage, imageResults } = state;
    
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, index: 0 | 1) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => dispatch({ type: 'UPLOAD_IMAGE', payload: { index, dataUrl: reader.result as string } });
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const processImages = useCallback(async () => {
        if (!sourceModelImage || !sourceClothingImage) return;

        dispatch({ type: 'START_PROCESSING' });

        const promises = POSE_PROMPTS.map((prompt, index) =>
            createVirtualTryOnImage(sourceModelImage, sourceClothingImage, prompt)
                .then(addWatermark)
                .then(url => dispatch({ type: 'UPDATE_RESULT', payload: { index, result: { status: 'done', url } } }))
                .catch(err => {
                    const error = err instanceof Error ? err.message : "An unknown error occurred.";
                    dispatch({ type: 'UPDATE_RESULT', payload: { index, result: { status: 'error', error } } });
                })
        );
        
        await Promise.allSettled(promises);
        dispatch({ type: 'FINISH_PROCESSING' });
    }, [sourceModelImage, sourceClothingImage]);

    const regenerateImage = useCallback(async (index: number) => {
        if (!sourceModelImage || !sourceClothingImage || imageResults[index]?.status === 'pending') return;

        dispatch({ type: 'UPDATE_RESULT', payload: { index, result: { status: 'pending' } } });
        
        try {
            const baseUrl = await createVirtualTryOnImage(sourceModelImage, sourceClothingImage, POSE_PROMPTS[index]);
            const watermarkedUrl = await addWatermark(baseUrl);
            dispatch({ type: 'UPDATE_RESULT', payload: { index, result: { status: 'done', url: watermarkedUrl } } });
        } catch (err)
 {
            const error = err instanceof Error ? err.message : "An unknown error occurred.";
            dispatch({ type: 'UPDATE_RESULT', payload: { index, result: { status: 'error', error } } });
        }
    }, [sourceModelImage, sourceClothingImage, imageResults]);

    const downloadImage = (index: number) => {
        const image = imageResults[index];
        if (image.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `fashion-studio-pose-${index + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const downloadAllImages = () => {
        imageResults.forEach((image, index) => {
            if (image.status === 'done' && image.url) {
                // We add a small delay between downloads to prevent browser blocking
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = image.url;
                    link.download = `fashion-studio-pose-${index + 1}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, index * 300);
            }
        });
    };
    
    const UploadInterface = () => (
         <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
        >
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                <div className="flex flex-col items-center gap-2">
                    <label htmlFor="model-upload" className="cursor-pointer">
                        <ImageFrame status={sourceModelImage ? 'done' : 'placeholder'} imageUrl={sourceModelImage} caption="Model" placeholderIcon={<User size={48} />} isMobile />
                    </label>
                    <input id="model-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 0)} />
                    <p className="font-semibold text-neutral-400">Upload Your Photo</p>
                </div>
                <div className="text-4xl font-black text-teal-400 my-2 md:my-0 md:mx-4">&</div>
                 <div className="flex flex-col items-center gap-2">
                    <label htmlFor="clothing-upload" className="cursor-pointer">
                         <ImageFrame status={sourceClothingImage ? 'done' : 'placeholder'} imageUrl={sourceClothingImage} caption="Pakaian" placeholderIcon={<Shirt size={48} />} isMobile />
                    </label>
                    <input id="clothing-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 1)} />
                    <p className="font-semibold text-neutral-400">Upload Pakaian</p>
                </div>
            </div>
             {appStatus === 'sources_ready' && (
                 <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 mt-8">
                    <button onClick={() => dispatch({ type: 'RESET' })} className={secondaryButtonStyles}>Change Photos</button>
                    <button onClick={processImages} className={primaryButtonStyles}>Generate Style</button>
                 </motion.div>
             )}
             {appStatus === 'idle' && (
                  <p className="mt-8 font-semibold text-neutral-500 text-center max-w-md text-lg">
                    Select a photo of yourself and a fashion item to start your virtual photoshoot.
                  </p>
             )}
        </motion.div>
    );

    const ResultsDisplay = () => (
         <div className="flex flex-col items-center w-full">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-4">
                 {imageResults.map((image, index) => (
                    <motion.div 
                        key={index}
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="flex justify-center"
                    >
                        <ImageFrame
                            caption={`Pose #${index + 1}`}
                            status={image.status}
                            imageUrl={image.url}
                            error={image.error}
                            onRegenerate={() => regenerateImage(index)}
                            onDownload={() => downloadImage(index)}
                            isMobile
                            frameless
                        />
                     </motion.div>
                 ))}
             </div>
              <div className="h-20 mt-4 flex items-center justify-center">
                 {appStatus === 'processing' && (
                     <p className="font-bold text-teal-400 text-2xl flex items-center gap-3">
                        <Sparkles className="animate-pulse" />
                        AI is running the photoshoot...
                     </p>
                 )}
                 {appStatus === 'results_ready' && (
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-4"
                     >
                        <button onClick={() => dispatch({ type: 'RESET' })} className={secondaryButtonStyles}>
                            Start Over
                        </button>
                        <button onClick={downloadAllImages} className={primaryButtonStyles}>
                            Download All
                        </button>
                    </motion.div>
                 )}
             </div>
         </div>
     );

    return (
        <main className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-24 overflow-auto relative">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.03]"></div>
            
            <div className="z-10 flex flex-col items-center justify-center w-full h-full flex-1 min-h-0 pt-20">
                <div className="text-center mb-10">
                    <h1 className="text-5xl md:text-7xl font-black text-neutral-100 uppercase tracking-wider">AI Fashion Studio</h1>
                    <p className="text-neutral-400 text-xl tracking-wider mt-2">by Must Aziz</p>
                    <p className="text-neutral-300 mt-4 text-xl tracking-wide font-bold">4 Different Poses. 1 Virtual Studio.</p>
                </div>

                <AnimatePresence mode="wait">
                    {appStatus === 'processing' || appStatus === 'results_ready' ? (
                        <ResultsDisplay key="results" />
                    ) : (
                        <UploadInterface key="upload" />
                    )}
                </AnimatePresence>
            </div>
            <Footer />
        </main>
    );
}

export default App;