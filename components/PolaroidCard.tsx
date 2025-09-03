import React, { RefObject, memo } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ImageStatus } from '../types';
import { RefreshCw, Download, AlertTriangle, ImageIcon } from 'lucide-react';

interface ImageFrameProps {
    caption: string;
    status: ImageStatus;
    imageUrl?: string | null;
    error?: string;
    placeholderIcon?: React.ReactNode;
    onRegenerate?: () => void;
    onDownload?: () => void;
    dragConstraintsRef?: RefObject<HTMLDivElement>;
    isMobile?: boolean;
    frameless?: boolean;
}

const LoadingIndicator = memo(() => (
    <div className="flex flex-col items-center justify-center h-full">
        <motion.div
            className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ ease: 'linear', duration: 0.8, repeat: Infinity }}
        />
    </div>
));

const ErrorDisplay = memo(({ error }: { error?: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
        <p className="font-bold text-sm text-red-400">Failed</p>
        <p className="text-xs text-neutral-500 mt-1 line-clamp-3">{error || 'Could not generate the image.'}</p>
    </div>
));

const ImageDisplay = memo(({ imageUrl, caption }: { imageUrl: string, caption: string }) => (
    <img src={imageUrl} alt={caption} className="w-full h-full object-cover" />
));

const Placeholder = memo(({ icon }: { icon?: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-full text-neutral-500 group-hover:text-teal-400 transition-colors duration-300">
        {icon || <ImageIcon size={48} />}
    </div>
));

const ImageFrame: React.FC<ImageFrameProps> = ({
    caption,
    status,
    imageUrl,
    error,
    placeholderIcon,
    onRegenerate,
    onDownload,
    dragConstraintsRef,
    isMobile = false,
    frameless = false,
}) => {
    const controls = useAnimation();

    const handleRegenerate = () => {
        if (!onRegenerate) return;
        controls.start({
            rotate: [0, 15, -15, 15, 0],
            transition: { duration: 0.4 },
        }).then(onRegenerate);
    };
    
    const cardContent = () => {
        switch (status) {
            case 'pending': return <LoadingIndicator />;
            case 'done': return imageUrl ? <ImageDisplay imageUrl={imageUrl} caption={caption} /> : <Placeholder icon={placeholderIcon}/>;
            case 'error': return <ErrorDisplay error={error} />;
            case 'placeholder': return <Placeholder icon={placeholderIcon}/>;
            default: return null;
        }
    };
    
    const frame = (
        <motion.div
            className={frameless 
                ? "w-64 md:w-72 relative select-none group"
                : "w-64 md:w-72 bg-neutral-100 p-3 pb-16 md:p-4 md:pb-20 rounded-lg shadow-xl relative select-none group cursor-grab active:cursor-grabbing"
            }
            animate={controls}
            drag={!isMobile && !frameless && !!dragConstraintsRef}
            dragConstraints={dragConstraintsRef}
            dragElastic={0.1}
            whileHover={{ y: -8, scale: 1.03 }}
            whileTap={{ scale: 0.98, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
            <div className={frameless 
                ? "w-full aspect-[3/4] bg-neutral-800 overflow-hidden shadow-lg rounded-lg"
                : "w-full aspect-[3/4] bg-neutral-800 overflow-hidden shadow-inner rounded-sm"
            }>
                {cardContent()}
            </div>
             {frameless ? (
                <p className="font-bold text-xl md:text-2xl text-white absolute bottom-2 left-3 right-3 truncate bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{caption}</p>
            ) : (
                <p className="font-bold text-2xl md:text-3xl text-black absolute bottom-4 left-4 right-4 truncate">{caption}</p>
            )}
            
            {(status === 'done' || status === 'error') && (onRegenerate || onDownload) && (
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    {onRegenerate && (
                        <motion.button whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={handleRegenerate} className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-blue-500 transition-colors">
                            <RefreshCw size={18} />
                        </motion.button>
                    )}
                    {status === 'done' && onDownload && (
                         <motion.button whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={onDownload} className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-green-500 transition-colors">
                            <Download size={18} />
                        </motion.button>
                    )}
                </div>
            )}
        </motion.div>
    );

    return isMobile ? <div>{frame}</div> : frame;
};

export default ImageFrame;