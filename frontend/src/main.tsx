import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import App from './App.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#2F6F64',
        borderRadius: 8,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    }}
  >
    <AntdApp>
      <App />
    </AntdApp>
  </ConfigProvider>
);
