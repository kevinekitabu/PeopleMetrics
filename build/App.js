import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import AuthProvider from './components/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import SubscriptionCheck from './components/SubscriptionCheck';
function App() {
    return (_jsx(Router, { children: _jsxs(AuthProvider, { children: [_jsx(Toaster, { position: "top-right" }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Landing, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(SubscriptionCheck, { children: _jsx(Dashboard, {}) }) }) })] })] }) }));
}
export default App;
