export interface Project {
  [key: string]: string | number | null;
  CLIENTE: string;
  'TIPO DE PROJETO': string;
  'TIPO DE PRODUTO': string;
  BUs: string;
  'C.Custo': string;
  STATUS: string;
  perc: number | null;
}

export interface DetailedProjectStep {
  name: string;
  perc: number;
}

export interface BuHours {
  infra: number;
  sse: number;
  ti: number;
  aut: number;
}

export interface DetailedProject {
  id: string;
  name: string;
  start: string;
  end: string;
  steps: DetailedProjectStep[];
  soldHours: BuHours;
  usedHours: BuHours;
}

export interface KeyFact {
  id: string;
  text: string;
  logoUrl?: string;
}

export interface NextStep {
  id: string;
  project: string;
  description: string;
}
