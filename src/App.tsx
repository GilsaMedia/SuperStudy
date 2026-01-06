import React from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import AuthGate from './pages/AuthGate';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { FirebaseAuthProvider, ProtectedRoute, StudentRoute } from './context/FirebaseAuth';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import StudentHelp from './pages/StudentHelp';
import TeacherLayout from './pages/teacher/TeacherLayout';
import TeacherStudents from './pages/teacher/TeacherStudents';
import TeacherProfile from './pages/teacher/TeacherProfile';
import { Navigate } from 'react-router-dom';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentFindTeachers from './pages/student/StudentFindTeachers';
import StudentMyTeachers from './pages/student/StudentMyTeachers';

function App() {
  return (
    <FirebaseAuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthGate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/help" element={<StudentHelp />} />
        <Route path="/student-dashboard" element={<StudentRoute><StudentDashboard /></StudentRoute>} />
        <Route path="/student/teachers" element={<StudentRoute><StudentFindTeachers /></StudentRoute>} />
        <Route path="/student/my-teachers" element={<StudentRoute><StudentMyTeachers /></StudentRoute>} />
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<Navigate to="/teacher/students" replace />} />
          <Route path="students" element={<TeacherStudents />} />
          <Route path="profile" element={<TeacherProfile />} />
        </Route>
      </Routes>
    </FirebaseAuthProvider>
  );
}

export default App;