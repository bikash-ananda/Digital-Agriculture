import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/common/ProtectedRoute';
import RequirePermission from './components/common/RequirePermission';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import { UiExperienceProvider } from './components/common/UiExperience';
const Home = lazy(() => import('./pages/public/Home'));
const Contact = lazy(() => import('./pages/public/Contact'));
const VideoGallery = lazy(() => import('./pages/public/VideoGallery'));
const Placeholder = lazy(() => import('./pages/public/Placeholder'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const ChangePassword = lazy(() => import('./pages/auth/ChangePassword'));
const AdminUsers = lazy(() => import('./pages/dashboard/AdminUsers'));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const ModulePlaceholder = lazy(() => import('./pages/dashboard/ModulePlaceholder'));
const FarmerList = lazy(() => import('./pages/dashboard/farmers/FarmerList'));
const FarmerForm = lazy(() => import('./pages/dashboard/farmers/FarmerForm'));
const FarmerRecord = lazy(() => import('./pages/dashboard/farmers/FarmerRecord'));
const KnowledgeCenter = lazy(() => import('./pages/dashboard/KnowledgeCenter'));
const SurveyHome = lazy(() => import('./pages/datacenter/SurveyHome'));
const SurveyForm = lazy(() => import('./pages/datacenter/SurveyForm'));
const SmartFarmingOverview = lazy(() => import('./pages/smartfarming/SmartFarmingOverview'));
const SmartFarmingChat = lazy(() => import('./pages/smartfarming/SmartFarmingChat'));
const SiteDetail = lazy(() => import('./pages/smartfarming/SiteDetail'));
const DeviceDetail = lazy(() => import('./pages/smartfarming/DeviceDetail'));
const UnitControlCenter = lazy(() => import('./pages/smartfarming/UnitControlCenter'));
const SmartFarmingHome = lazy(() => import('./pages/smartfarming/public/SmartFarmingHome'));
const FarmingAssistant = lazy(() => import('./pages/smartfarming/public/FarmingAssistant'));
const CropDoctor = lazy(() => import('./pages/smartfarming/public/CropDoctor'));
const WeatherAdvisory = lazy(() => import('./pages/smartfarming/public/WeatherAdvisory'));
const CropGuides = lazy(() => import('./pages/smartfarming/public/CropGuides'));
const SeasonalPlanner = lazy(() => import('./pages/smartfarming/public/SeasonalPlanner'));
const AgricultureServices = lazy(() => import('./pages/smartfarming/public/AgricultureServices'));
const ConsoleHome = lazy(() => import('./pages/console/ConsoleHome'));
const Console = lazy(() => import('./pages/console/Console'));
const DataCenter = lazy(() => import('./pages/datacenter/DataCenter'));
const Programs = lazy(() => import('./pages/dashboard/Programs'));
const Notices = lazy(() => import('./pages/dashboard/Notices'));
const Reports = lazy(() => import('./pages/dashboard/Reports'));
const FarmRegistry = lazy(() => import('./pages/dashboard/FarmRegistry'));

const REMOVED_PUBLIC_PATHS = [
  '/notices', '/about', '/objectives', '/staff', '/citizen-charter', '/organizational-structure',
  '/act-and-policies', '/directory', '/procedures', '/criteria', '/book', '/format', '/journal',
  '/program-and-progress', '/bulletin', '/right-to-information'
];

function DocumentLanguage() {
  const { i18n } = useTranslation();
  useEffect(() => { document.documentElement.lang = i18n.language === 'ne' ? 'ne' : 'en'; }, [i18n.language]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UiExperienceProvider>
        <DocumentLanguage />
        <Suspense fallback={<div role="status" className="mx-auto max-w-4xl p-8 text-center text-terrace-800">Loading…</div>}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/video-gallery" element={<VideoGallery />} />
            {REMOVED_PUBLIC_PATHS.map((path) => <Route key={path} path={path} element={<Navigate to="/" replace />} />)}
            <Route path="/knowledge" element={<KnowledgeCenter />} />
            <Route path="/learning/*" element={<Navigate to="/knowledge?tab=training" replace />} />
            <Route path="/smart-farming" element={<SmartFarmingHome />} />
            <Route path="/smart-farming/assistant" element={<FarmingAssistant />} />
            <Route path="/smart-farming/crop-doctor" element={<CropDoctor />} />
            <Route path="/smart-farming/weather" element={<WeatherAdvisory />} />
            <Route path="/smart-farming/crop-guides" element={<CropGuides />} />
            <Route path="/smart-farming/planner" element={<SeasonalPlanner />} />
            <Route path="/smart-farming/services" element={<AgricultureServices />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          </Route>

          <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<DashboardHome />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<RequirePermission perm="users.view"><AdminUsers /></RequirePermission>} />
            <Route path="farmers" element={<RequirePermission perm="farmers.view"><FarmerList /></RequirePermission>} />
            <Route path="farms" element={<RequirePermission perm="farms.view"><FarmRegistry /></RequirePermission>} />
            <Route path="farmers/new" element={<RequirePermission perm="farmers.create"><FarmerForm /></RequirePermission>} />
            <Route path="farmers/:id" element={<RequirePermission perm="farmers.view"><FarmerRecord /></RequirePermission>} />
            <Route path="farmers/:id/edit" element={<RequirePermission perm="farmers.update"><FarmerForm /></RequirePermission>} />
            <Route path="smart-farming" element={<RequirePermission perm="smart_farming.view"><SmartFarmingOverview /></RequirePermission>} />
            <Route path="smart-farming/chat" element={<RequirePermission perm="smart_farming.view"><SmartFarmingChat /></RequirePermission>} />
            <Route path="smart-farming/sites/:id" element={<RequirePermission perm="smart_farming.view"><SiteDetail /></RequirePermission>} />
            <Route path="smart-farming/units/:id" element={<RequirePermission perm="smart_farming.view"><UnitControlCenter /></RequirePermission>} />
            <Route path="smart-farming/monitoring/:id" element={<RequirePermission perm="smart_farming.view"><Console /></RequirePermission>} />
            <Route path="smart-farming/devices/:id" element={<RequirePermission perm="devices.view"><DeviceDetail /></RequirePermission>} />
            <Route path="data-center/survey" element={<RequirePermission perm="datacenter.collect"><SurveyHome /></RequirePermission>} />
            <Route path="data-center/survey/:id" element={<RequirePermission perm="datacenter.collect"><SurveyForm /></RequirePermission>} />
            <Route path="research" element={<RequirePermission perm="research.view"><Navigate to="/app/knowledge?tab=research" replace /></RequirePermission>} />
            <Route path="knowledge" element={<RequirePermission perm="knowledge.view"><KnowledgeCenter /></RequirePermission>} />
            <Route path="programs" element={<RequirePermission perm="programs.view"><Programs /></RequirePermission>} />
            <Route path="notices" element={<RequirePermission perm="notices.view"><Notices /></RequirePermission>} />
            <Route path="learning/*" element={<RequirePermission perm="knowledge.view"><Navigate to="/app/knowledge?tab=training" replace /></RequirePermission>} />
            <Route path="documents" element={<RequirePermission perm="documents.view"><Navigate to="/app/knowledge?tab=library" replace /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission perm="reports.view"><Reports /></RequirePermission>} />
            <Route path="data-center" element={<RequirePermission perm="datacenter.view"><DataCenter /></RequirePermission>} />
            <Route path="console" element={<RequirePermission perm="smart_farming.view"><ConsoleHome /></RequirePermission>} />
            <Route path="console/:id" element={<RequirePermission perm="smart_farming.view"><Console /></RequirePermission>} />
            <Route path="*" element={<ModulePlaceholder />} />
          </Route>

          <Route element={<PublicLayout />}><Route path="*" element={<Placeholder />} /></Route>
        </Routes>
        </Suspense>
        </UiExperienceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
