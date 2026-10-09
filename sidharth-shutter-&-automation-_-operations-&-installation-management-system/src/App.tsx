import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { AdminPortal } from './components/portals/AdminPortal';
import { SalespersonPortal } from './components/portals/SalespersonPortal';
import { SupervisorPortal } from './components/portals/SupervisorPortal';
import { LogisticsPortal } from './components/portals/LogisticsPortal';
import { BudgetManagerPortal } from './components/portals/BudgetManagerPortal';
import { WorkerPortal } from './components/portals/WorkerPortal';

const AppShell: React.FC = () => {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Automatically sync primary tab when user switches role
  useEffect(() => {
    switch (currentUser.role) {
      case 'admin':
        setActiveTab('dashboard');
        break;
      case 'salesperson':
        setActiveTab('my_sales');
        break;
      case 'supervisor':
        setActiveTab('new_requests');
        break;
      case 'logistics':
      case 'production':
        setActiveTab('production_tracking');
        break;
      case 'budget':
        setActiveTab('budget_allocation');
        break;
      case 'worker':
        setActiveTab('my_work');
        break;
      default:
        setActiveTab('dashboard');
    }
  }, [currentUser.role]);

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-slate-800 flex flex-col font-sans selection:bg-[#10418A] selection:text-white">
      {/* Top Navigation Bar with Top Bar Contract */}
      <TopNav />

      {/* Main Body: Sidebar + Dynamic Portal Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-[#F4F7FC] relative">
          {currentUser.role === 'admin' && <AdminPortal activeTab={activeTab} />}
          {currentUser.role === 'salesperson' && <SalespersonPortal activeTab={activeTab} />}
          {currentUser.role === 'supervisor' && <SupervisorPortal activeTab={activeTab} />}
          {(currentUser.role === 'logistics' || currentUser.role === 'production') && (
            <LogisticsPortal activeTab={activeTab} />
          )}
          {currentUser.role === 'budget' && <BudgetManagerPortal activeTab={activeTab} />}
          {currentUser.role === 'worker' && <WorkerPortal activeTab={activeTab} />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
