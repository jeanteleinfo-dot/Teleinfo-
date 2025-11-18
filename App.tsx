
import React, { useState, useCallback } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, GanttChartSquare, Presentation } from 'lucide-react';
import DashboardView from './components/DashboardView';
import MonitoringView from './components/MonitoringView';
import PresentationView from './components/PresentationView';
import type { Project } from './types';

const App: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [fileName, setFileName] = useState<string>('');

    const handleDataLoaded = useCallback((data: Project[], name: string) => {
        setProjects(data);
        setFileName(name);
    }, []);

    const NavButton: React.FC<{ to: string; icon: React.ReactNode; children: React.ReactNode }> = ({ to, icon, children }) => {
        const location = useLocation();
        const isActive = location.pathname === to;
        return (
            <NavLink
                to={to}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${
                    isActive
                        ? 'text-teleinfo-blue border-teleinfo-blue'
                        : 'text-dark-text-secondary border-transparent hover:text-white hover:border-teleinfo-blue/50'
                }`}
            >
                {icon}
                {children}
            </NavLink>
        );
    };

    return (
        <HashRouter>
            <div className="min-h-screen bg-dark-bg text-dark-text font-sans">
                <header className="bg-dark-card border-b border-dark-border sticky top-0 z-50">
                    <nav className="max-w-7xl mx-auto px-4">
                        <div className="flex items-center justify-between h-16">
                           <div className="flex items-center gap-2">
                             <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-label="Teleinfo AI logo" role="img" className="w-10 h-8">
                                 <defs>
                                     <mask id="teleinfo-logo-mask-header">
                                         <rect width="100" height="80" fill="white" />
                                         <circle cx="60" cy="40" r="15" fill="black" />
                                         <rect x="80" y="25" width="20" height="30" fill="black" />
                                     </mask>
                                 </defs>
                                 <rect x="0" y="32.5" width="70" height="15" fill="#10B981"/>
                                 <circle cx="60" cy="40" r="30" fill="#0B5ED7" mask="url(#teleinfo-logo-mask-header)"/>
                                 <rect x="60" y="32.5" width="8" height="15" fill="#F97316"/>
                             </svg>
                           </div>
                           <div className="flex items-center space-x-2">
                                <NavButton to="/" icon={<LayoutDashboard size={18}/>}>Painel</NavButton>
                                <NavButton to="/monitoring" icon={<GanttChartSquare size={18}/>}>Monitoramento</NavButton>
                                <NavButton to="/presentation" icon={<Presentation size={18}/>}>Apresentação</NavButton>
                           </div>
                        </div>
                    </nav>
                </header>
                <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                    <Routes>
                        <Route path="/" element={<DashboardView projects={projects} onDataLoaded={handleDataLoaded} fileName={fileName} />} />
                        <Route path="/monitoring" element={<MonitoringView />} />
                        <Route path="/presentation" element={<PresentationView allProjects={projects} />} />
                    </Routes>
                </main>
            </div>
        </HashRouter>
    );
};

export default App;
