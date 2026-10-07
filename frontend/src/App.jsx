import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout';
import Home from './pages/public/Home';
import Placeholder from './pages/public/Placeholder';
import Login from './pages/auth/Login';

const pages = ['about','notices','programs','knowledge','smart-farming','learning','downloads','gallery','contact'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          {pages.map(p => <Route key={p} path={`/${p}`} element={<Placeholder />} />)}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
