import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { getToken } from "./auth";
import { TooltipProvider } from "./components/ui/tooltip";
import { UserProvider } from "./context/UserContext";
import DocumentEditor from "./pages/DocumentEditor";
import Home from "./pages/Home";
import Login from "./pages/Login";

function RequireAuth({ children }: { children: React.ReactElement }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <UserProvider>
      <TooltipProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/doc/:id"
            element={
              <RequireAuth>
                <DocumentEditor />
              </RequireAuth>
            }
          />
        </Routes>
      </TooltipProvider>
    </UserProvider>
  );
}
