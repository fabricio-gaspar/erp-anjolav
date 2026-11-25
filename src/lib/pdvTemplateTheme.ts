export const PDV_TEMPLATE_THEMES = [
  {
    id: "oceano",
    name: "Azul institucional",
    description: "Paleta única do Painel Administrativo Geral, com contraste alto para operação.",
    colors: ["#132b3e", "#1e40d9", "#2563eb", "#f7f9fc"],
  },
] as const;

export type PdvTemplateThemeId = (typeof PDV_TEMPLATE_THEMES)[number]["id"];

export function isPdvTemplateTheme(value: string | null | undefined): value is PdvTemplateThemeId {
  return PDV_TEMPLATE_THEMES.some((theme) => theme.id === value);
}

export function getPdvTemplateTheme(value: string | null | undefined): PdvTemplateThemeId {
  return isPdvTemplateTheme(value) ? value : "oceano";
}
