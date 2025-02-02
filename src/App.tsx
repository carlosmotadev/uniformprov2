import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { NovaOS } from './pages/NovaOS';
import { ListaOS } from './pages/ListaOS';
import { EditarOS } from './pages/EditarOS';
import { RecebimentosParciais } from './pages/RecebimentosParciais';
import { Login } from './pages/Login';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="os/nova" element={<NovaOS />} />
            <Route path="os/lista" element={<ListaOS />} />
            <Route path="os/editar/:id" element={<EditarOS />} />
            <Route path="recebimentos" element={<RecebimentosParciais />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}