import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { I18nProvider } from '../i18n';
import { SuccessFeedbackProvider } from '../ui';
import { routes } from './routes';
import { UpdateBanner } from './UpdateBanner';

export function App() {
  return (
    <I18nProvider>
      <SuccessFeedbackProvider>
        <BrowserRouter>
          <UpdateBanner />
          <AppRoutes />
        </BrowserRouter>
      </SuccessFeedbackProvider>
    </I18nProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {routes.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
