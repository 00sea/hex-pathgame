import React, { useState } from 'react';
import VertexGridDemo from './components/VertexGridDemo';
import { MultiplayerTest } from './components/MultiplayerTest';

type AppMode = 'multiplayer-test' | 'vertex-demo';

function App() {
  const [mode, setMode] = useState<AppMode>('multiplayer-test');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Shared Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800">Vertex Strategy Game</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('vertex-demo')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  mode === 'vertex-demo' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Local Demo
              </button>
              <button
                onClick={() => setMode('multiplayer-test')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  mode === 'multiplayer-test' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Multiplayer Test
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content based on mode */}
      {mode === 'vertex-demo' ? (
        <VertexGridDemo />
      ) : (
        <MultiplayerTest />
      )}
    </div>
  );
}

export default App;