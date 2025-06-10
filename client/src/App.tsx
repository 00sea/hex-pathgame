import React, { useState } from 'react';
import LocalGame from './components/LocalGame';
import { MultiplayerTest } from './components/multiplayer/MultiplayerTest';

type AppMode = 'multiplayer-test' | 'local-game';

function App() {
  const [mode, setMode] = useState<AppMode>('local-game');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Shared Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800">Vertex Strategy Game</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('local-game')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  mode === 'local-game' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Local Game
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
      {mode === 'local-game' ? (
        <LocalGame />
      ) : (
        <MultiplayerTest />
      )}
    </div>
  );
}

export default App;