import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import App from './App.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#1A73A0',
        colorError: '#D3132E',
        colorWarning: '#F27A1A',
        colorSuccess: '#0F7A4A',
        colorText: '#15334A',
        colorTextSecondary: '#5A7184',
        colorBorder: '#C4DCE8',
        colorBgLayout: '#F4FAFD',
        borderRadius: 10,
        fontFamily: "'Nunito', 'Be Vietnam Pro', system-ui, sans-serif",
      },
    }}
  >
    <AntdApp>
      <App />
    </AntdApp>
  </ConfigProvider>
);
