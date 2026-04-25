// Branding Configuration Service
// Stores and manages global branding settings

export interface BrandConfig {
    name: string;
    tagline: string;
    primaryColor: string;
    logoUrl: string;
}

const BRAND_CONFIG_KEY = 'fotosnaps_brand_config';

const DEFAULT_BRAND: BrandConfig = {
    name: 'Fotosnaps',
    tagline: 'Loyalty Rewards Platform',
    primaryColor: '#7c3aed',
    logoUrl: '/Logo fotosnaps.png' // Fotosnaps logo
};

// Get current brand configuration
export const getBrandConfig = (): BrandConfig => {
    try {
        const stored = localStorage.getItem(BRAND_CONFIG_KEY);
        if (stored) {
            const config = JSON.parse(stored);
            // Force update to the new local PNG logo if the old path or data URI is present
            // No forced override — allow any custom logo URL
            return config;
        }
    } catch (e) {
        console.error('Failed to load brand config:', e);
    }
    return DEFAULT_BRAND;
};

// Save brand configuration
export const saveBrandConfig = (config: BrandConfig): void => {
    try {
        localStorage.setItem(BRAND_CONFIG_KEY, JSON.stringify(config));
        // Dispatch event to notify all components
        window.dispatchEvent(new CustomEvent('brandConfigChanged', { detail: config }));
    } catch (e) {
        console.error('Failed to save brand config:', e);
    }
};

// Reset to default branding
export const resetBrandConfig = (): void => {
    saveBrandConfig(DEFAULT_BRAND);
};

// Apply brand color to CSS variables
export const applyBrandColors = (primaryColor: string): void => {
    const root = document.documentElement;

    // Convert hex to RGB for opacity variants
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Set CSS custom properties
    root.style.setProperty('--brand-primary', primaryColor);
    root.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${b}`);

    // Generate lighter and darker variants
    root.style.setProperty('--brand-50', `rgba(${r}, ${g}, ${b}, 0.05)`);
    root.style.setProperty('--brand-100', `rgba(${r}, ${g}, ${b}, 0.1)`);
    root.style.setProperty('--brand-200', `rgba(${r}, ${g}, ${b}, 0.2)`);
    root.style.setProperty('--brand-400', `rgba(${r}, ${g}, ${b}, 0.8)`);
    root.style.setProperty('--brand-500', primaryColor);
    root.style.setProperty('--brand-600', adjustBrightness(primaryColor, -20));
    root.style.setProperty('--brand-800', adjustBrightness(primaryColor, -40));
    root.style.setProperty('--brand-900', adjustBrightness(primaryColor, -60));
};

// Helper function to adjust color brightness
function adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// Initialize branding on app load
export const initializeBranding = (): void => {
    const config = getBrandConfig();
    applyBrandColors(config.primaryColor);
};
