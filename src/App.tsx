/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { Auth } from './pages/Auth';
import { WaitingApproval } from './pages/WaitingApproval';
import { Dashboard } from './pages/Dashboard';
import { ServiceOrders } from './pages/ServiceOrders';
import { UserManagement } from './pages/UserManagement';
import { FinancialPanel } from './pages/FinancialPanel';
import { Customers } from './pages/Customers';
import { Machines } from './pages/Machines';
import { Rentals } from './pages/Rentals';
import { Estoque } from './pages/Estoque';
import { MaterialEntries } from './pages/MaterialEntries';
import { Suppliers } from './pages/Suppliers';
import { Layout } from './components/Layout';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/waiting-approval" element={<WaitingApproval />} />
          
          {/* Protected Area */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/os" element={<ServiceOrders />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/rentals" element={<Rentals />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/entradas" element={<MaterialEntries />} />
              <Route path="/fornecedores" element={<Suppliers />} />
              
              {/* Admin Only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<UserManagement />} />
                <Route path="/finance" element={<FinancialPanel />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// forced sync
