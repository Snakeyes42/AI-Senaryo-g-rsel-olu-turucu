import React, { useState, useEffect } from 'react';
import { generateVideoFromImage } from '../services/geminiService';
import { AspectRatio } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Dosya base64 formatına çevrilemedi.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });

export const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Landscape);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true); 
    }
  };

  const handleGenerate = async () => {
    if (!imageFile) {
      setError('Lütfen bir görsel yükleyin.');
      return;
    }
    
    if (!apiKeySelected) {
        setError('Veo modellerini kullanmak için lütfen bir API anahtarı seçin.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    
    try {
      const base64Image = await fileToBase64(imageFile);
      const url = await generateVideoFromImage(prompt, base64Image, imageFile.type, aspectRatio, setLoadingMessage);
      setVideoUrl(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
      setError(errorMessage);
      if (errorMessage.includes("API anahtarı bulunamadı")) {
        setApiKeySelected(false);
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="flex flex-col space-y-6 bg-gray-800 p-6 rounded-lg shadow-lg">
        {!apiKeySelected && (
            <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-4 rounded-lg">
                <h3 className="font-bold">Veo için API Anahtarı Gerekli</h3>
                <p className="text-sm mt-1">Veo ile video oluşturma, bir API anahtarı seçmenizi gerektirir. Bu anahtar faturalandırma amacıyla kullanılacaktır.</p>
                <p className="text-sm mt-2">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-100">
                        Faturalandırma hakkında daha fazla bilgi edinin.
                    </a>
                </p>
                <button 
                    onClick={handleSelectKey}
                    className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                    API Anahtarı Seç
                </button>
            </div>
        )}

        <div>
            <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">
                Görsel Yükle
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    {imagePreview ? (
                        <img src={imagePreview} alt="Önizleme" className="mx-auto h-24 w-auto rounded-md" />
                    ) : (
                        <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                    <div className="flex text-sm text-gray-400">
                        <label htmlFor="image-upload-input" className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-indigo-400 hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-indigo-500 p-1">
                            <span>Bir dosya yükle</span>
                            <input id="image-upload-input" name="image-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*"/>
                        </label>
                        <p className="pl-1">veya sürükleyip bırak</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF - 10MB'a kadar</p>
                </div>
            </div>
        </div>
        <div>
          <label htmlFor="video-prompt" className="block text-sm font-medium text-gray-300 mb-2">
            Video Komutu (İsteğe Bağlı)
          </label>
          <textarea
            id="video-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Örn: Arabanın uzaklaşmasını sağla"
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            En Boy Oranı
          </label>
          <div className="flex space-x-4">
            {[AspectRatio.Landscape, AspectRatio.Portrait].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading || !imageFile || !apiKeySelected}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out flex items-center justify-center"
        >
          {isLoading ? 'Oluşturuluyor...' : 'Video Oluştur'}
        </button>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center justify-center min-h-[300px] lg:min-h-0">
        {isLoading && <LoadingSpinner message={loadingMessage} />}
        {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-md">{error}</div>}
        {videoUrl && !isLoading && (
            <video src={videoUrl} controls autoPlay loop className="rounded-lg max-w-full max-h-full object-contain" />
        )}
        {!isLoading && !error && !videoUrl && (
          <div className="text-center text-gray-500">
            <p>Oluşturulan videonuz burada görünecek.</p>
          </div>
        )}
      </div>
    </div>
  );
};