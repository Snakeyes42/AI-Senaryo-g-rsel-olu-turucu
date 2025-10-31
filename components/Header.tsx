import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider">
          <span className="text-indigo-400">Senaryo</span> Görselleştirici
        </h1>
      </div>
    </header>
  );
};