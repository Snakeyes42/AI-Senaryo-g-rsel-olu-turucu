export enum ImageStyle {
  Photorealistic = "Hyperrealistic photo, lifelike, realistic, professional photography, 8k, detailed, shot on DSLR camera",
  DigitalArt = "Digital art, concept art, smooth, sharp focus, illustration",
  Watercolor = "Watercolor painting, vibrant colors, artistic",
  PixelArt = "Pixel art, 16-bit, retro gaming style",
  Anime = "Anime style, cinematic lighting, detailed",
  None = "None",
}

export enum AspectRatio {
  Square = "1:1",
  Portrait = "9:16",
  Landscape = "16:9",
}

export interface VoiceOption {
  name: string;
  displayName: string;
}

export const Voices: VoiceOption[] = [
  { name: 'Kore', displayName: 'Kore (Kadın, Standart)' },
  { name: 'Zephyr', displayName: 'Zephyr (Kadın, Yumuşak)' },
  { name: 'Puck', displayName: 'Puck (Erkek, Canlı)' },
  { name: 'Charon', displayName: 'Charon (Erkek, Derin)' },
  { name: 'Fenrir', displayName: 'Fenrir (Erkek, Otoriter)' },
];

export interface TextOverlay {
  id: string;
  type: 'title' | 'dialogue';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  textAlign: 'left' | 'center' | 'right';
  
  // Background / Speech Bubble
  backgroundColor: string;
  padding: number;
  borderRadius: number;

  // Effects
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
}

export interface StoryPanel {
  id: string;
  imageUrl: string;
  scenePrompt: string;
  textOverlays: TextOverlay[];
  style: ImageStyle;
  aspectRatio: AspectRatio;
  characterDescription?: string;
}

export interface TitlePreset {
  name: string;
  styles: Partial<Omit<TextOverlay, 'id' | 'text' | 'x' | 'y' | 'width'>>;
}

export const titlePresets: TitlePreset[] = [
  {
    name: 'Göz Alıcı Manşet',
    styles: {
      fontFamily: 'Impact',
      fontSize: 52,
      color: '#FFFF00',
      textAlign: 'center',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadowColor: 'rgba(0,0,0,0.7)',
      shadowBlur: 5,
    },
  },
  {
      name: 'Sinematik',
      styles: {
        fontFamily: 'Times New Roman',
        fontSize: 36,
        color: '#FFFFFF',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 10,
        borderRadius: 0,
      }
  },
  {
      name: 'Retro',
      styles: {
        fontFamily: 'Comic Sans MS',
        fontSize: 42,
        color: '#FF00FF',
        textAlign: 'center',
        strokeColor: '#00FFFF',
        strokeWidth: 2,
      }
  }
];