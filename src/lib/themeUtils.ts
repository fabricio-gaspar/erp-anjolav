export interface TemaConfig {
  id: string;
  nome: string;
  preview: [string, string, string, string, string]; // 5 cores de preview
  variaveis: Record<string, string>;
}

export const TEMAS_DISPONIVEIS: TemaConfig[] = [
  {
    id: "padrao",
    nome: "Padrão",
    preview: ["#7C3BED", "#0284C7", "#334155", "#94A3B8", "#EBF0F5"],
    variaveis: {
      "--primary": "200 98% 39%",
      "--primary-foreground": "204 100% 97%",
      "--ring": "200 98% 39%",
      "--sidebar-background": "262 83% 58%",
      "--sidebar-hover": "262 70% 52%",
      "--sidebar-muted": "262 50% 70%",
      "--sidebar-primary": "200 98% 39%",
      "--sidebar-ring": "200 98% 39%",
    },
  },
  {
    id: "oceano",
    nome: "Oceano",
    preview: ["#1E40AF", "#2563EB", "#1E3A5F", "#60A5FA", "#EFF6FF"],
    variaveis: {
      "--primary": "217 91% 60%",
      "--primary-foreground": "217 100% 97%",
      "--ring": "217 91% 60%",
      "--sidebar-background": "224 76% 40%",
      "--sidebar-hover": "224 65% 34%",
      "--sidebar-muted": "224 50% 65%",
      "--sidebar-primary": "217 91% 60%",
      "--sidebar-ring": "217 91% 60%",
    },
  },
  {
    id: "esmeralda",
    nome: "Esmeralda",
    preview: ["#047857", "#059669", "#064E3B", "#6EE7B7", "#ECFDF5"],
    variaveis: {
      "--primary": "160 84% 39%",
      "--primary-foreground": "160 100% 97%",
      "--ring": "160 84% 39%",
      "--sidebar-background": "162 93% 24%",
      "--sidebar-hover": "162 80% 20%",
      "--sidebar-muted": "162 50% 55%",
      "--sidebar-primary": "160 84% 39%",
      "--sidebar-ring": "160 84% 39%",
    },
  },
  {
    id: "lavanda",
    nome: "Lavanda",
    preview: ["#7E22CE", "#A855F7", "#581C87", "#C084FC", "#FAF5FF"],
    variaveis: {
      "--primary": "271 91% 65%",
      "--primary-foreground": "271 100% 97%",
      "--ring": "271 91% 65%",
      "--sidebar-background": "274 87% 47%",
      "--sidebar-hover": "274 75% 40%",
      "--sidebar-muted": "274 50% 68%",
      "--sidebar-primary": "271 91% 65%",
      "--sidebar-ring": "271 91% 65%",
    },
  },
  {
    id: "obsidian",
    nome: "Obsidian",
    preview: ["#1F2937", "#374151", "#111827", "#6B7280", "#F3F4F6"],
    variaveis: {
      "--primary": "215 14% 34%",
      "--primary-foreground": "210 40% 98%",
      "--ring": "215 14% 34%",
      "--sidebar-background": "215 28% 17%",
      "--sidebar-hover": "215 25% 13%",
      "--sidebar-muted": "215 14% 50%",
      "--sidebar-primary": "215 14% 34%",
      "--sidebar-ring": "215 14% 34%",
    },
  },
  {
    id: "coral",
    nome: "Coral",
    preview: ["#BE123C", "#E11D48", "#881337", "#FB7185", "#FFF1F2"],
    variaveis: {
      "--primary": "347 77% 50%",
      "--primary-foreground": "347 100% 97%",
      "--ring": "347 77% 50%",
      "--sidebar-background": "346 87% 41%",
      "--sidebar-hover": "346 75% 35%",
      "--sidebar-muted": "347 50% 65%",
      "--sidebar-primary": "347 77% 50%",
      "--sidebar-ring": "347 77% 50%",
    },
  },
  {
    id: "solar",
    nome: "Solar",
    preview: ["#B45309", "#D97706", "#78350F", "#FBBF24", "#FFFBEB"],
    variaveis: {
      "--primary": "38 92% 50%",
      "--primary-foreground": "38 100% 97%",
      "--ring": "38 92% 50%",
      "--sidebar-background": "28 80% 37%",
      "--sidebar-hover": "28 70% 30%",
      "--sidebar-muted": "38 50% 60%",
      "--sidebar-primary": "38 92% 50%",
      "--sidebar-ring": "38 92% 50%",
    },
  },
  {
    id: "indigo",
    nome: "Índigo",
    preview: ["#4338CA", "#6366F1", "#312E81", "#818CF8", "#EEF2FF"],
    variaveis: {
      "--primary": "239 84% 67%",
      "--primary-foreground": "239 100% 97%",
      "--ring": "239 84% 67%",
      "--sidebar-background": "243 75% 51%",
      "--sidebar-hover": "243 65% 44%",
      "--sidebar-muted": "239 50% 68%",
      "--sidebar-primary": "239 84% 67%",
      "--sidebar-ring": "239 84% 67%",
    },
  },
  {
    id: "noturno",
    nome: "Noturno",
    preview: ["#0F172A", "#1E293B", "#020617", "#475569", "#F1F5F9"],
    variaveis: {
      "--primary": "215 25% 27%",
      "--primary-foreground": "210 40% 98%",
      "--ring": "215 25% 27%",
      "--sidebar-background": "222 47% 11%",
      "--sidebar-hover": "222 40% 8%",
      "--sidebar-muted": "215 20% 45%",
      "--sidebar-primary": "215 25% 27%",
      "--sidebar-ring": "215 25% 27%",
    },
  },
  {
    id: "orquideo",
    nome: "Orquídeo",
    preview: ["#86198F", "#D946EF", "#701A75", "#E879F9", "#FDF4FF"],
    variaveis: {
      "--primary": "292 91% 73%",
      "--primary-foreground": "292 100% 10%",
      "--ring": "292 91% 73%",
      "--sidebar-background": "293 82% 33%",
      "--sidebar-hover": "293 72% 27%",
      "--sidebar-muted": "292 50% 65%",
      "--sidebar-primary": "292 91% 73%",
      "--sidebar-ring": "292 91% 73%",
    },
  },
];

/**
 * Aplica um tema ao :root do documento, atualizando todas as CSS variables
 */
export function aplicarTema(temaId: string): void {
  const tema = TEMAS_DISPONIVEIS.find((t) => t.id === temaId);
  if (!tema) return;

  const root = document.documentElement;
  Object.entries(tema.variaveis).forEach(([variavel, valor]) => {
    root.style.setProperty(variavel, valor);
  });
}

/**
 * Remove as variáveis inline (volta ao CSS padrão do :root)
 */
export function resetarTema(): void {
  const root = document.documentElement;
  const variaveisParaRemover = [
    "--primary",
    "--primary-foreground",
    "--ring",
    "--sidebar-background",
    "--sidebar-hover",
    "--sidebar-muted",
    "--sidebar-primary",
    "--sidebar-ring",
  ];
  variaveisParaRemover.forEach((v) => root.style.removeProperty(v));
}

/**
 * Obtém o ID do tema a partir do valor salvo no campo cor_primaria
 * Formato esperado: "tema:oceano", "tema:esmeralda", etc.
 * Se não tiver prefixo "tema:", retorna "padrao"
 */
export function getTemaIdFromCorPrimaria(corPrimaria: string | null): string {
  if (!corPrimaria) return "padrao";
  if (corPrimaria.startsWith("tema:")) {
    const temaId = corPrimaria.replace("tema:", "");
    // Verifica se o tema existe
    const existe = TEMAS_DISPONIVEIS.some((t) => t.id === temaId);
    return existe ? temaId : "padrao";
  }
  // Valor legado (hex direto) - usa padrão
  return "padrao";
}

/**
 * Converte o ID do tema para o formato de persistência
 */
export function temaIdToCorPrimaria(temaId: string): string {
  return `tema:${temaId}`;
}
