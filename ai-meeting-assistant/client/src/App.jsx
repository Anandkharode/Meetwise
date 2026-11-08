import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import MeetingDetails from './pages/MeetingDetails.jsx';
import MeetingForm from './pages/MeetingForm.jsx';
import Meetings from './pages/Meetings.jsx';
import Placeholder from './pages/Placeholder.jsx';
import Register from './pages/Register.jsx';
import TaskReference from './pages/TaskReference.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/meetings/upload" element={<MeetingForm initialTab="audio" />} />
          <Route path="/meetings/new" element={<MeetingForm />} />
          <Route path="/meetings/:meetingId" element={<MeetingDetails />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/tasks/:taskId" element={<TaskReference />} />
          <Route path="/tasks" element={<Placeholder />} />
          <Route path="/settings" element={<Placeholder />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
