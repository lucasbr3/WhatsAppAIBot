import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getSocket } from './api/client';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import AIControl from './pages/AIControl';
import Music from './pages/Music';
import Calls from './pages/Calls';
import Users from './pages/Users';
import Logs from './pages/Logs';

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  useEffect(() => {
    getSocket();
  }, []);

  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/ai" element={<AIControl />} />
        <Route path="/music" element={<Music />} />
        <Route path="/calls" element={<Calls />} />
        <Route path="/users" element={<Users />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
