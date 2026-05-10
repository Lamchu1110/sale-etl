import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PrivateRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ width:36, height:36, border:'3px solid #E2E8F0', borderTopColor:'#4F46E5',
        borderRadius:'50%', animation:'spin .7s linear infinite' }} />
    </div>
  );
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
