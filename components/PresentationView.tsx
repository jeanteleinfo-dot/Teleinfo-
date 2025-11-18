
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Project, KeyFact, NextStep, DetailedProject } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Trash2, Download, Tv, ArrowLeft, ArrowRight, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const statusColors: { [key: string]: { pill: string; chart: string } } = {
    'FINALIZADO': { pill: 'bg-green-500/10 text-green-400', chart: '#22c55e' },
    'EM ANDAMENTO': { pill: 'bg-blue-500/10 text-blue-400', chart: '#3b82f6' },
    'PARALIZADO': { pill: 'bg-red-500/10 text-red-400', chart: '#ef4444' },
    'NÃO INICIADO': { pill: 'bg-yellow-500/10 text-yellow-400', chart: '#eab308' },
    'DEFAULT': { pill: 'bg-gray-500/10 text-gray-400', chart: '#6b7280' },
};

const normalizeStatus = (status: any): string => {
    if (!status) return "";
    return status.toString().trim().toUpperCase();
};

const getStatusChartColor = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized.startsWith("FINALIZADO")) return statusColors['FINALIZADO'].chart;
    if (normalized.startsWith("EM ANDAMENTO")) return statusColors['EM ANDAMENTO'].chart;
    if (normalized.startsWith("PARALIZADO")) return statusColors['PARALIZADO'].chart;
    if (normalized.startsWith("NÃO INICIADO")) return statusColors['NÃO INICIADO'].chart;
    return statusColors['DEFAULT'].chart;
};

const getBuChartColor = (bu: string): string => {
    const normalized = bu.trim().toUpperCase();
    if (normalized.includes('INFRAESTRUTURA')) return '#f97316';
    if (normalized.includes('SEGURANÇA')) return '#10b981';
    if (normalized.includes('TI')) return '#0b5ed7';
    if (normalized.includes('AUTOMAÇÃO')) return '#6b7280';
    return '#8b949e';
};

// Custom hook for localStorage
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.log(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.log(error);
        }
    };

    return [storedValue, setValue];
};

const Slide: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-white text-gray-800 p-10 rounded-lg shadow-2xl print-slide aspect-[16/9] w-full flex flex-col ${className || ''}`}>{children}</div>
);

interface PresentationViewProps {
    allProjects: Project[];
}

const PresentationView: React.FC<PresentationViewProps> = ({ allProjects }) => {
    const [keyFacts, setKeyFacts] = useLocalStorage<KeyFact[]>('teleinfo_keyfacts', []);
    const [nextSteps, setNextSteps] = useLocalStorage<NextStep[]>('teleinfo_nextsteps', []);
    const [detailedProjects] = useLocalStorage<DetailedProject[]>('teleinfo_detailed_projects', []);
    const [newFactText, setNewFactText] = useState('');
    const [newFactLogo, setNewFactLogo] = useState('');
    const [newNextStepProject, setNewNextStepProject] = useState('');
    const [newNextStepDesc, setNewNextStepDesc] = useState('');
    const [isSlideMode, setIsSlideMode] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    const portfolioSummary = useMemo(() => {
        const data = allProjects;
        let finished = 0, inProgress = 0, paralyzed = 0, notStarted = 0;
        const statusCounts: { [key: string]: number } = {};
        const buCounts: { [key: string]: number } = {};
        
        data.forEach(p => {
            const s = p.STATUS;
            if (s.startsWith("FINALIZADO")) finished++;
            else if (s.startsWith("EM ANDAMENTO")) inProgress++;
            else if (s.startsWith("PARALIZADO")) paralyzed++;
            else if (s.startsWith("NÃO INICIADO")) notStarted++;

            const status = s || "N/A";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            const bu = p.BUs || "N/A";
            buCounts[bu] = (buCounts[bu] || 0) + 1;
        });

        const percValues = data.map(p => p.perc).filter((v): v is number => typeof v === 'number');
        const avg = percValues.length ? percValues.reduce((a, b) => a + b, 0) / percValues.length : 0;
        
        return {
            total: data.length, avgPercent: `${avg.toFixed(1)}%`, finished, inProgress, paralyzed, notStarted,
            statusChartData: Object.entries(statusCounts).map(([name, value]) => ({ name, Projetos: value, color: getStatusChartColor(name) })),
            buChartData: Object.entries(buCounts).map(([name, value]) => ({ name, Projetos: value, color: getBuChartColor(name) })),
        };
    }, [allProjects]);

    const addKeyFact = () => {
        if (!newFactText.trim()) return;
        setKeyFacts([...keyFacts, { id: Date.now().toString(), text: newFactText, logoUrl: newFactLogo }]);
        setNewFactText('');
        setNewFactLogo('');
    };
    const removeKeyFact = (id: string) => setKeyFacts(keyFacts.filter(f => f.id !== id));

    const addNextStep = () => {
        if (!newNextStepProject.trim() || !newNextStepDesc.trim()) return;
        setNextSteps([...nextSteps, { id: Date.now().toString(), project: newNextStepProject, description: newNextStepDesc }]);
        setNewNextStepProject('');
        setNewNextStepDesc('');
    };
    const removeNextStep = (id: string) => setNextSteps(nextSteps.filter(s => s.id !== id));
    
    const generatePdf = () => {
        const element = document.getElementById('presentation-content');
        const opt = {
            margin: 0,
            filename: 'Relatorio_De_Status_Teleinfo.pdf',
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' as const }
        };
        html2pdf().from(element).set(opt).save();
    };

    const slides = useMemo(() => [
        // Cover Slide
        <Slide key="cover" className="relative overflow-hidden !p-0">
             <div className="absolute w-[800px] h-[1000px] bg-teleinfo-blue rounded-[400px] transform rotate-[-25deg] top-[-250px] right-[-350px]"></div>
             <div className="absolute w-[800px] h-[500px] bg-teleinfo-green rounded-[250px] transform rotate-[-25deg] bottom-[-300px] right-[-200px]"></div>
             <div className="relative z-10 flex flex-col justify-between h-full p-10">
                 <div>
                     <div className="flex items-center gap-3">
                         <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-label="Teleinfo AI logo" role="img" className="w-10 h-8">
                             <defs>
                                 <mask id="teleinfo-logo-mask-presentation-cover">
                                     <rect width="100" height="80" fill="white" />
                                     <circle cx="60" cy="40" r="15" fill="black" />
                                     <rect x="80" y="25" width="20" height="30" fill="black" />
                                 </mask>
                             </defs>
                             <rect x="0" y="32.5" width="70" height="15" fill="#10B981"/>
                             <circle cx="60" cy="40" r="30" fill="#0B5ED7" mask="url(#teleinfo-logo-mask-presentation-cover)"/>
                             <rect x="60" y="32.5" width="8" height="15" fill="#F97316"/>
                         </svg>
                         <span className="text-xl font-semibold text-gray-700">Escritório de Projetos</span>
                     </div>
                     <div className="mt-16">
                         <p className="text-2xl font-semibold text-gray-800">Status Report</p>
                         <div className="flex items-center -ml-1 mt-1 font-bold text-black text-8xl tracking-tighter">
                             <span>tel</span>
                             <div className="relative inline-block text-teleinfo-blue">
                                 <span>e</span>
                                 <span className="absolute top-1/2 left-[-1.5rem] w-6 h-4 bg-teleinfo-green -translate-y-1/2 z-0"></span>
                                 <span className="absolute top-1/2 left-[2.2rem] w-2.5 h-4 bg-teleinfo-orange -translate-y-1/2 z-20"></span>
                             </div>
                             <span>info</span>
                         </div>
                         <p className="text-lg text-gray-500 tracking-[0.2em] mt-2">TECNOLOGIA INTEGRADA</p>
                     </div>
                 </div>
                 <div className="self-start">
                     <p className="text-lg text-gray-500">{new Date().toLocaleDateString('pt-BR')}</p>
                 </div>
             </div>
        </Slide>,
        // Key Facts Slide
        <Slide key="key-facts">
            <h2 className="text-3xl font-bold text-teleinfo-blue mb-6">Fatos Relevantes do Período</h2>
            <div className={`grid grid-cols-1 ${!isSlideMode ? 'md:grid-cols-2' : ''} gap-6 flex-grow items-center`}>
                <div className={isSlideMode ? 'max-w-3xl mx-auto w-full' : ''}>
                    {keyFacts.length > 0 ? (
                        <ul className="space-y-4">
                            {keyFacts.map(fact => (
                                <li key={fact.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                                    {fact.logoUrl && <img src={fact.logoUrl} alt="logo" className="w-10 h-10 object-contain"/>}
                                    <span className="flex-grow">{fact.text}</span>
                                    {!isSlideMode && (
                                        <button onClick={() => removeKeyFact(fact.id)} className="text-red-500 hover:text-red-400 p-1 rounded-full bg-red-500/10">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">Nenhum fato relevante adicionado.</p>
                    )}
                </div>
                {!isSlideMode && (
                    <div className="bg-gray-100 p-4 rounded-lg self-start">
                        <h3 className="font-semibold mb-2">Adicionar Fato Relevante</h3>
                        <input type="text" value={newFactText} onChange={e => setNewFactText(e.target.value)} placeholder="Descrição do fato" className="w-full border-gray-300 rounded-md p-2 mb-2"/>
                        <input type="text" value={newFactLogo} onChange={e => setNewFactLogo(e.target.value)} placeholder="URL do logo (opcional)" className="w-full border-gray-300 rounded-md p-2 mb-2"/>
                        <button onClick={addKeyFact} className="bg-teleinfo-blue text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 transition-colors w-full justify-center">
                            <Plus size={16}/> Adicionar
                        </button>
                    </div>
                )}
            </div>
        </Slide>,
        // Portfolio Summary Slide
        <Slide key="portfolio-summary">
            <h2 className="text-3xl font-bold text-teleinfo-blue mb-6">Visão Geral do Portfólio</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-500">Projetos Totais</p><p className="text-2xl font-bold">{portfolioSummary.total}</p></div>
                <div className="bg-orange-100 p-4 rounded-lg text-center"><p className="text-sm text-orange-700">Projetos Monitorados</p><p className="text-2xl font-bold text-orange-800">{detailedProjects.length}</p></div>
                <div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-500">Média Conclusão</p><p className="text-2xl font-bold">{portfolioSummary.avgPercent}</p></div>
                <div className="bg-green-100 p-4 rounded-lg text-center"><p className="text-sm text-green-700">Finalizados</p><p className="text-2xl font-bold text-green-800">{portfolioSummary.finished}</p></div>
                <div className="bg-blue-100 p-4 rounded-lg text-center"><p className="text-sm text-blue-700">Em Andamento</p><p className="text-2xl font-bold text-blue-800">{portfolioSummary.inProgress}</p></div>
                <div className="bg-red-100 p-4 rounded-lg text-center"><p className="text-sm text-red-700">Paralisados</p><p className="text-2xl font-bold text-red-800">{portfolioSummary.paralyzed}</p></div>
                <div className="bg-yellow-100 p-4 rounded-lg text-center"><p className="text-sm text-yellow-700">Não Iniciados</p><p className="text-2xl font-bold text-yellow-800">{portfolioSummary.notStarted}</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-80">
                 <div>
                    <h3 className="font-semibold text-center mb-2">Projetos por Status</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={portfolioSummary.statusChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="Projetos">
                                {portfolioSummary.statusChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div>
                    <h3 className="font-semibold text-center mb-2">Projetos por Unidade de Negócio</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={portfolioSummary.buChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="Projetos">
                                {portfolioSummary.buChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                </div>
            </div>
        </Slide>,
        // Detailed Projects Slides
        ...detailedProjects.map(proj => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startDate = proj.start ? new Date(proj.start + 'T00:00:00') : null;
            const endDate = proj.end ? new Date(proj.end + 'T00:00:00') : null;

            const overallProgress = proj.steps.length > 0 
                ? proj.steps.reduce((acc, s) => acc + s.perc, 0) / proj.steps.length 
                : 0;

            let timelineInfo = { progress: 0, text: "Datas não definidas" };

            if (startDate && endDate && startDate <= endDate) {
                const totalDuration = endDate.getTime() - startDate.getTime();
                const elapsedDuration = today.getTime() - startDate.getTime();
                
                const progress = totalDuration > 0 ? Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100)) : (today >= endDate ? 100 : 0);

                const oneDay = 1000 * 60 * 60 * 24;
                const remainingDays = Math.ceil((endDate.getTime() - today.getTime()) / oneDay);
                
                let text = "";
                if (today.getTime() > endDate.getTime()) {
                    const daysPast = Math.abs(remainingDays);
                    text = daysPast === 0 ? "Finaliza hoje" : `Finalizado há ${daysPast} dia${daysPast > 1 ? 's' : ''}`;
                } else if (today.getTime() < startDate.getTime()) {
                    const daysToStart = Math.ceil((startDate.getTime() - today.getTime()) / oneDay);
                    text = `Inicia em ${daysToStart} dia${daysToStart > 1 ? 's' : ''}`;
                } else {
                    text = remainingDays === 0 ? "Finaliza hoje" : `Faltam ${remainingDays} dia${remainingDays > 1 ? 's' : ''}`;
                }

                timelineInfo = { progress, text };
            }

            const buLabels: { [key in keyof typeof proj.soldHours]: string } = { infra: 'Infra', sse: 'Segurança', ti: 'TI', aut: 'Automação' };
            const hoursComparisonData = (Object.keys(proj.soldHours) as Array<keyof typeof proj.soldHours>).map(bu => ({
                name: buLabels[bu],
                'Vendidas': proj.soldHours[bu],
                'Utilizadas': proj.usedHours[bu],
            }));

            return (
                <Slide key={proj.id}>
                    <h2 className="text-3xl font-bold text-teleinfo-blue mb-2">Projeto Detalhado: {proj.name}</h2>
                    <div className="flex justify-between items-start text-gray-600 text-sm mb-4">
                        <div className="flex flex-col">
                            <span>Início: {proj.start || 'N/A'}</span>
                            <span className="font-bold text-teleinfo-blue mt-1">Progresso Total: {overallProgress.toFixed(1)}%</span>
                        </div>
                        <span>Término: {proj.end || 'N/A'}</span>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-center text-gray-800">Linha do Tempo</h3>
                        <p className="text-2xl font-bold text-teleinfo-orange text-center mb-2">{timelineInfo.text}</p>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <div className="bg-teleinfo-blue h-4 rounded-full" style={{ width: `${timelineInfo.progress}%` }}></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 flex-grow">
                        <div>
                            <h3 className="font-semibold text-lg mb-2">Progresso das Etapas</h3>
                            <ul className="space-y-3">
                               {proj.steps.map((step, i) => (
                                   <li key={i}>
                                       <div className="flex justify-between items-center mb-1 text-sm">
                                           <span>{step.name}</span>
                                           <span className="font-semibold">{step.perc}%</span>
                                       </div>
                                       <div className="w-full bg-gray-200 rounded-full h-2.5">
                                           <div className="bg-teleinfo-blue h-2.5 rounded-full" style={{ width: `${step.perc}%` }}></div>
                                       </div>
                                   </li>
                               ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-2">Horas Vendidas vs. Utilizadas</h3>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hoursComparisonData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                                        <Legend wrapperStyle={{fontSize: "12px"}}/>
                                        <Bar dataKey="Vendidas" fill="#10b981" />
                                        <Bar dataKey="Utilizadas">
                                            {hoursComparisonData.map((entry, index) => {
                                                const sold = entry['Vendidas'];
                                                const used = entry['Utilizadas'];
                                                let color = '#f97316'; // orange - normal
                                                if (sold > 0) {
                                                    if (used > sold) {
                                                        color = '#ef4444'; // red - exceeded
                                                    } else if (used / sold >= 0.8) {
                                                        color = '#eab308'; // yellow - risk
                                                    }
                                                }
                                                return <Cell key={`cell-${index}`} fill={color} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </Slide>
            );
        }),
        // Next Steps Slide
        <Slide key="next-steps">
            <h2 className="text-3xl font-bold text-teleinfo-blue mb-6">Próximos Passos</h2>
             <div className={`grid grid-cols-1 ${!isSlideMode ? 'md:grid-cols-2' : ''} gap-6 flex-grow items-center`}>
                <div className={isSlideMode ? 'max-w-3xl mx-auto w-full' : ''}>
                    {nextSteps.length > 0 ? (
                        <ul className="space-y-4">
                            {nextSteps.map(step => (
                                <li key={step.id} className="p-4 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">{step.project}</p>
                                            <p className="text-gray-600">{step.description}</p>
                                        </div>
                                        {!isSlideMode && (
                                            <button onClick={() => removeNextStep(step.id)} className="text-red-500 hover:text-red-400 p-1 rounded-full bg-red-500/10 ml-4">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">Nenhum próximo passo adicionado.</p>
                    )}
                </div>
                {!isSlideMode && (
                    <div className="bg-gray-100 p-4 rounded-lg self-start">
                         <h3 className="font-semibold mb-2">Adicionar Próximo Passo</h3>
                        <input type="text" value={newNextStepProject} onChange={e => setNewNextStepProject(e.target.value)} placeholder="Nome do Projeto" className="w-full border-gray-300 rounded-md p-2 mb-2"/>
                        <textarea value={newNextStepDesc} onChange={e => setNewNextStepDesc(e.target.value)} placeholder="Descrição da ação/entrega" rows={3} className="w-full border-gray-300 rounded-md p-2 mb-2"/>
                        <button onClick={addNextStep} className="bg-teleinfo-blue text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 transition-colors w-full justify-center">
                            <Plus size={16}/> Adicionar
                        </button>
                    </div>
                )}
            </div>
        </Slide>
    ], [portfolioSummary, keyFacts, nextSteps, detailedProjects, newFactText, newFactLogo, newNextStepProject, newNextStepDesc, isSlideMode]);

    const goToNextSlide = useCallback(() => {
        setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
    }, [slides.length]);

    const goToPrevSlide = useCallback(() => {
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
    }, []);

    useEffect(() => {
        if (!isSlideMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNextSlide();
            if (e.key === 'ArrowLeft') goToPrevSlide();
            if (e.key === 'Escape') setIsSlideMode(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSlideMode, goToNextSlide, goToPrevSlide]);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Gerador de Apresentação</h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => { setCurrentSlideIndex(0); setIsSlideMode(true); }} className="bg-teleinfo-orange hover:bg-teleinfo-orange/90 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <Tv size={16} /> Modo Slide
                    </button>
                    <button onClick={generatePdf} className="bg-teleinfo-green hover:bg-teleinfo-green/90 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <Download size={16} /> Gerar PDF
                    </button>
                </div>
            </div>

            <div id="presentation-content" className="[&>div]:mb-10">
                {slides.map((slide, index) => (
                    <div key={index}>{slide}</div>
                ))}
            </div>

            {isSlideMode && (
                <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
                    <div className="w-full h-full max-w-screen-lg max-h-[calc(100vh-80px)] aspect-video relative transition-transform duration-300">
                         {slides[currentSlideIndex]}
                    </div>
                    
                    {/* Controls */}
                    <button onClick={() => setIsSlideMode(false)} className="absolute top-4 right-4 text-white hover:text-gray-300">
                        <X size={32} />
                    </button>
                    <button onClick={goToPrevSlide} disabled={currentSlideIndex === 0} className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 disabled:opacity-30">
                        <ArrowLeft size={48} />
                    </button>
                    <button onClick={goToNextSlide} disabled={currentSlideIndex === slides.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 disabled:opacity-30">
                        <ArrowRight size={48} />
                    </button>
                    <div className="absolute bottom-4 text-white text-lg">
                        {currentSlideIndex + 1} / {slides.length}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PresentationView;
