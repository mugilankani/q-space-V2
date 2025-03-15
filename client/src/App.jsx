import { Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Footer from "./components/footer";
import "./App.css";

import Landing from "./pages/landing";
import New from "./pages/new";
import QuizPage from "./pages/quiz-page";

const ProtectedRoute = ({ element }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? element : <Navigate to="/" />;
};

const LoginRedirect = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/new" /> : <Landing />;
};

const routes = [
  { path: "/", element: <LoginRedirect /> },
  { path: "/new", element: <ProtectedRoute element={<New />} /> },
  { path: "/q/:id", element: <ProtectedRoute element={<QuizPage />} /> },
];

function App() {
  return (
    <AuthProvider>
      <Routes>
        {routes.map((route, index) => (
          <Route key={index} path={route.path} element={route.element} />
        ))}
      </Routes>
      <Footer />
    </AuthProvider>
  );
}

export default App;
