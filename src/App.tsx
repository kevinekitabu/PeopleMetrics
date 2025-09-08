import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Auth0Login from './pages/Auth0Login';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import { Auth0ContextProvider } from './contexts/Auth0Context';
import Auth0AuthProvider from './components/Auth0AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Auth0ContextProvider>
          <Auth0AuthProvider>
            <Toaster 
              position="top-right"
              toastOptions={{
                className: 'dark:bg-gray-800 dark:text-white'
              }}
            />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth0-login" element={<Auth0Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Auth0AuthProvider>
        </Auth0ContextProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;