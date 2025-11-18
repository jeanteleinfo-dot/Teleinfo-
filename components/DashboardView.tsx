
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Project } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { UploadCloud, FileText, Bot, BrainCircuit, X, AlertTriangle, GanttChartSquare } from 'lucide-react';
import { generateProjectRiskAnalysis } from '../services/geminiService';

// Helper Functions
const normalizePercent = (value: any): number | null => {
    if (value == null) return null;
    if (typeof value !== "string") value = String(value);
    const cleaned = value.replace("%", "").trim();
    if (!cleaned) return null;
    const num = parseFloat(cleaned.replace(",", "."));
    return isNaN(num) ? null : num;
};

const normalizeStatus = (status: any): string => {
    if (!status) return "";
    return status.toString().trim().toUpperCase();
};

const parseTeleinfoCsv = (text: string): Project[] => {
    // 1. Handle potential Byte Order Mark (BOM)
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
    }
    
    const allLines = text.split(/\r?\n/);

    // 2. Find the header row by looking for "CLIENTE", ignoring junk lines at the start
    const headerRowIndex = allLines.findIndex(l => l.toUpperCase().includes('CLIENTE'));

    if (headerRowIndex === -1) {
        alert("Erro de Análise: Não foi possível encontrar a linha de cabeçalho. O arquivo CSV deve conter uma coluna 'CLIENTE'.");
        return [];
    }

    // 3. Slice the array from the header row and filter out any remaining empty/junk lines
    const lines = allLines.slice(headerRowIndex).filter(l => l.replace(/;/g, '').trim().length > 0);

    if (lines.length < 2) {
        alert("Erro de Análise: O arquivo CSV está vazio ou contém apenas a linha de cabeçalho.");
        return [];
    }

    const sep = ";";
    const headers = lines[0].split(sep).map(h => h.trim());

    // 4. Find indices of required columns, case-insensitively
    const findIndex = (possibleNames: string[]) => {
        for (const name of possibleNames) {
            const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
            if (idx !== -1) return idx;
        }
        return -1;
    };
    
    const idxMap = {
        cliente: findIndex(['CLIENTE']),
        tipoProjeto: findIndex(['TIPO DE PROJETO']),
        tipoProduto: findIndex(['TIPO DE PRODUTO']),
        bus: findIndex(['BUs']),
        cCusto: findIndex(['C.Custo']),
        status: findIndex(['STATUS']),
        perc: findIndex(['%']),
    };
    
    // 5. Validate that essential columns exist
    if (idxMap.cliente === -1 && idxMap.cCusto === -1) {
        alert("Erro de Análise: O arquivo CSV deve conter uma coluna 'CLIENTE' ou 'C.Custo'. Verifique se o cabeçalho está correto.");
        return [];
    }
    
    const rows: Project[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(sep);
        const getCell = (idx: number) => cells[idx]?.trim() || "";
        const cliente = idxMap.cliente > -1 ? getCell(idxMap.cliente) : "";
        const cCusto = idxMap.cCusto > -1 ? getCell(idxMap.cCusto) : "";
        
        if (!cliente && !cCusto) continue;
        
        rows.push({
            'CLIENTE': cliente,
            'TIPO DE PROJETO': idxMap.tipoProjeto > -1 ? getCell(idxMap.tipoProjeto) : "",
            'TIPO DE PRODUTO': idxMap.tipoProduto > -1 ? getCell(idxMap.tipoProduto) : "",
            'BUs': idxMap.bus > -1 ? getCell(idxMap.bus) : "",
            'C.Custo': cCusto,
            'STATUS': normalizeStatus(idxMap.status > -1 ? getCell(idxMap.status) : ""),
            perc: normalizePercent(idxMap.perc > -1 ? getCell(idxMap.perc) : null),
        });
    }

    if(rows.length === 0) {
        alert("Aviso: Nenhuma linha de projeto válida foi encontrada no arquivo CSV. Verifique o conteúdo e o formato do arquivo.");
    }
    
    return rows;
};


const statusColors: { [key: string]: { pill: string; chart: string } } = {
    'FINALIZADO': { pill: 'bg-green-500/10 text-green-400', chart: '#22c55e' },
    'EM ANDAMENTO': { pill: 'bg-blue-500/10 text-blue-400', chart: '#3b82f6' },
    'PARALIZADO': { pill: 'bg-red-500/10 text-red-400', chart: '#ef4444' },
    'NÃO INICIADO': { pill: 'bg-yellow-500/10 text-yellow-400', chart: '#eab308' },
    'DEFAULT': { pill: 'bg-gray-500/10 text-gray-400', chart: '#6b7280' },
};

const getStatusClass = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized.startsWith("FINALIZADO")) return statusColors['FINALIZADO'].pill;
    if (normalized.startsWith("EM ANDAMENTO")) return statusColors['EM ANDAMENTO'].pill;
    if (normalized.startsWith("PARALIZADO")) return statusColors['PARALIZADO'].pill;
    if (normalized.startsWith("NÃO INICIADO")) return statusColors['NÃO INICIADO'].pill;
    return statusColors['DEFAULT'].pill;
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

// Sub-components
const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4 flex items-center gap-3 transition-all hover:border-teleinfo-blue/50">
        <div className="bg-dark-border p-2 rounded-full shrink-0">{icon}</div>
        <div className="flex flex-col justify-center">
            <p className="text-xs text-dark-text-secondary font-medium uppercase">{title}</p>
            <p className="text-xl font-bold text-white leading-tight">{value}</p>
        </div>
    </div>
);

const ChartCard: React.FC<{ title: string; data: any[]; dataKey: string; nameKey: string }> = ({ title, data, dataKey, nameKey }) => (
    <div className="bg-dark-card border border-dark-border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={statusColors.DEFAULT.chart} strokeOpacity={0.2} />
                    <XAxis dataKey={nameKey} tick={{ fill: '#8b949e', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                    <Tooltip
                        cursor={{ fill: 'rgba(139, 148, 158, 0.1)' }}
                        contentStyle={{
                            backgroundColor: '#161b22',
                            borderColor: '#30363d',
                            borderRadius: '0.5rem',
                        }}
                    />
                    <Bar dataKey={dataKey} name="Projetos" barSize={30}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
);

const RiskAnalysisModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setIsLoading(true);
            const result = await generateProjectRiskAnalysis(project);
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
                <h3 className="text-lg font-semibold text-white mb-2">Análise de Risco IA</h3>
                <p className="text-sm text-dark-text-secondary mb-4">Projeto: {project['CLIENTE']} - {project['TIPO DE PROJETO']}</p>
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

// Main View
interface DashboardViewProps {
    projects: Project[];
    onDataLoaded: (data: Project[], fileName: string) => void;
    fileName: string;
}

const DashboardView: React.FC<DashboardViewProps> = ({ projects, onDataLoaded, fileName }) => {
    const [statusFilter, setStatusFilter] = useState('');
    const [buFilter, setBuFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [selectedProjectForRisk, setSelectedProjectForRisk] = useState<Project | null>(null);
    const [monitoredCount, setMonitoredCount] = useState(0);

    useEffect(() => {
        const loadMonitoredCount = () => {
            try {
                const item = window.localStorage.getItem('teleinfo_detailed_projects');
                if (item) {
                    const parsed = JSON.parse(item);
                    if (Array.isArray(parsed)) {
                        setMonitoredCount(parsed.length);
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar contagem de projetos monitorados:", error);
            }
        };
        loadMonitoredCount();
    }, []);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const parsedData = parseTeleinfoCsv(text);
            onDataLoaded(parsedData, file.name);
        };
        reader.readAsText(file, "utf-8");
    }, [onDataLoaded]);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => 
            (statusFilter ? p.STATUS === statusFilter : true) &&
            (buFilter ? p.BUs === buFilter : true) &&
            (clientFilter ? p.CLIENTE === clientFilter : true)
        );
    }, [projects, statusFilter, buFilter, clientFilter]);

    const { summary, statusChartData, buChartData, uniqueFilters } = useMemo(() => {
        const data = filteredProjects;
        let finished = 0, inProgress = 0, paralyzed = 0, notStarted = 0;
        const statusCounts: { [key: string]: number } = {};
        const buCounts: { [key: string]: number } = {};
        const statuses = new Set<string>();
        const bus = new Set<string>();
        const clients = new Set<string>();

        projects.forEach(p => {
            if (p.STATUS) statuses.add(p.STATUS);
            if (p.BUs) bus.add(p.BUs);
            if (p.CLIENTE) clients.add(p.CLIENTE);
        });

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
            summary: {
                total: data.length,
                avgPercent: `${avg.toFixed(1)}%`,
                finished,
                inProgress,
                paralyzed,
                notStarted,
            },
            statusChartData: Object.entries(statusCounts).map(([name, value]) => ({ name, Projetos: value, color: getStatusChartColor(name) })),
            buChartData: Object.entries(buCounts).map(([name, value]) => ({ name, Projetos: value, color: getBuChartColor(name) })),
            uniqueFilters: {
                statuses: Array.from(statuses).sort(),
                bus: Array.from(bus).sort(),
                clients: Array.from(clients).sort(),
            }
        };
    }, [filteredProjects, projects]);
    
    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
                <UploadCloud size={64} className="text-teleinfo-blue mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo ao Painel IA da Teleinfo</h2>
                <p className="text-dark-text-secondary mb-6">Carregue um arquivo CSV para começar.</p>
                <label className="bg-teleinfo-blue hover:bg-teleinfo-blue/90 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors">
                    <span>Carregar CSV</span>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                </label>
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
             {selectedProjectForRisk && <RiskAnalysisModal project={selectedProjectForRisk} onClose={() => setSelectedProjectForRisk(null)} />}
            {/* Header and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Painel</h1>
                    <p className="text-dark-text-secondary mt-1">
                        Exibindo dados de <span className="text-teleinfo-blue font-medium">{fileName}</span>
                    </p>
                </div>
                <label className="bg-dark-card border border-dark-border hover:border-teleinfo-blue text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                    <UploadCloud size={16} />
                    <span>Carregar Novo CSV</span>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['statusFilter', 'buFilter', 'clientFilter'].map(filter => (
                    <div key={filter}>
                        <label htmlFor={filter} className="text-sm font-medium text-dark-text-secondary block mb-1">
                            {filter === 'statusFilter' ? 'Status' : filter === 'buFilter' ? 'Unidade de Negócio' : 'Cliente'}
                        </label>
                        <select
                            id={filter}
                            value={filter === 'statusFilter' ? statusFilter : filter === 'buFilter' ? buFilter : clientFilter}
                            onChange={(e) => {
                                if (filter === 'statusFilter') setStatusFilter(e.target.value);
                                if (filter === 'buFilter') setBuFilter(e.target.value);
                                if (filter === 'clientFilter') setClientFilter(e.target.value);
                            }}
                            className="w-full bg-dark-card border border-dark-border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teleinfo-blue"
                        >
                            <option value="">Todos</option>
                            {(filter === 'statusFilter' ? uniqueFilters.statuses : filter === 'buFilter' ? uniqueFilters.bus : uniqueFilters.clients).map(val => (
                                <option key={val} value={val}>{val}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <SummaryCard title="Projetos Totais" value={summary.total} icon={<FileText size={20} className="text-teleinfo-blue"/>} />
                <SummaryCard title="Projetos Monitorados" value={monitoredCount} icon={<GanttChartSquare size={20} className="text-teleinfo-orange"/>} />
                <SummaryCard title="Média de Conclusão" value={summary.avgPercent} icon={<FileText size={20} className="text-teleinfo-blue"/>} />
                <SummaryCard title="Finalizados" value={summary.finished} icon={<FileText size={20} className="text-green-400"/>} />
                <SummaryCard title="Em Andamento" value={summary.inProgress} icon={<FileText size={20} className="text-blue-400"/>} />
                <SummaryCard title="Paralisados" value={summary.paralyzed} icon={<FileText size={20} className="text-red-400"/>} />
                <SummaryCard title="Não Iniciados" value={summary.notStarted} icon={<FileText size={20} className="text-yellow-400"/>} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartCard title="Projetos por Status" data={statusChartData} dataKey="Projetos" nameKey="name" />
                <ChartCard title="Projetos por Unidade de Negócio" data={buChartData} dataKey="Projetos" nameKey="name" />
            </div>

            {/* Table */}
            <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
                <div className="p-5">
                    <h3 className="text-lg font-semibold text-white">Detalhes dos Projetos</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-dark-border/50 text-xs text-dark-text-secondary uppercase">
                            <tr>
                                <th className="px-6 py-3">Cliente</th>
                                <th className="px-6 py-3">Tipo de Projeto</th>
                                <th className="px-6 py-3">Tipo de Produto</th>
                                <th className="px-6 py-3">UN</th>
                                <th className="px-6 py-3">Centro de Custo</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-center">IA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.map((p, index) => (
                                <tr key={index} className="border-b border-dark-border hover:bg-dark-border/30">
                                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{p.CLIENTE}</td>
                                    <td className="px-6 py-4 text-dark-text-secondary">{p['TIPO DE PROJETO']}</td>
                                    <td className="px-6 py-4 text-dark-text-secondary">{p['TIPO DE PRODUTO']}</td>
                                    <td className="px-6 py-4 text-dark-text-secondary">{p.BUs}</td>
                                    <td className="px-6 py-4 text-dark-text-secondary">{p['C.Custo']}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(p.STATUS)}`}>{p.STATUS}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => setSelectedProjectForRisk(p)}
                                            title="Gerar Análise de Risco com IA"
                                            className="bg-teleinfo-blue/10 text-teleinfo-blue hover:bg-teleinfo-blue/20 text-xs font-semibold py-1.5 px-3 rounded-full transition-colors flex items-center gap-1.5 justify-center"
                                        >
                                            <BrainCircuit size={14} />
                                            <span>Analisar Risco</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
