import React, { useState, useEffect } from 'react';
import { Palette, Type, Image as ImageIcon, RotateCcw, Save, X } from 'lucide-react';
import { getBrandConfig, saveBrandConfig, resetBrandConfig, applyBrandColors, BrandConfig } from '../services/branding';

interface BrandSettingsProps {
    onClose: () => void;
}

export const BrandSettings: React.FC<BrandSettingsProps> = ({ onClose }) => {
    const [config, setConfig] = useState<BrandConfig>(getBrandConfig());
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        saveBrandConfig(config);
        applyBrandColors(config.primaryColor);

        // Update page title
        document.title = `${config.name} - ${config.tagline}`;

        setTimeout(() => {
            setIsSaving(false);
            onClose();
            // Reload to apply changes throughout the app
            window.location.reload();
        }, 500);
    };

    const handleReset = () => {
        if (confirm('Reset to default branding? This will reload the page.')) {
            resetBrandConfig();
            window.location.reload();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 fade-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                            <Palette size={20} className="text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Brand Settings</h2>
                            <p className="text-xs text-gray-500 font-medium">Customize your loyalty program</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Brand Name */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            <Type size={16} className="text-gray-500" />
                            Brand Name
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => setConfig({ ...config, name: e.target.value })}
                            placeholder="Fotosnaps"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-600 focus:ring-4 focus:ring-brand-50 outline-none transition-all font-bold text-lg"
                        />
                    </div>

                    {/* Tagline */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            <Type size={16} className="text-gray-500" />
                            Tagline
                        </label>
                        <input
                            type="text"
                            value={config.tagline}
                            onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                            placeholder="Member Check-In"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-600 focus:ring-4 focus:ring-brand-50 outline-none transition-all font-medium"
                        />
                    </div>

                    {/* Primary Color */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            <Palette size={16} className="text-gray-500" />
                            Primary Color
                        </label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="color"
                                    value={config.primaryColor}
                                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div
                                    className="w-full h-14 rounded-xl border-2 border-gray-300 cursor-pointer transition-all hover:scale-105"
                                    style={{ backgroundColor: config.primaryColor }}
                                />
                            </div>
                            <input
                                type="text"
                                value={config.primaryColor}
                                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                                placeholder="#7c3aed"
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-600 focus:ring-4 focus:ring-brand-50 outline-none transition-all font-mono font-bold uppercase"
                            />
                        </div>
                        <p className="text-xs text-gray-500">Click the color box or enter a hex code</p>
                    </div>

                    {/* Logo URL */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            <ImageIcon size={16} className="text-gray-500" />
                            Logo URL (Optional)
                        </label>
                        <input
                            type="url"
                            value={config.logoUrl}
                            onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                            placeholder="https://example.com/logo.png"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-brand-600 focus:ring-4 focus:ring-brand-50 outline-none transition-all font-medium"
                        />
                        <p className="text-xs text-gray-500">Leave empty to use text-based logo</p>

                        {config.logoUrl && (
                            <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 mb-2">Preview:</p>
                                <img
                                    src={config.logoUrl}
                                    alt="Logo preview"
                                    className="h-12 object-contain"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Preview</p>
                        <div className="bg-white rounded-xl p-6 text-center">
                            {config.logoUrl ? (
                                <img src={config.logoUrl} alt={config.name} className="h-12 mx-auto mb-3 object-contain" />
                            ) : (
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-black text-2xl"
                                    style={{ backgroundColor: config.primaryColor }}
                                >
                                    {config.name.charAt(0)}
                                </div>
                            )}
                            <h3 className="text-2xl font-black text-gray-900">{config.name}</h3>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">{config.tagline}</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={18} />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: config.primaryColor }}
                    >
                        <Save size={18} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
