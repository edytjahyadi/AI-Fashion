
import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="absolute bottom-4 left-0 w-full z-20 flex justify-center items-center">
            <p className="text-sm text-neutral-500 bg-black/30 backdrop-blur-sm px-4 py-2 rounded">
                Powered by Google Gemini | Created by Must Aziz
            </p>
        </footer>
    );
};

export default Footer;