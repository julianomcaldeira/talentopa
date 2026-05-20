import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type UserRole = "admin" | "consultor" | "empresa" | "canal";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to the appropriate dashboard based on role
    const redirectMap: Record<UserRole, string> = {
      admin: "/admin",
      consultor: "/consultor",
      empresa: "/empresa",
      canal: "/canal",
    };
    return <Navigate to={redirectMap[role] || "/"} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
