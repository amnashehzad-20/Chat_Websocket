import { Routes, Route, Navigate } from 'react-router-dom';
import LoginSignupPage from './pages/signup_login';
import ChatComponent from './pages/chat';
import "./index.css"


function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" replace />;
}

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/chat" /> : <LoginSignupPage />}
      />
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <ChatComponent />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
