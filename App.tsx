import React, { useState, useEffect, useRef } from 'react';
import { Upload, Sliders, Download, Layers, Image as ImageIcon, Trash2, RefreshCcw, Settings, Zap, Plus, FileDown, FileImage, FlipHorizontal, Grid3X3, Ruler, Instagram, Cat } from 'lucide-react';
import { StencilMode, StencilSettings, ProcessedImage } from './types';
import { generateStencil, loadImage } from './utils/imageProcessor';
import GeminiAdvisor from './components/GeminiAdvisor';
import jsPDF from 'jspdf';

const DEFAULT_SETTINGS: StencilSettings = {
  threshold: 223,
  thickness: 0,
  noiseReduction: 0,
  mode: StencilMode.HOLLOW,
  isMirrored: false,
  isMultipleSizes: false,
  variantCount: 9,
  minSize: 1.5,
  maxSize: 3.5,
  showDimensions: true
};

const App: React.FC = () => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState<StencilSettings>(DEFAULT_SETTINGS);
  const [useGlobalSettings, setUseGlobalSettings] = useState(true);

  const processingTimeoutRef = useRef<number | null>(null);
  const selectedImage = images.find(img => img.id === selectedId);

  const currentSettings = useGlobalSettings
    ? globalSettings
    : (selectedImage?.settings || DEFAULT_SETTINGS);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newImages: ProcessedImage[] = [];

      for (let i = 0; i < event.target.files.length; i++) {
        const file = event.target.files[i];
        const reader = new FileReader();

        const promise = new Promise<void>((resolve) => {
          reader.onload = (e) => {
            const id = Math.random().toString(36).substr(2, 9);
            newImages.push({
              id,
              originalUrl: e.target?.result as string,
              processedUrl: null,
              name: file.name,
              settings: { ...DEFAULT_SETTINGS },
              isProcessing: false,
              fileType: file.type
            });
            resolve();
          };
          reader.readAsDataURL(file);
        });
        await promise;
      }

      setImages(prev => [...prev, ...newImages]);
      if (!selectedId && newImages.length > 0) {
        setSelectedId(newImages[0].id);
      }
    }
  };

  const processImages = async (targetImages: ProcessedImage[], settingsToUse: StencilSettings) => {
    setImages(prev => prev.map(img =>
      targetImages.find(t => t.id === img.id)
        ? { ...img, isProcessing: true }
        : img
    ));

    const updated = await Promise.all(targetImages.map(async (img) => {
      try {
        const htmlImg = await loadImage(img.originalUrl);
        const processed = await generateStencil(htmlImg, settingsToUse);
        return {
          ...img,
          processedUrl: processed,
          settings: settingsToUse,
          isProcessing: false
        };
      } catch (e) {
        console.error("Processing failed", e);
        return { ...img, isProcessing: false };
      }
    }));

    setImages(prev => prev.map(img => {
      const update = updated.find(u => u.id === img.id);
      return update || img;
    }));
  };

  useEffect(() => {
    const unprocessed = images.filter(img => !img.processedUrl && !img.isProcessing);
    if (unprocessed.length > 0) {
      const settings = useGlobalSettings ? globalSettings : DEFAULT_SETTINGS;
      processImages(unprocessed, settings);
    }
  }, [images.length]);

  const updateSettingsAndProcess = (newSettings: StencilSettings) => {
    if (useGlobalSettings) {
      setGlobalSettings(newSettings);
    } else if (selectedId) {
      setImages(prev => prev.map(img => img.id === selectedId ? { ...img, settings: newSettings } : img));
    }

    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);

    processingTimeoutRef.current = window.setTimeout(() => {
      if (useGlobalSettings) {
        processImages(images, newSettings);
      } else if (selectedId) {
        const target = images.find(i => i.id === selectedId);
        if (target) processImages([target], newSettings);
      }
    }, 300);
  };

  const handleSettingChange = (key: keyof StencilSettings, value: any) => {
    const newSettings = { ...currentSettings, [key]: value };
    updateSettingsAndProcess(newSettings);
  };

  const applyPreset = (preset: 'fineline' | 'bold') => {
    let presetValues: Partial<StencilSettings> = {};
    if (preset === 'fineline') {
      presetValues = { threshold: 223, noiseReduction: 0, thickness: 0 };
    } else if (preset === 'bold') {
      presetValues = { threshold: 238, noiseReduction: 3, thickness: 1 };
    }

    const newSettings = { ...currentSettings, ...presetValues };
    updateSettingsAndProcess(newSettings);
  };

  const handleDownload = (img: ProcessedImage, format: 'png' | 'jpg' | 'pdf') => {
    if (!img.processedUrl) return;

    const link = document.createElement('a');
    if (format === 'pdf') {
      const pdf = new jsPDF();
      const imgProps = pdf.getImageProperties(img.processedUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(img.processedUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${img.name.split('.')[0]}_stencil.pdf`);
    } else {
      link.href = img.processedUrl;
      link.download = `${img.name.split('.')[0]}_stencil.${format}`;
      link.click();
    }
  };

  const handleBatchDownload = async () => {
    for (const img of images) {
      if (img.processedUrl) {
        handleDownload(img, 'jpg');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  const sizeOptions = [];
  for (let i = 0.5; i <= 9; i += 0.5) {
    sizeOptions.push(i);
  }

  return (
    <div className="flex flex-col h-screen bg-[#fdfaff] text-slate-700 overflow-hidden font-inter selection:bg-pink-200 selection:text-pink-900">
      {/* Header */}
      <header className="h-16 border-b border-purple-50 bg-white/80 backdrop-blur-md flex items-center px-6 shrink-0 z-10 shadow-sm justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 tracking-tight font-[Fredoka] drop-shadow-sm animate-float cursor-default select-none">
            ooo.cooki stencil lab
          </h1>

          {/* Hidden SVG for gradient definition */}
          <svg width="0" height="0" className="absolute w-0 h-0 pointer-events-none">
            <defs>
              <linearGradient id="cat-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f472b6" /> {/* pink-400 */}
                <stop offset="50%" stopColor="#c084fc" /> {/* purple-400 */}
                <stop offset="100%" stopColor="#22d3ee" /> {/* cyan-400 */}
              </linearGradient>
            </defs>
          </svg>

          {/* Animated Cat Icon with Gradient Stroke */}
          <Cat
            className="w-5 h-5 animate-wiggle cursor-default opacity-90"
            style={{ stroke: "url(#cat-gradient)" }}
          />

          <a
            href="https://www.instagram.com/ooo.cooki"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 p-1.5 text-pink-300 hover:text-pink-500 hover:bg-pink-50 rounded-full transition-all duration-300 hover:scale-110 hover:rotate-12 transform"
          >
            <Instagram className="w-5 h-5" />
          </a>
        </div>

        {/* Right side text */}
        <div className="text-[10px] font-bold text-purple-200 tracking-widest uppercase font-[Fredoka] select-none hover:text-purple-300 transition-colors cursor-default">
          designed by ooo.cooki
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Sidebar - Image List */}
        {images.length > 0 && (
          <aside className="w-full h-auto max-h-48 border-b order-1 overflow-x-auto lg:h-auto lg:max-h-none lg:w-64 lg:bg-white/60 lg:border-r lg:border-b-0 border-purple-100 flex flex-row lg:flex-col shrink-0 transition-all z-20 backdrop-blur-sm">
            <div className="p-4 border-r lg:border-r-0 lg:border-b border-purple-100 min-w-[140px] sticky left-0 bg-white/80 lg:bg-transparent backdrop-blur-sm lg:backdrop-filter-none z-10 flex flex-col justify-center lg:block shadow-sm lg:shadow-none">
              <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1 lg:mb-3 font-[Fredoka]">Your Designs</h2>
              <button
                onClick={handleBatchDownload}
                disabled={images.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs py-2 lg:py-2.5 rounded-xl border border-purple-200 disabled:opacity-50 transition-colors font-bold shadow-sm whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Download All JPG</span><span className="sm:hidden">Save All</span>
              </button>
            </div>

            <div className="flex-1 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto p-2 flex lg:block gap-2 items-center lg:space-y-2">
              {images.map(img => (
                <div
                  key={img.id}
                  onClick={() => setSelectedId(img.id)}
                  className={`group flex flex-col lg:flex-row items-center gap-2 lg:gap-3 p-2 rounded-xl cursor-pointer transition-all border min-w-[80px] lg:min-w-0 ${selectedId === img.id
                    ? 'bg-white border-pink-300 shadow-[0_4px_12px_rgba(236,72,153,0.15)] ring-1 ring-pink-100'
                    : 'hover:bg-white/80 border-transparent hover:border-purple-100 bg-white/40'
                    }`}
                >
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-100 rounded-lg overflow-hidden shrink-0 relative border border-slate-200">
                    <img src={img.originalUrl} className="w-full h-full object-cover" alt="" />
                    {img.isProcessing && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
                        <RefreshCcw className="w-4 h-4 lg:w-5 lg:h-5 animate-spin text-pink-400" />
                      </div>
                    )}
                  </div>
                  <div className="hidden lg:block flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate font-[Fredoka] ${selectedId === img.id ? 'text-slate-800' : 'text-slate-500'}`}>{img.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{img.settings.mode === StencilMode.HOLLOW ? 'Outline' : 'Solid'}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setImages(images.filter(i => i.id !== img.id)); if (selectedId === img.id) setSelectedId(null); }}
                    className="text-slate-400 hover:text-red-400 p-1 lg:p-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center - Canvas / Preview */}
        <main className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col items-center order-2 h-[75vh] lg:h-auto w-full lg:w-auto">
          {images.length === 0 ? (
            // Empty State
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-purple-50 to-pink-50 w-full">
              <div className="text-center max-w-lg animate-fade-in">
                <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_10px_30px_rgba(236,72,153,0.15)] border border-pink-100 relative group overflow-hidden transition-transform hover:scale-105 duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-200/40 to-cyan-200/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Upload className="w-10 h-10 text-pink-400 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                </div>
                <h2 className="text-4xl font-bold text-slate-800 mb-3 font-[Fredoka] tracking-tight">upload design ~*</h2>
                <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                  Drag & drop images here.<br />
                  <span className="text-xs text-pink-400">supports png & jpg</span>
                </p>

                <label className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white rounded-2xl font-bold shadow-lg shadow-pink-200 cursor-pointer transition-all hover:scale-105 active:scale-95">
                  <Upload className="w-5 h-5" />
                  <span>Select Files</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          ) : selectedImage ? (
            <>
              {/* Image Preview Area */}
              <div className="flex-1 p-8 flex items-center justify-center w-full relative bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] bg-fixed overflow-hidden bg-[#f8fafc]">
                <div className="relative shadow-xl shadow-purple-900/5 max-h-full max-w-full group rounded-lg overflow-hidden ring-4 ring-white">
                  {selectedImage.processedUrl ? (
                    <img
                      src={selectedImage.processedUrl}
                      className="max-h-[calc(100vh-12rem)] max-w-full object-contain bg-white"
                      alt="Stencil Result"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 w-96 bg-white/50 rounded-xl backdrop-blur-sm border border-purple-100">
                      <RefreshCcw className="w-10 h-10 animate-spin text-pink-400 mb-4" />
                      <p className="text-slate-400 animate-pulse font-medium">✨ processing...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* CENTRAL COMMAND BAR */}
              <div className="absolute bottom-4 lg:bottom-8 z-30 animate-in slide-in-from-bottom-5 fade-in duration-300 w-full flex justify-center pointer-events-none">
                <div className="bg-white/60 lg:bg-white/90 backdrop-blur-xl border border-white/40 lg:border-white/60 rounded-3xl shadow-[0_10px_40px_-10px_rgba(100,20,100,0.15)] p-1.5 lg:p-2 flex items-center gap-1 lg:gap-2 ring-1 ring-purple-50 scale-90 lg:scale-100 origin-bottom pointer-events-auto">

                  {/* Add Image */}
                  <label className="flex flex-col items-center justify-center w-14 h-12 lg:w-16 lg:h-14 cursor-pointer hover:bg-pink-50 rounded-2xl transition-colors group">
                    <Plus className="w-4 h-4 lg:w-5 lg:h-5 text-pink-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold">Add</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>

                  <div className="w-px h-6 lg:h-8 bg-slate-200/50 lg:bg-slate-200 mx-0.5 lg:mx-1" />

                  {/* Downloads */}
                  <button
                    onClick={() => handleDownload(selectedImage, 'jpg')}
                    className="flex flex-col items-center justify-center w-14 h-12 lg:w-16 lg:h-14 hover:bg-blue-50 rounded-2xl transition-colors group"
                    title="Download JPG"
                  >
                    <FileImage className="w-4 h-4 lg:w-5 lg:h-5 text-blue-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold">JPG</span>
                  </button>

                  <button
                    onClick={() => handleDownload(selectedImage, 'png')}
                    className="flex flex-col items-center justify-center w-14 h-12 lg:w-16 lg:h-14 hover:bg-emerald-50 rounded-2xl transition-colors group"
                    title="Download PNG (Transparent)"
                  >
                    <Layers className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold">PNG</span>
                  </button>

                  <button
                    onClick={() => handleDownload(selectedImage, 'pdf')}
                    className="flex flex-col items-center justify-center w-14 h-12 lg:w-16 lg:h-14 hover:bg-red-50 rounded-2xl transition-colors group"
                    title="Download Printable PDF"
                  >
                    <FileDown className="w-4 h-4 lg:w-5 lg:h-5 text-red-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold">PDF</span>
                  </button>

                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-400 font-[Fredoka]">Select an image ~</h3>
            </div>
          )}
        </main>

        {/* Right Sidebar - Controls (Only visible if images exist) */}
        {images.length > 0 && (
          <aside className="w-full h-auto max-h-[40vh] border-t order-3 overflow-y-auto lg:h-auto lg:max-h-none lg:w-80 lg:bg-white/60 lg:border-l lg:border-t-0 border-purple-100 p-4 lg:p-6 flex flex-col shrink-0 z-20 backdrop-blur-sm shadow-[0_-5px_20px_rgba(0,0,0,0.02)] lg:shadow-none">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2 font-[Fredoka]">
                  <Sliders className="w-4 h-4" /> Config
                </h2>
                <div className="flex items-center gap-2" title="Apply settings to all images">
                  <span className={`text-[10px] font-bold tracking-wider ${useGlobalSettings ? 'text-pink-400' : 'text-slate-400'}`}>Edit All</span>
                  <button
                    onClick={() => setUseGlobalSettings(!useGlobalSettings)}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${useGlobalSettings ? 'bg-gradient-to-r from-pink-400 to-purple-400' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${useGlobalSettings ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {!useGlobalSettings && selectedImage && (
                <div className="bg-white p-2.5 rounded-xl mb-4 text-xs text-center border border-purple-100 text-slate-500 truncate shadow-sm">
                  Target: <span className="text-purple-500 font-bold">{selectedImage.name}</span>
                </div>
              )}

              {useGlobalSettings && (
                <div className="bg-pink-50 p-2.5 rounded-xl mb-4 text-xs text-center border border-pink-100 text-pink-600 flex items-center justify-center gap-2 font-medium">
                  <Zap className="w-3 h-3 fill-pink-600" />
                  Editing <span className="font-bold underline">ALL</span> images
                </div>
              )}
            </div>

            <div className="space-y-6">

              {/* Mirror Toggle */}
              <div className="flex items-center justify-between bg-white/50 p-3 rounded-2xl border border-white shadow-sm ring-1 ring-purple-50">
                <div className="flex items-center gap-2">
                  <FlipHorizontal className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-600">Mirror Image</span>
                </div>
                <button
                  onClick={() => handleSettingChange('isMirrored', !currentSettings.isMirrored)}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${currentSettings.isMirrored ? 'bg-purple-400' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${currentSettings.isMirrored ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Multiple Sizes Toggle */}
              <div className="bg-white/50 p-3 rounded-2xl border border-white shadow-sm ring-1 ring-purple-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-600">Multiple Sizes</span>
                  </div>
                  <button
                    onClick={() => handleSettingChange('isMultipleSizes', !currentSettings.isMultipleSizes)}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${currentSettings.isMultipleSizes ? 'bg-purple-400' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${currentSettings.isMultipleSizes ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {currentSettings.isMultipleSizes && (
                  <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-1">

                    {/* Count Selector */}
                    <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-200">
                      {[3, 6, 9].map(count => (
                        <button
                          key={count}
                          onClick={() => handleSettingChange('variantCount', count)}
                          className={`flex-1 text-xs py-1.5 rounded-md transition-all font-bold ${currentSettings.variantCount === count
                            ? 'bg-white text-purple-500 shadow-sm ring-1 ring-purple-100'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                          {count}x
                        </button>
                      ))}
                    </div>

                    {/* Min / Max Dropdowns */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block font-bold uppercase tracking-wider">Min Size</label>
                        <select
                          value={currentSettings.minSize}
                          onChange={(e) => handleSettingChange('minSize', parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center text-slate-600 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 appearance-none font-bold shadow-sm"
                        >
                          {sizeOptions.map(size => (
                            <option key={size} value={size}>{size}"</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block font-bold uppercase tracking-wider">Max Size</label>
                        <select
                          value={currentSettings.maxSize}
                          onChange={(e) => handleSettingChange('maxSize', parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center text-slate-600 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 appearance-none font-bold shadow-sm"
                        >
                          {sizeOptions.map(size => (
                            <option key={size} value={size}>{size}"</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Show Sizes Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                      <div className="flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-pink-400" />
                        <span className="text-xs font-bold text-slate-600">Show Sizes</span>
                      </div>
                      <button
                        onClick={() => handleSettingChange('showDimensions', !currentSettings.showDimensions)}
                        className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${currentSettings.showDimensions ? 'bg-pink-400' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${currentSettings.showDimensions ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div>
                <label className="text-xs font-bold text-slate-400 mb-3 block uppercase tracking-wider">Stencil Style</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSettingChange('mode', StencilMode.HOLLOW)}
                    className={`relative py-3 px-2 text-xs font-medium rounded-xl border-2 transition-all overflow-hidden ${currentSettings.mode === StencilMode.HOLLOW
                      ? 'bg-white border-purple-400 text-purple-600 shadow-md shadow-purple-100'
                      : 'bg-white/50 border-transparent text-slate-400 hover:border-purple-200 hover:bg-white'
                      }`}
                  >
                    <div className="mb-1 text-lg font-bold font-[Fredoka]">Outline</div>
                    <div className="text-[10px] opacity-70">Edge Detect</div>
                    {currentSettings.mode === StencilMode.HOLLOW && <div className="absolute top-2 right-2 w-2 h-2 bg-purple-400 rounded-full animate-pulse" />}
                  </button>
                  <button
                    onClick={() => handleSettingChange('mode', StencilMode.SOLID)}
                    className={`relative py-3 px-2 text-xs font-medium rounded-xl border-2 transition-all overflow-hidden ${currentSettings.mode === StencilMode.SOLID
                      ? 'bg-white border-purple-400 text-purple-600 shadow-md shadow-purple-100'
                      : 'bg-white/50 border-transparent text-slate-400 hover:border-purple-200 hover:bg-white'
                      }`}
                  >
                    <div className="mb-1 text-lg font-bold font-[Fredoka]">Solid</div>
                    <div className="text-[10px] opacity-70">Adaptive Scan</div>
                    {currentSettings.mode === StencilMode.SOLID && <div className="absolute top-2 right-2 w-2 h-2 bg-purple-400 rounded-full animate-pulse" />}
                  </button>
                </div>
              </div>

              {/* Threshold Slider + Presets */}
              <div className="bg-white/50 p-4 rounded-2xl border border-white shadow-sm ring-1 ring-purple-50">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-600">
                    {currentSettings.mode === StencilMode.SOLID ? 'Scan Sensitivity' : 'Edge Detection'}
                  </label>
                  <span className="text-xs text-purple-500 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">{currentSettings.threshold}</span>
                </div>

                {/* Presets */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => applyPreset('fineline')}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-pink-300 text-[10px] font-bold text-slate-500 hover:text-pink-500 transition-colors shadow-sm"
                  >
                    Fineline
                  </button>
                  <button
                    onClick={() => applyPreset('bold')}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-pink-300 text-[10px] font-bold text-slate-500 hover:text-pink-500 transition-colors shadow-sm"
                  >
                    Bold
                  </button>
                </div>

                <input
                  type="range"
                  min="0"
                  max="255"
                  value={currentSettings.threshold}
                  onChange={(e) => handleSettingChange('threshold', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-purple-400 hover:accent-pink-400 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-2 flex justify-between font-medium">
                  <span>{currentSettings.mode === StencilMode.SOLID ? 'Cleaner' : 'Fine Lines'}</span>
                  <span>{currentSettings.mode === StencilMode.SOLID ? 'Darker' : 'Main Shapes'}</span>
                </p>
              </div>

              {/* Detail Level Slider (Range -4 to 5) */}
              <div className="bg-white/50 p-4 rounded-2xl border border-white shadow-sm ring-1 ring-purple-50">
                <div className="flex justify-between mb-4">
                  <label className="text-xs font-bold text-slate-600">Detail Level</label>
                  <span className="text-xs text-purple-500 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">{currentSettings.noiseReduction}</span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="5"
                  step="1"
                  value={currentSettings.noiseReduction}
                  onChange={(e) => handleSettingChange('noiseReduction', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-purple-400 hover:accent-pink-400 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-2 flex justify-between font-medium">
                  <span>Sharpen</span>
                  <span>Smooth</span>
                </p>
              </div>

              {/* Thickness Slider */}
              <div className="bg-white/50 p-4 rounded-2xl border border-white shadow-sm ring-1 ring-purple-50">
                <div className="flex justify-between mb-4">
                  <label className="text-xs font-bold text-slate-600">Line Weight</label>
                  <span className="text-xs text-purple-500 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">{currentSettings.thickness > 0 ? '+' : ''}{currentSettings.thickness}</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="10"
                  step="1"
                  value={currentSettings.thickness}
                  onChange={(e) => handleSettingChange('thickness', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-purple-400 hover:accent-pink-400 transition-colors"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                  <span>Ultra Fine</span>
                  <span>Heavy</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 p-4 rounded-2xl flex gap-3 shadow-sm">
                  <Settings className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-cyan-600 mb-1 font-[Fredoka]">Pro Tip</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                      Negative <strong>Detail Level</strong> sharpens the image. Use <strong>Multiple Sizes</strong> to create a sizing test sheet!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      <GeminiAdvisor currentImageBase64={selectedImage?.originalUrl || null} />
    </div>
  );
};

export default App;