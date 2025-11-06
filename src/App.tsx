import React from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import AuthGate from './pages/AuthGate';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { FirebaseAuthProvider, ProtectedRoute } from './context/FirebaseAuth';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import StudentHelp from './pages/StudentHelp';

function App() {
  return (
    <FirebaseAuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthGate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/help" element={<ProtectedRoute><StudentHelp /></ProtectedRoute>} />
      </Routes>
    </FirebaseAuthProvider>
  );
}

export default App;