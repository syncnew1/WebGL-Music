import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/tailwind.css'
import './styles/theme.css'
import { AuthProvider } from './providers/AuthProvider'
import { DataProvider } from './providers/DataProvider'
import { PlayerProvider } from './providers/PlayerProvider'
import { VisualizerProvider } from './providers/VisualizerProvider'
import { LayoutProvider } from './providers/LayoutProvider'

const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <LayoutProvider>
        <AuthProvider>
          <DataProvider>
            <PlayerProvider>
              <VisualizerProvider>
                <App />
              </VisualizerProvider>
            </PlayerProvider>
          </DataProvider>
        </AuthProvider>
      </LayoutProvider>
    </BrowserRouter>
  </React.StrictMode>
)