import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import RequirePermission from './components/common/RequirePermission';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import Home from './pages/public/Home';
import About from './pages/public/About';
import Staff from './pages/public/Staff';
import Contact from './pages/public/Contact';
import Placeholder from './pages/public/Placeholder';
import Login from './pages/auth/Login';
import ConsoleHome from './pages/console/ConsoleHome';
import Console from './pages/console/Console';
import DashboardHome from './pages/dashboard/DashboardHome';
import Profile from './pages/dashboard/Profile';
import ModulePlaceholder from './pages/dashboard/ModulePlaceholder';
import FarmerList from './pages/dashboard/farmers/FarmerList';
import FarmerForm from './pages/dashboard/farmers/FarmerForm';
import FarmerDetail from './pages/dashboard/farmers/FarmerDetail';
import FarmerRecord from './pages/dashboard/farmers/FarmerRecord';
import DataCenter from './pages/datacenter/DataCenter';
import ResearchLab from './pages/research/ResearchLab';
import SurveyHome from './pages/datacenter/SurveyHome';
import SurveyForm from './pages/datacenter/SurveyForm';
import SmartFarmingOverview from './pages/smartfarming/SmartFarmingOverview';
import SiteDetail from './pages/smartfarming/SiteDetail';
import DeviceDetail from './pages/smartfarming/DeviceDetail';
import UnitControlCenter from './pages/smartfarming/UnitControlCenter';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
          </Route>

          <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<DashboardHome />} />
            <Route path="profile" element={<Profile />} />
            <Route path="farmers" element={<RequirePermission perm="farmers.view"><FarmerList /></RequirePermission>} />
            <Route path="farmers/new" element={<RequirePermission perm="farmers.create"><FarmerForm /></RequirePermission>} />
            <Route path="farmers/:id" element={<RequirePermission perm="farmers.view"><FarmerRecord /></RequirePermission>} />
            <Route path="farmers/:id/edit" element={<RequirePermission perm="farmers.update"><FarmerForm /></RequirePermission>} />
            <Route path="smart-farming" element={<RequirePermission perm="smart_farming.view"><SmartFarmingOverview /></RequirePermission>} />
            <Route path="smart-farming/sites/:id" element={<RequirePermission perm="smart_farming.view"><SiteDetail /></RequirePermission>} />
            <Route path="smart-farming/units/:id" element={<RequirePermission perm="smart_farming.view"><UnitControlCenter /></RequirePermission>} />
            <Route path="smart-farming/devices/:id" element={<RequirePermission perm="devices.view"><DeviceDetail /></RequirePermission>} />
            <Route path="data-center/survey" element={<RequirePermission perm="datacenter.collect"><SurveyHome /></RequirePermission>} />
            <Route path="data-center/survey/:id" element={<RequirePermission perm="datacenter.collect"><SurveyForm /></RequirePermission>} />
            <Route path="research" element={<RequirePermission perm="research.view"><ResearchLab /></RequirePermission>} />
            <Route path="data-center" element={<RequirePermission perm="datacenter.view"><DataCenter /></RequirePermission>} />
            <Route path="console" element={<RequirePermission perm="smart_farming.view"><ConsoleHome /></RequirePermission>} />
            <Route path="console/:id" element={<RequirePermission perm="smart_farming.view"><Console /></RequirePermission>} />
            <Route path="*" element={<ModulePlaceholder />} />
          </Route>

          <Route element={<PublicLayout />}>
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
















