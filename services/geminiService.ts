import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { AspectRatio, ImageStyle } from '../types';

const checkAndInitializeGemini = async (): Promise<GoogleGenAI> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateCharacterDescription = async (base64ImageUrl: string): Promise<string> => {
  const ai = await checkAndInitializeGemini();
  const base64Data = base64ImageUrl.split(',')[1];

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64Data,
    },
  };

  const textPart = {
    text: `Analyze this image and provide a detailed, descriptive text of the main character(s) that can be used as a character sheet for generating consistent characters in future images. Describe their clothing, facial features, hair, build, and any defining accessories. Focus only on the character's appearance. The description should be concise and in English. Example: "A middle-aged man with a short black beard, wearing a white turban, a brown vest over a white shirt, and brown pants."`
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  });

  return response.text;
};

export const generateImage = async (prompt: string, style: ImageStyle, aspectRatio: AspectRatio, characterDescription?: string): Promise<string> => {
  const ai = await checkAndInitializeGemini();
  
  const characterPrompt = characterDescription ? `The main character is described as: ${characterDescription}.` : '';
  const stylePrompt = style === ImageStyle.None ? '' : `The style of the image should be: ${style}.`;

  const fullPrompt = [prompt, characterPrompt, stylePrompt].filter(Boolean).join('. ');

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: fullPrompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: aspectRatio,
    },
  });
  
  if (response.generatedImages && response.generatedImages.length > 0) {
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }

  throw new Error("Görsel oluşturma başarısız oldu. Hiçbir görsel döndürülmedi.");
};


export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
    const ai = await checkAndInitializeGemini();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("Ses oluşturma başarısız oldu. API'den ses verisi alınamadı.");
    }
    return base64Audio;
};


export const generateVideoFromImage = async (
    prompt: string | null, 
    base64Image: string, 
    mimeType: string, 
    aspectRatio: AspectRatio, 
    setLoadingMessage: (message: string) => void
): Promise<string> => {
    
  setLoadingMessage("API anahtarı kontrol ediliyor...");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  setLoadingMessage("Video oluşturma başlatılıyor... Bu işlem birkaç dakika sürebilir.");
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || 'Bu görseli canlandır.',
      image: {
        imageBytes: base64Image,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio,
      }
    });

    setLoadingMessage("Oluşturma devam ediyor... Sonuçlar kontrol ediliyor. Lütfen bekleyin.");
    let pollCount = 0;
    while (!operation.done) {
      pollCount++;
      setLoadingMessage(`Oluşturma devam ediyor... Sonuçlar kontrol ediliyor (Deneme ${pollCount}).`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        throw new Error(`Video oluşturma hatası: ${operation.error.message}`);
    }

    setLoadingMessage("Oluşturulan video getiriliyor...");
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

    if (!downloadLink) {
        throw new Error("Video oluşturma tamamlandı, ancak indirme bağlantısı bulunamadı.");
    }

    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!videoResponse.ok) {
        throw new Error(`Video indirilemedi. Durum: ${videoResponse.statusText}`);
    }
    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
  } catch(error: any) {
      if (error.message && error.message.includes("Requested entity was not found.")) {
          throw new Error("API anahtarı bulunamadı veya geçersiz. Lütfen geçerli bir API anahtarı seçin.");
      }
      throw error;
  }
};