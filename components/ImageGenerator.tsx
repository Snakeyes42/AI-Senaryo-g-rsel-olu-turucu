import React, { useState, useRef, MouseEvent } from 'react';
import { generateImage, generateSpeech, generateCharacterDescription } from '../services/geminiService';
import { ImageStyle, AspectRatio, Voices, StoryPanel, TextOverlay, titlePresets, TitlePreset } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

const createWavFile = (base64Audio: string): string => {
    const decode = (base64: string) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const audioData = decode(base64Audio);
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = audioData.length;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < audioData.length; i++) {
        view.setUint8(44 + i, audioData[i]);
    }
    
    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};

export const ImageGenerator: React.FC = () => {
    const [scenePrompt, setScenePrompt] = useState<string>('');
    const [style, setStyle] = useState<ImageStyle>(ImageStyle.Photorealistic);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [storyPanels, setStoryPanels] = useState<StoryPanel[]>([]);
    const [loadingPanelId, setLoadingPanelId] = useState<string | null>(null);

    const [selectedOverlay, setSelectedOverlay] = useState<{ panelId: string; overlayId: string } | null>(null);
    
    const fontFamilies = ['Arial', 'Verdana', 'Impact', 'Comic Sans MS', 'Times New Roman', 'Georgia', 'Courier New'];
    const dragAction = useRef<{ type: 'move' | 'resize'; panelId: string; overlayId: string; initialX: number; initialY: number; initialWidth: number; initialHeight: number } | null>(null);
    const containerRefs = useRef<{[key: string]: HTMLDivElement | null}>({});

    const handleAddScene = async () => {
        if (!scenePrompt.trim()) {
            setError('Lütfen bir sahne açıklaması girin.');
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            const latestPanel = storyPanels[0];
            const characterDescription = latestPanel?.characterDescription;
            const url = await generateImage(scenePrompt, style, aspectRatio, characterDescription);
            
            const newPanel: StoryPanel = {
                id: crypto.randomUUID(),
                imageUrl: url,
                scenePrompt: scenePrompt,
                style: style,
                aspectRatio: aspectRatio,
                textOverlays: [],
            };
            
            setStoryPanels(prev => [newPanel, ...prev]);
            setScenePrompt('');

            try {
                const newDescription = await generateCharacterDescription(url);
                setStoryPanels(prev => 
                    prev.map(p => 
                        p.id === newPanel.id ? { ...p, characterDescription: newDescription } : p
                    )
                );
            } catch (descError) {
                console.error("Karakter açıklaması oluşturulamadı:", descError);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const updateOverlay = (panelId: string, overlayId: string, updates: Partial<TextOverlay>) => {
        setStoryPanels(panels => panels.map(p => {
            if (p.id === panelId) {
                return {
                    ...p,
                    textOverlays: p.textOverlays.map(o => o.id === overlayId ? { ...o, ...updates } : o)
                };
            }
            return p;
        }));
    };

    const addOverlay = (panelId: string, type: 'title' | 'dialogue') => {
        const newOverlay: TextOverlay = {
            id: crypto.randomUUID(),
            type,
            text: type === 'title' ? 'Başlık' : 'Diyalog metni...',
            fontSize: type === 'title' ? 48 : 24,
            fontFamily: type === 'title' ? 'Impact' : 'Arial',
            color: type === 'title' ? '#FFFFFF' : '#000000',
            x: 25, y: 40, width: 50,
            textAlign: 'center',
            backgroundColor: type === 'dialogue' ? '#FFFFFF' : 'transparent',
            padding: 10,
            borderRadius: 15,
            strokeColor: '#000000',
            strokeWidth: type === 'title' ? 1 : 0,
            shadowColor: 'rgba(0,0,0,0.5)',
            shadowBlur: type === 'title' ? 4 : 0,
        };
        setStoryPanels(panels => panels.map(p => p.id === panelId ? { ...p, textOverlays: [...p.textOverlays, newOverlay] } : p));
        setSelectedOverlay({ panelId, overlayId: newOverlay.id });
    };

    const deleteOverlay = (panelId: string, overlayId: string) => {
        setStoryPanels(panels => panels.map(p => {
            if (p.id === panelId) {
                return { ...p, textOverlays: p.textOverlays.filter(o => o.id !== overlayId) };
            }
            return p;
        }));
        setSelectedOverlay(null);
    };

    const handleMouseDown = (e: MouseEvent, panelId: string, overlay: TextOverlay, actionType: 'move' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedOverlay({ panelId, overlayId: overlay.id });
        const container = containerRefs.current[panelId];
        if (!container) return;
        const rect = container.getBoundingClientRect();
        dragAction.current = {
            type: actionType,
            panelId,
            overlayId: overlay.id,
            initialX: e.clientX,
            initialY: e.clientY,
            initialWidth: (overlay.width / 100) * rect.width,
            initialHeight: e.currentTarget.clientHeight,
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragAction.current) return;
        e.preventDefault();
        e.stopPropagation();
        const { type, panelId, overlayId, initialX, initialY, initialWidth } = dragAction.current;
        const container = containerRefs.current[panelId];
        const panel = storyPanels.find(p => p.id === panelId);
        const overlay = panel?.textOverlays.find(o => o.id === overlayId);
        if (!container || !overlay) return;

        const rect = container.getBoundingClientRect();
        const dx = e.clientX - initialX;
        const dy = e.clientY - initialY;

        if (type === 'move') {
            const x = ((e.clientX - rect.left) / rect.width) * 100 - (initialWidth/2 / rect.width * 100) ;
            const y = ((e.clientY - rect.top) / rect.height) * 100 - (20 / rect.height * 100) ; // approx half height
            updateOverlay(panelId, overlayId, { x, y });
        } else if (type === 'resize') {
            const newWidthPx = initialWidth + dx;
            const newWidthPercent = (newWidthPx / rect.width) * 100;
            updateOverlay(panelId, overlayId, { width: Math.max(10, Math.min(100, newWidthPercent)) });
        }
    };
    
    const handleMouseUp = () => {
        dragAction.current = null;
    };
    
    React.useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove as any);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove as any);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [storyPanels]); // Re-bind if panels change to get latest overlay data

    const handleRefreshScene = async (panelId: string) => {
        const panelToRefresh = storyPanels.find(p => p.id === panelId);
        if (!panelToRefresh) return;
        setLoadingPanelId(panelId);
        setError(null);
        try {
            const url = await generateImage(panelToRefresh.scenePrompt, panelToRefresh.style, panelToRefresh.aspectRatio, panelToRefresh.characterDescription);
            setStoryPanels(prev => prev.map(p => p.id === panelId ? { ...p, imageUrl: url } : p));
        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
             setError(`'${panelToRefresh.scenePrompt.substring(0, 20)}...' sahnesi yenilenemedi: ${errorMessage}`);
        } finally {
            setLoadingPanelId(null);
        }
    };
    
    const handleContinueFromScene = (panel: StoryPanel) => {
        setScenePrompt(panel.scenePrompt);
        setStyle(panel.style);
        setAspectRatio(panel.aspectRatio);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteScene = (panelId: string) => {
        setStoryPanels(prev => prev.filter(p => p.id !== panelId));
    };

    const getSelectedOverlay = () => {
        if (!selectedOverlay) return null;
        const panel = storyPanels.find(p => p.id === selectedOverlay.panelId);
        return panel?.textOverlays.find(o => o.id === selectedOverlay.overlayId) || null;
    }

    const currentOverlay = getSelectedOverlay();

    // TTS state
    const [ttsText, setTtsText] = useState('');
    const [voice, setVoice] = useState<string>(Voices[0].name);
    const [isTtsLoading, setIsTtsLoading] = useState(false);
    const [ttsError, setTtsError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerateSpeech = async (text: string) => {
        if (!text.trim()) {
            setTtsError("Seslendirme için metin girin.");
            return;
        }
        setIsTtsLoading(true);
        setTtsError(null);
        try {
            const base64Audio = await generateSpeech(text, voice);
            const wavUrl = createWavFile(base64Audio);
            setAudioUrl(wavUrl);
            if (audioRef.current) {
                audioRef.current.src = wavUrl;
                audioRef.current.play();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
            setTtsError(errorMessage);
        } finally {
            setIsTtsLoading(false);
        }
    };
    
    return (
        <div className="flex flex-col gap-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6 sticky top-4 z-10">
                <div>
                    <label htmlFor="scene-prompt" className="block text-sm font-medium text-gray-300 mb-2">
                        Sahne Açıklaması
                    </label>
                    <textarea
                        id="scene-prompt"
                        value={scenePrompt}
                        onChange={(e) => setScenePrompt(e.target.value)}
                        placeholder="Örn: Kırmızı bir kaykay tutan bir robot, kalabalık bir şehirde"
                        rows={3}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label htmlFor="image-style" className="block text-sm font-medium text-gray-300 mb-2">Stil</label>
                        <select id="image-style" value={style} onChange={(e) => setStyle(e.target.value as ImageStyle)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                            {Object.entries(ImageStyle).map(([key, value]) => (<option key={key} value={value}>{key.replace(/([A-Z])/g, ' $1').trim()}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">En Boy Oranı</label>
                        <div className="flex space-x-2 md:space-x-4">
                            {[{ label: 'Kare (1:1)', value: AspectRatio.Square },{ label: 'Yatay (16:9)', value: AspectRatio.Landscape },{ label: 'Dikey (Reels/Shorts)', value: AspectRatio.Portrait }].map((option) => (
                            <button key={option.label} onClick={() => setAspectRatio(option.value)} className={`w-full py-2 px-2 text-sm rounded-md transition-colors ${ aspectRatio === option.value ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600' }`}>
                                {option.label}
                            </button>
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={handleAddScene} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out flex items-center justify-center">
                    {isLoading ? <LoadingSpinner /> : 'Sahne Ekle'}
                </button>
            </div>
            
            {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-md mx-auto text-center">{error}</div>}
            
            <div className="space-y-8">
                {isLoading && storyPanels.length === 0 && <LoadingSpinner message="İlk sahne oluşturuluyor..." />}

                {storyPanels.map(panel => {
                    const selectedOverlayForThisPanel = selectedOverlay?.panelId === panel.id ? panel.textOverlays.find(o => o.id === selectedOverlay.overlayId) : null;
                    return (
                    <div key={panel.id} className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-800 p-6 rounded-lg shadow-lg">
                       {/* FIX: Changed ref callback to have a block body to avoid returning a value, which is not allowed by React's ref prop type. */}
                       <div className="lg:col-span-2 flex flex-col items-center justify-center relative bg-gray-900 rounded-lg min-h-[300px] overflow-hidden select-none" ref={el => { containerRefs.current[panel.id] = el; }}>
                            {loadingPanelId === panel.id ? <LoadingSpinner message="Yenileniyor..." /> : (
                                <>
                                    <img src={panel.imageUrl} alt={panel.scenePrompt} className="rounded-lg w-full h-full object-contain" />
                                    {panel.textOverlays.map(overlay => {
                                        const isSelected = selectedOverlay?.overlayId === overlay.id;
                                        const textShadow = `${overlay.shadowBlur}px ${overlay.shadowBlur}px ${overlay.shadowBlur}px ${overlay.shadowColor}`;
                                        const webkitTextStroke = `${overlay.strokeWidth}px ${overlay.strokeColor}`;
                                        
                                        return (
                                        <div key={overlay.id} 
                                            onMouseDown={(e) => handleMouseDown(e, panel.id, overlay, 'move')}
                                            onClick={(e) => { e.stopPropagation(); setSelectedOverlay({panelId: panel.id, overlayId: overlay.id})}}
                                            className={`absolute p-2 cursor-move group ${isSelected ? 'border-2 border-dashed border-indigo-400' : 'border-2 border-transparent'}`}
                                            style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, width: `${overlay.width}%` }}
                                        >
                                            <div style={{
                                                backgroundColor: overlay.backgroundColor,
                                                padding: `${overlay.padding}px`,
                                                borderRadius: `${overlay.borderRadius}px`,
                                            }}>
                                                <p style={{ 
                                                    color: overlay.color, 
                                                    fontSize: `${overlay.fontSize}px`, 
                                                    fontFamily: overlay.fontFamily,
                                                    textAlign: overlay.textAlign,
                                                    textShadow,
                                                    WebkitTextStroke: webkitTextStroke,
                                                    whiteSpace: 'pre-wrap',
                                                    wordWrap: 'break-word',
                                                }}>
                                                    {overlay.text}
                                                </p>
                                                 {overlay.type === 'dialogue' && overlay.backgroundColor !== 'transparent' &&
                                                    <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8" style={{ borderTopColor: overlay.backgroundColor }}></div>
                                                }
                                            </div>
                                            {isSelected && (
                                                <div 
                                                    onMouseDown={(e) => handleMouseDown(e, panel.id, overlay, 'resize')}
                                                    className="absolute -right-1 -bottom-1 w-4 h-4 bg-indigo-500 rounded-full cursor-se-resize"
                                                ></div>
                                            )}
                                        </div>
                                    )})}
                                </>
                            )}
                            <div className="absolute top-2 right-2 flex gap-2">
                                <button onClick={() => handleRefreshScene(panel.id)} disabled={loadingPanelId === panel.id} title="Yenile" className="bg-gray-700 bg-opacity-70 hover:bg-opacity-100 p-2 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                </button>
                                <button onClick={() => handleDeleteScene(panel.id)} disabled={loadingPanelId === panel.id} title="Sil" className="bg-red-700 bg-opacity-70 hover:bg-opacity-100 p-2 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col space-y-4">
                            {!selectedOverlayForThisPanel ? (
                            <>
                            <div>
                                <h3 className="text-lg font-semibold text-indigo-400 mb-2">Senaryo</h3>
                                <p className="text-gray-300 bg-gray-700 p-3 rounded-md text-sm">{panel.scenePrompt}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => addOverlay(panel.id, 'title')} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-md transition duration-300">+ Başlık Ekle</button>
                                <button onClick={() => addOverlay(panel.id, 'dialogue')} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-md transition duration-300">+ Diyalog Ekle</button>
                            </div>
                             <div>
                                <h3 className="text-lg font-semibold text-indigo-400 mb-2">Seslendirme</h3>
                                <div className="space-y-3">
                                    <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="Seslendirilecek metni buraya yazın veya katmanlardan kopyalayın." rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500" />
                                    <select value={voice} onChange={e => setVoice(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-1 focus:ring-indigo-500">
                                        {Voices.map(v => <option key={v.name} value={v.name}>{v.displayName}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                         <button onClick={() => handleGenerateSpeech(ttsText)} disabled={isTtsLoading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-3 rounded-md transition duration-300">
                                            {isTtsLoading ? '...' : 'Sesi Dinle'}
                                         </button>
                                         {audioUrl && <a href={audioUrl} download={`${panel.id}.wav`} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md transition duration-300">İndir</a>}
                                    </div>
                                    <audio ref={audioRef} className="hidden" />
                                    {ttsError && <p className="text-red-400 text-sm">{ttsError}</p>}
                                </div>
                            </div>
                             <div className="pt-2">
                                <button onClick={() => handleContinueFromScene(panel)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                                    Bu Sahneden Devam Et
                                </button>
                            </div>
                            </>
                            ) : (
                                <div className="space-y-3 bg-gray-700 p-3 rounded-md">
                                    <h3 className="text-lg font-semibold text-indigo-400 border-b border-gray-600 pb-2">Katman Editörü</h3>
                                    <textarea value={selectedOverlayForThisPanel.text} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { text: e.target.value })} rows={2} className="w-full bg-gray-600 p-1 rounded" />
                                    {selectedOverlayForThisPanel.type === 'title' && (
                                        <div><label className="text-xs">Hazır Stiller</label><div className="flex gap-1">{titlePresets.map(p=>(<button key={p.name} onClick={()=>updateOverlay(panel.id, selectedOverlayForThisPanel.id, p.styles)} className="text-xs bg-gray-600 hover:bg-gray-500 p-1 rounded">{p.name}</button>))}</div></div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><label>Yazı Tipi</label><select value={selectedOverlayForThisPanel.fontFamily} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { fontFamily: e.target.value })} className="w-full bg-gray-600 p-1 rounded"><option value="Arial">Arial</option><option value="Impact">Impact</option><option value="Comic Sans MS">Comic Sans</option><option value="Times New Roman">Times</option></select></div>
                                        <div><label>Hizala</label><select value={selectedOverlayForThisPanel.textAlign} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { textAlign: e.target.value as any })} className="w-full bg-gray-600 p-1 rounded"><option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option></select></div>
                                        <div><label>Boyut</label><input type="number" value={selectedOverlayForThisPanel.fontSize} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { fontSize: parseInt(e.target.value) })} className="w-full bg-gray-600 p-1 rounded" /></div>
                                        <div><label>Renk</label><input type="color" value={selectedOverlayForThisPanel.color} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { color: e.target.value })} className="w-full bg-gray-600 p-0 rounded" /></div>
                                        
                                        <div><label>Kontur Kalınlığı</label><input type="number" min="0" value={selectedOverlayForThisPanel.strokeWidth} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { strokeWidth: parseInt(e.target.value) })} className="w-full bg-gray-600 p-1 rounded" /></div>
                                        <div><label>Kontur Rengi</label><input type="color" value={selectedOverlayForThisPanel.strokeColor} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { strokeColor: e.target.value })} className="w-full bg-gray-600 p-0 rounded" /></div>
                                        
                                        <div><label>Gölge Bulanıklığı</label><input type="number" min="0" value={selectedOverlayForThisPanel.shadowBlur} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { shadowBlur: parseInt(e.target.value) })} className="w-full bg-gray-600 p-1 rounded" /></div>
                                        <div><label>Gölge Rengi</label><input type="color" value={selectedOverlayForThisPanel.shadowColor} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { shadowColor: e.target.value })} className="w-full bg-gray-600 p-0 rounded" /></div>
                                        
                                        {selectedOverlayForThisPanel.type === 'dialogue' && (<>
                                            <div><label>Balon Dolgu</label><input type="number" min="0" value={selectedOverlayForThisPanel.padding} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { padding: parseInt(e.target.value) })} className="w-full bg-gray-600 p-1 rounded" /></div>
                                            <div><label>Balon Ovallik</label><input type="number" min="0" value={selectedOverlayForThisPanel.borderRadius} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { borderRadius: parseInt(e.target.value) })} className="w-full bg-gray-600 p-1 rounded" /></div>
                                            <div><label>Balon Rengi</label><input type="color" value={selectedOverlayForThisPanel.backgroundColor} onChange={e => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { backgroundColor: e.target.value })} className="w-full bg-gray-600 p-0 rounded" /></div>
                                            <button onClick={() => updateOverlay(panel.id, selectedOverlayForThisPanel.id, { backgroundColor: 'transparent' })} className="text-xs bg-gray-500 hover:bg-gray-400 p-1 rounded">Şeffaf Yap</button>
                                        </>)}

                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-gray-600">
                                         <button onClick={() => deleteOverlay(panel.id, selectedOverlayForThisPanel.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md transition duration-300">Katmanı Sil</button>
                                         <button onClick={() => setSelectedOverlay(null)} className="flex-1 bg-gray-500 hover:bg-gray-400 text-white font-bold py-2 px-3 rounded-md transition duration-300">Kapat</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )})}
            </div>
            
            {!isLoading && storyPanels.length === 0 && (
                 <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-700 rounded-lg">
                    <h2 className="text-xl font-semibold">Hikayeniz Burada Başlayacak</h2>
                    <p className="mt-2">Yukarıya bir senaryo yazıp "Sahne Ekle" butonuna tıklayın.</p>
                 </div>
            )}
        </div>
    );
};