import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import DigitalLibraryPage from './pages/DigitalLibraryPage';
import SelfEvaluationPage from './pages/SelfEvaluationPage';
import SchoolPage from './pages/SchoolPage';
import IndicatorPage from './pages/IndicatorPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import UsersManagementPage from './pages/UsersManagementPage';
import EvidenceReviewPage from './pages/EvidenceReviewPage';
import StructureManagementPage from './pages/StructureManagementPage';
import StandalonePreviewPage from './pages/StandalonePreviewPage';
import AppHeader from './components/AppHeader';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: string }) {
  const { user, loading, isMember, isAdmin } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (role === 'member' && !isMember) return <div className="p-8 text-center text-red-600 font-bold">بانتظار اعتماد حسابك من قبل الإدارة</div>;
  if (role === 'admin' && !isAdmin) return <Navigate to="/" />;

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isStandaloneViewer = location.pathname === '/view-file';

  if (isStandaloneViewer) {
    return <StandalonePreviewPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans" dir="rtl">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/library" element={<DigitalLibraryPage />} />
          <Route path="/evaluation" element={<SelfEvaluationPage />} />
          <Route path="/school/:schoolId" element={<SchoolPage />} />
          <Route path="/school/:schoolId/indicator/:indicatorId" element={<IndicatorPage />} />
          <Route path="/indicator/:indicatorId" element={<IndicatorPage />} />
          
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/users" element={
            <ProtectedRoute role="admin">
              <UsersManagementPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/evidence" element={
            <ProtectedRoute role="admin">
              <EvidenceReviewPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/structure" element={
            <ProtectedRoute role="admin">
              <StructureManagementPage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
      <footer className="bg-slate-900 text-white p-6 text-center text-sm border-t border-slate-800">
        <p>مكتبة مجمع الشفا التعليمي &copy; 2026</p>
        <p className="mt-2 text-slate-400">بوابة المكتبة الرقمية والتقويم وشواهد الأداء المدرسي</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
