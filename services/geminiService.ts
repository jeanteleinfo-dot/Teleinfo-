import { GoogleGenAI } from "@google/genai";
import type { Project, DetailedProject } from '../types';

let ai: GoogleGenAI | null = null;

const getAi = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}

export const generateProjectRiskAnalysis = async (project: Project): Promise<string> => {
  try {
    const prompt = `
      Analise o projeto a seguir, identifique riscos potenciais e sugira uma estratégia de mitigação para cada um.
      Seja conciso e liste até 3 pontos em formato Markdown.
      Cada ponto deve estar no formato: "**Risco:** [descrição] - **Mitigação:** [sugestão]".
      
      Detalhes do Projeto:
      - Cliente: ${project.CLIENTE}
      - Tipo de Projeto: ${project['TIPO DE PROJETO']}
      - Status: ${project.STATUS}
      - Progresso: ${project.perc ?? 'N/A'}%
    `;
    const response = await getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating project risk analysis:", error);
    return "Erro ao gerar a análise de risco.";
  }
};

export const generateDetailedProjectRiskAnalysis = async (project: DetailedProject): Promise<string> => {
  try {
    const totalSold = project.soldHours.infra + project.soldHours.sse + project.soldHours.ti + project.soldHours.aut;
    const totalUsed = project.usedHours.infra + project.usedHours.sse + project.usedHours.ti + project.usedHours.aut;
    const overallProgress = project.steps.length > 0 ? project.steps.reduce((acc, s) => acc + s.perc, 0) / project.steps.length : 0;

    const prompt = `
      Analise o projeto a seguir, identifique riscos potenciais e sugira uma estratégia de mitigação para cada um.
      Foque especialmente na comparação entre horas vendidas e utilizadas, e o progresso geral.
      Seja conciso e liste até 4 pontos em formato Markdown.
      Cada ponto deve estar no formato: "**Risco:** [descrição] - **Mitigação:** [sugestão]".
      
      Detalhes do Projeto:
      - Nome: ${project.name}
      - Datas: de ${project.start || 'N/A'} a ${project.end || 'N/A'}
      - Progresso Geral: ${overallProgress.toFixed(1)}%
      
      Horas Vendidas (Total: ${totalSold}):
      - Infraestrutura: ${project.soldHours.infra}h
      - Segurança: ${project.soldHours.sse}h
      - TI: ${project.soldHours.ti}h
      - Automação: ${project.soldHours.aut}h
      
      Horas Utilizadas (Total: ${totalUsed}):
      - Infraestrutura: ${project.usedHours.infra}h
      - Segurança: ${project.usedHours.sse}h
      - TI: ${project.usedHours.ti}h
      - Automação: ${project.usedHours.aut}h
    `;
    const response = await getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating detailed project risk analysis:", error);
    return "Erro ao gerar a análise de risco detalhada.";
  }
};
