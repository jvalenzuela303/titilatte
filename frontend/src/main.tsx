import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App, ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import AppRoot from './App'
import 'antd/dist/reset.css'

// Initialize axios interceptors by importing the configured instance
import './config/axios'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found. Check index.html.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ConfigProvider locale={esES}>
        <App>
          <AppRoot />
        </App>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
)
