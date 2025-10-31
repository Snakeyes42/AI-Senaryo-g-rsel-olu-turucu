import React, { useState } from 'react';
import { ImageGenerator } from './components/ImageGenerator';
import { VideoGenerator } from './components/VideoGenerator';
import { Header } from './components/Header';

type Tab = 'image' | 'video';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('image');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex justify-center border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('image')}
            className={`px-4 py-2 text-lg font-medium transition-colors duration-200 ${
              activeTab === 'image'
                ? 'border-b-2 border-indigo-500 text-indigo-400'
                : 'text-gray-400 hover:text-indigo-400'
            }`}
          >
            Görsel Oluşturma
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`px-4 py-2 text-lg font-medium transition-colors duration-200 ${
              activeTab === 'video'
                ? 'border-b-2 border-indigo-500 text-indigo-400'
                : 'text-gray-400 hover:text-indigo-400'
            }`}
          >
            Video Oluşturma
          </button>
        </div>

        <div>
          {activeTab === 'image' && <ImageGenerator />}
          {activeTab === 'video' && <VideoGenerator />}
        </div>
      </main>
    </div>
  );
};

export default App;