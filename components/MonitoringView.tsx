import React, { useState, useEffect, useMemo } from 'react';
import type { DetailedProject, DetailedProjectStep, BuHours } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Plus, Save, FilePlus, Trash2, BrainCircuit, X } from 'lucide-react';
import { generateDetailedProjectRiskAnalysis } from '../services/geminiService';

const statusColors: { [key: string]: { pill: string; chart: string } } = {
    'FINALIZADO': { pill: 'bg-green-500/10 text-green-400', chart: '#22c55e' },
    'EM ANDAMENTO': { pill: 'bg-blue-500/10 text-blue-400', chart: '#3b82f6' },
    'PARALIZADO': { pill: 'bg-red-500/10 text-red-400', chart: '#ef4444' },
    'NÃO INICIADO': { pill: 'bg-yellow-500/10 text-yellow-400', chart: '#eab308' },
    'DEFAULT': { pill: 'bg-gray-500/10 text-gray-400', chart: '#6b7280' },
};

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

const initialBuHours: BuHours = { infra: 0, sse: 0, ti: 0, aut: 0 };
const initialProjectState: Omit<DetailedProject, 'id'> = {
    name: '',
    start: '',
    end: '',
    steps: [
        { name: 'Planejamento', perc: 0 },
        { name: 'Execução', perc: 0 },
        { name: 'Entrega', perc: 0 },
    ],
    soldHours: { ...initialBuHours },
    usedHours: { ...initialBuHours },
};

const RiskAnalysisModal: React.FC<{ project: DetailedProject; onClose: () => void }> = ({ project, onClose }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setIsLoading(true);
            const result = await generateDetailedProjectRiskAnalysis(project);
            setAnalysis(result);
            setIsLoading(false);
        };
        fetchAnalysis();
    }, [project]);
    
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-dark-card border border-dark-border rounded-lg p-6 w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-dark-text-secondary hover:text-white">
                    <X size={20} />
                </button>
                <h3 className="text-lg font-semibold text-white mb-2">Análise de Risco IA (Detalhada)</h3>
                <p className="text-sm text-dark-text-secondary mb-4">Projeto: {project.name}</p>
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <BrainCircuit size={24} className="animate-pulse text-teleinfo-blue" />
                        <span className="ml-2">Analisando...</span>
                    </div>
                ) : (
                    <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br />') }} />
                )}
            </div>
        </div>
    );
};

const MonitoringView: React.FC = () => {
    const [projects, setProjects] = useLocalStorage<DetailedProject[]>('teleinfo_detailed_projects', []);
    const [selectedProjectId, setSelectedProjectId] = useState<string | 'new'>('new');
    const [projectForRiskAnalysis, setProjectForRiskAnalysis] = useState<DetailedProject | null>(null);
    
    const [currentProject, setCurrentProject] = useState<Omit<DetailedProject, 'id'>>(initialProjectState);

    useEffect(() => {
        if (selectedProjectId === 'new') {
            handleNewProject();
        } else {
            const project = projects.find(p => p.id === selectedProjectId);
            if (project) {
                setCurrentProject({
                    name: project.name,
                    start: project.start,
                    end: project.end,
                    steps: project.steps,
                    soldHours: project.soldHours || { ...initialBuHours },
                    usedHours: project.usedHours || { ...initialBuHours },
                });
            }
        }
    }, [selectedProjectId, projects]);

    const handleInputChange = (field: keyof Omit<DetailedProject, 'id' | 'steps' | 'soldHours' | 'usedHours'>, value: string) => {
        setCurrentProject(prev => ({ ...prev, [field]: value }));
    };

    const handleStepChange = (index: number, field: keyof DetailedProjectStep, value: string) => {
        const newSteps = [...currentProject.steps];
        if (field === 'perc') {
            const percValue = Math.max(0, Math.min(100, Number(value)));
            newSteps[index] = { ...newSteps[index], [field]: percValue };
        } else {
            newSteps[index] = { ...newSteps[index], [field]: value };
        }
        setCurrentProject(prev => ({ ...prev, steps: newSteps }));
    };
    
    const handleHoursChange = (type: 'soldHours' | 'usedHours', bu: keyof BuHours, value: string) => {
        const numericValue = Number(value) >= 0 ? Number(value) : 0;
        setCurrentProject(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [bu]: numericValue,
            },
        }));
    };

    const addStep = () => setCurrentProject(prev => ({ ...prev, steps: [...prev.steps, { name: 'Nova Etapa', perc: 0 }] }));
    const removeStep = (index: number) => setCurrentProject(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));

    const handleSave = () => {
        if (!currentProject.name.trim()) {
            alert('O nome do projeto é obrigatório.');
            return;
        }
        if (selectedProjectId === 'new') {
            const newProject = { ...currentProject, id: Date.now().toString() };
            setProjects([...projects, newProject]);
            setSelectedProjectId(newProject.id);
        } else {
            setProjects(projects.map(p => p.id === selectedProjectId ? { ...currentProject, id: selectedProjectId } : p));
        }
        alert('Projeto salvo!');
    };
    
    const handleNewProject = () => {
        setSelectedProjectId('new');
        setCurrentProject(initialProjectState);
    };
    
    const handleRiskAnalysis = () => {
        if (selectedProjectId !== 'new') {
            setProjectForRiskAnalysis({ ...currentProject, id: selectedProjectId });
        }
    };

    const overallProgress = useMemo(() => {
        const validSteps = currentProject.steps.filter(s => s.name.trim() !== '');
        if (validSteps.length === 0) return 0;
        const total = validSteps.reduce((acc, step) => acc + step.perc, 0);
        return total / validSteps.length;
    }, [currentProject.steps]);

    const hoursComparisonData = useMemo(() => {
        const buLabels: { [key in keyof BuHours]: string } = { infra: 'Infra', sse: 'Segurança', ti: 'TI', aut: 'Automação' };
        return (Object.keys(currentProject.soldHours) as Array<keyof BuHours>).map(bu => ({
            name: buLabels[bu],
            'Horas Vendidas': currentProject.soldHours[bu],
            'Horas Utilizadas': currentProject.usedHours[bu],
        }));
    }, [currentProject.soldHours, currentProject.usedHours]);

    return (
        <div className="space-y-8">
            {projectForRiskAnalysis && <RiskAnalysisModal project={projectForRiskAnalysis} onClose={() => setProjectForRiskAnalysis(null)} />}
            <h1 className="text-3xl font-bold text-white">Monitoramento Detalhado</h1>

            <div className="bg-dark-card border border-dark-border rounded-lg p-5 flex flex-wrap items-end gap-4">
                <div className="flex-grow">
                    <label htmlFor="projectSelect" className="text-sm font-medium text-dark-text-secondary block mb-1">Projeto Salvo</label>
                    <select id="projectSelect" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teleinfo-blue">
                        <option value="new">(Novo Projeto)</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="flex-grow">
                    <label htmlFor="projectName" className="text-sm font-medium text-dark-text-secondary block mb-1">Nome do Projeto</label>
                    <input type="text" id="projectName" value={currentProject.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Nome do projeto" className="w-full bg-dark-bg border border-dark-border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teleinfo-blue" />
                </div>
                <div>
                    <label htmlFor="startDate" className="text-sm font-medium text-dark-text-secondary block mb-1">Início</label>
                    <input type="date" id="startDate" value={currentProject.start} onChange={(e) => handleInputChange('start', e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teleinfo-blue" />
                </div>
                <div>
                    <label htmlFor="endDate" className="text-sm font-medium text-dark-text-secondary block mb-1">Término</label>
                    <input type="date" id="endDate" value={currentProject.end} onChange={(e) => handleInputChange('end', e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teleinfo-blue" />
                </div>
                <button onClick={handleSave} className="bg-teleinfo-blue hover:bg-teleinfo-blue/90 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                    <Save size={16} /> Salvar
                </button>
                 <button onClick={handleNewProject} className="bg-dark-border hover:bg-dark-border/80 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                    <FilePlus size={16} /> Novo
                </button>
                 <button onClick={handleRiskAnalysis} disabled={selectedProjectId === 'new'} className="bg-teleinfo-orange hover:bg-teleinfo-orange/90 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <BrainCircuit size={16} /> Analisar Risco
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-card border border-teleinfo-orange rounded-lg p-6 text-center">
                        <h3 className="text-lg font-semibold text-white mb-2">Status Geral</h3>
                        <p className="text-5xl font-bold text-teleinfo-orange mb-2">{overallProgress.toFixed(1)}%</p>
                        <p className="text-sm text-dark-text-secondary">
                            {currentProject.start && currentProject.end ? `De ${currentProject.start} até ${currentProject.end}` : "Defina as datas de início e término"}
                        </p>
                    </div>

                    <div className="bg-dark-card border border-dark-border rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">Etapas do Projeto</h3>
                        <div className="space-y-3">
                            {currentProject.steps.map((step, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input type="text" value={step.name} onChange={(e) => handleStepChange(index, 'name', e.target.value)} placeholder="Nome da Etapa" className="flex-grow bg-dark-bg border border-dark-border rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-teleinfo-blue"/>
                                    <input type="number" min="0" max="100" value={step.perc} onChange={(e) => handleStepChange(index, 'perc', e.target.value)} className="w-20 bg-dark-bg border border-dark-border rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-teleinfo-blue"/>
                                    <button onClick={() => removeStep(index)} className="text-red-500 hover:text-red-400 p-1 rounded-full bg-red-500/10">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={addStep} className="mt-4 w-full bg-dark-border hover:bg-dark-border/80 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <Plus size={16} /> Adicionar Etapa
                        </button>
                    </div>
                    
                    <div className="bg-dark-card border border-dark-border rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">Controle de Horas por BU</h3>
                        {(['soldHours', 'usedHours'] as const).map(type => (
                            <div key={type} className="mb-4">
                                <h4 className="font-semibold text-dark-text-secondary mb-2">{type === 'soldHours' ? 'Horas Vendidas' : 'Horas Utilizadas'}</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(initialBuHours) as Array<keyof BuHours>).map(bu => (
                                         <div key={`${type}-${bu}`}>
                                            <label className="text-xs uppercase text-dark-text-secondary/80">{bu}</label>
                                            <input type="number" min="0" value={currentProject[type][bu]} onChange={e => handleHoursChange(type, bu, e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-teleinfo-blue"/>
                                         </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-card border border-dark-border rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">Status por Etapa</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={currentProject.steps} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={statusColors.DEFAULT.chart} strokeOpacity={0.2} />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#8b949e', fontSize: 12 }} unit="%" />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#c9d1d9', fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: 'rgba(139, 148, 158, 0.1)' }} contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '0.5rem' }}/>
                                    <Bar dataKey="perc" name="Progresso" barSize={20}>
                                        {currentProject.steps.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.perc === 100 ? '#22c55e' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                     <div className="bg-dark-card border border-dark-border rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">Comparativo de Horas (Vendida vs. Utilizada)</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hoursComparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={statusColors.DEFAULT.chart} strokeOpacity={0.2} />
                                    <XAxis dataKey="name" tick={{ fill: '#c9d1d9', fontSize: 12 }} />
                                    <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: 'rgba(139, 148, 158, 0.1)' }} contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '0.5rem' }}/>
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="Horas Vendidas" fill="#10b981" />
                                    <Bar dataKey="Horas Utilizadas" fill="#f97316" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringView;
