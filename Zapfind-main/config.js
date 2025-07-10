// API Configuration for ZapFind
window.API_CONFIG = {
    getBaseURL: () => {
        // Check if we're in production (on Vercel)
        if (window.location.hostname.includes('vercel.app') || 
            window.location.hostname === 'zapfind.vercel.app') {
            return window.location.origin;
        }
        // Development environment
        return 'http://localhost:4000';
    },
    
    getFirebaseConfigURL: () => {
        return `${window.API_CONFIG.getBaseURL()}/firebase-config`;
    },
    
    getAPIURL: () => {
        if (window.location.hostname.includes('vercel.app') || 
            window.location.hostname === 'zapfind.vercel.app') {
            return `${window.location.origin}/api`;
        }
        return 'http://localhost:4000/api';
    }
};
