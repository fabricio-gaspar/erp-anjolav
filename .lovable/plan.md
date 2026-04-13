

## Plano: Redesign completo estilo Secullum Ponto Web

### Alterações

#### 1. `src/index.css` — Variáveis de tema
- `--background`: `0 0% 96%` (#F5F5F5 — fundo cinza claro)
- `--sidebar-background`: `0 0% 100%` (branco)
- `--sidebar-foreground`: `215 25% 27%` (texto escuro)
- `--sidebar-hover`: `210 20% 96%` (cinza claro no hover)
- `--sidebar-muted`: `215 15% 60%` (cinza médio)
- `--primary`: `197 100% 43%` (#0098DA — azul ciano)
- Comentário do sidebar muda de "Purple Theme" para "Secullum Light Theme"

#### 2. `src/components/layout/AppHeader.tsx` — Header escuro navy
- Fundo: `bg-[#1a2332]` com `border-[#1a2332]`
- Breadcrumb links e títulos em branco/branco-70%
- Ícones de busca, notificação em branco/branco-70%
- Badge de notificação mantém vermelho
- Kbd do atalho com estilo escuro

#### 3. `src/components/layout/AppSidebar.tsx` — Sidebar branca
- Trocar todas as referências `text-white` → `text-slate-700`
- `text-white/80` → `text-slate-500`
- `text-white/60` → `text-slate-400`
- Ativo: `bg-primary/10 text-primary` (ciano sobre fundo claro)
- Hover: `hover:bg-slate-100 hover:text-slate-900`
- NavGroup aberto: `bg-slate-100 text-slate-800`
- Bordas: `border-white/10` → `border-slate-200`
- Logo fallback: fundo `bg-primary` em vez de `bg-black`
- Avatar: `bg-primary/10` com iniciais `text-primary`
- CollapseButton: `bg-white text-slate-600 border-slate-200 shadow`
- Tooltip: fundo branco com texto escuro

#### 4. `src/components/layout/AppLayout.tsx`
- Mobile Sheet: `bg-white` em vez de `bg-sidebar`

#### 5. `src/lib/themeUtils.ts`
- Atualizar tema "padrao" com sidebar branca e novas variáveis

### Resultado
Header azul marinho escuro, sidebar branca limpa com texto escuro e destaque ciano, fundo cinza claro #F5F5F5 — visual profissional estilo Secullum.

