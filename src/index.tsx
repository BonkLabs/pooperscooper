import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './App.css';
import { Analytics } from '@vercel/analytics/react';

ReactDOM.render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>,
  document.getElementById('root')
);
