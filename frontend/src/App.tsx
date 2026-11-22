import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Onboarding from "./pages/Onboarding";
import Scanner from "./pages/Scanner";
import PaymentDetails from "./pages/PaymentDetails";
import ReceiptDetail from "./pages/ReceiptDetail";
import Terms from "./pages/Terms";
import Policy from "./pages/Policy";
import Integrations from "./pages/Integrations";
import { useState } from "react";
import {
  AuthProvider,
  consumeReturnTo,
  useAuth,
} from "./contexts/AuthContext";
import { TeamProvider } from "./contexts/TeamContext";

const LoadingScreen = () => (
  <div
    className="page-enter"
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    Loading...
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const RootRoute = () => {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return session ? <Home /> : <Landing />;
};

const PostLoginRedirect = () => {
  const [returnTo] = useState(consumeReturnTo);
  return <Navigate to={returnTo} replace />;
};

const LegacyReceiptRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/receipt/${id}` : "/"} replace />;
};

function App() {
  return (
    <AuthProvider>
      <TeamProvider>
        <BrowserRouter>
          <div className="app-container">
            <Routes>
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/auth/login" element={<PostLoginRedirect />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/r/:id" element={<LegacyReceiptRedirect />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ProtectedRoute>
                    <Scanner />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payments"
                element={
                  <ProtectedRoute>
                    <PaymentDetails />
                  </ProtectedRoute>
                }
              />
              <Route path="/receipt/:id" element={<ReceiptDetail />} />
              <Route path="/" element={<RootRoute />} />
              <Route
                path="/integrations"
                element={
                  <ProtectedRoute>
                    <Integrations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/webhooks"
                element={<Navigate to="/integrations" replace />}
              />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TeamProvider>
    </AuthProvider>
  );
}

export default App;
