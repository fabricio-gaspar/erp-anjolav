
# Sistema de Temas Completos - Estilo Lovable

## Resumo

Criar um sistema de temas pre-definidos inspirado no Lovable (como na imagem de referencia), onde cada tema e uma **paleta completa e harmonica** de cores que afeta o sistema inteiro -- sidebar, botoes, links, bordas, icones, cards e todos os elementos visuais.

## Como vai funcionar

Diferente de apenas trocar uma cor, cada tema define **todas as variaveis CSS** do sistema de uma vez, garantindo harmonia total entre os elementos. Ao clicar em um tema, o sistema inteiro muda instantaneamente.

## Temas pre-definidos (10 opcoes)

Cada tema tera um nome e uma paleta de 5 cores exibidas como circulos (identico ao Lovable):

```text
Nome            Sidebar       Primary       Accent        Muted         Background
Padrao          #7C3BED       #0284C7       #334155       #94A3B8       #EBF0F5
Oceano          #1E40AF       #2563EB       #1E3A5F       #60A5FA       #EFF6FF
Esmeralda       #047857       #059669       #064E3B       #6EE7B7       #ECFDF5
Lavanda         #7E22CE       #A855F7       #581C87       #C084FC       #FAF5FF
Obsidian        #1F2937       #374151       #111827       #6B7280       #F3F4F6
Coral           #BE123C       #E11D48       #881337       #FB7185       #FFF1F2
Solar           #B45309       #D97706       #78350F       #FBBF24       #FFFBEB
Indigo          #4338CA       #6366F1       #312E81       #818CF8       #EEF2FF
Noturno         #0F172A       #1E293B       #020617       #475569       #F1F5F9
Orquideo        #86198F       #D946EF       #701A75       #E879F9       #FDF4FF
```

## Interface em Configuracoes

### Nova secao "Tema do Sistema" dentro de Configuracoes > Geral

Substituir o campo basico "Cor Primaria" (color picker + input hex) por uma lista visual de temas:

- Cada tema exibido como uma linha com:
  - 5 circulos coloridos representando a paleta (identico ao Lovable)
  - Nome do tema ao lado
  - Borda/destaque no tema atualmente selecionado
- Tema "Atual" destacado no topo (como "Current theme" no Lovable)
- Ao clicar em qualquer tema, o sistema muda instantaneamente (preview ao vivo)
- Botao "Salvar" para persistir a escolha no banco

## O que muda no sistema

### Variaveis CSS atualizadas por tema

Cada tema define valores para TODAS estas variaveis de uma vez:

```text
--primary              (botoes, links, icones principais)
--primary-foreground   (texto sobre fundo primario)
--ring                 (anel de foco em inputs)
--sidebar-background   (cor de fundo da sidebar)
--sidebar-hover        (hover nos itens da sidebar)
--sidebar-muted        (texto/icones secundarios na sidebar)
--sidebar-primary      (elementos primarios da sidebar)
--sidebar-ring         (foco na sidebar)
```

### Elementos que mudam automaticamente

Como o sistema ja usa CSS variables via Tailwind (`bg-primary`, `bg-sidebar`, etc.), ao trocar as variaveis, automaticamente mudam:

- Sidebar inteira (fundo, hover, textos)
- Botoes primarios (`bg-primary`)
- Links e icones (`text-primary`)
- Bordas de foco (`ring`)
- Tela de login (usa `bg-sidebar`)
- Qualquer elemento com `text-primary`, `bg-primary`, `border-primary`

### Correcao de cores hardcoded

Para que o tema funcione em 100% do sistema, as cores fixas `#7C3BED` do `ClientePagamento.tsx` (68 ocorrencias) serao substituidas por `bg-primary`, `hover:bg-primary/90`, `border-primary`, etc.

A cor fixa `bg-green-600` do botao "Salvar Identidade" em `ConfiguracoesGeral.tsx` sera substituida por `bg-success hover:bg-success/90`.

---

## Arquivos que serao criados/modificados

### 1. NOVO: `src/lib/themeUtils.ts`
- Definicao dos 10 temas como objetos com todas as variaveis CSS (H S% L% para cada variavel)
- Funcao `aplicarTema(nomeDoTema)` que atualiza todas as CSS variables no `:root`
- Funcao `getTemaAtual()` que retorna o nome do tema baseado na `cor_primaria` salva
- Lista exportada `TEMAS_DISPONIVEIS` com nome, cores de preview e valores HSL

### 2. `src/components/configuracoes/ConfiguracoesGeral.tsx`
- Substituir a area de "Cor Primaria" (linhas 507-523) por nova secao "Tema do Sistema"
- Renderizar lista de temas com 5 circulos coloridos cada + nome
- Tema selecionado com borda de destaque e label "Tema Atual"
- Ao clicar, aplicar tema instantaneamente via `aplicarTema()`
- Salvar o nome do tema no campo `cor_primaria` (reutilizando o campo existente, agora guardando o ID do tema como `"tema:oceano"`)
- Substituir `bg-green-600` do botao por `bg-success`

### 3. `src/components/layout/AppLayout.tsx`
- Importar `aplicarTema` e `useConfiguracoesGerais`
- No `useEffect` ao carregar, ler `cor_primaria` do banco e aplicar o tema correspondente
- Garante que o tema persista entre sessoes

### 4. `src/components/clientes/ClientePagamento.tsx`
- Substituir todas as 68 ocorrencias de `bg-[#7C3BED]`, `hover:bg-[#6B2FD6]`, `border-[#7C3BED]` por:
  - `bg-primary text-primary-foreground hover:bg-primary/90 border-primary`
  - `data-[state=on]:bg-primary data-[state=on]:text-primary-foreground`
- Isso faz os toggles de selecao seguirem o tema automaticamente

---

## Detalhes tecnicos

### Estrutura de um tema

Cada tema e definido como um objeto:

```text
{
  id: "oceano",
  nome: "Oceano",
  preview: ["#1E40AF", "#2563EB", "#1E3A5F", "#60A5FA", "#EFF6FF"],
  variaveis: {
    "--primary": "217 91% 39%",
    "--primary-foreground": "217 100% 97%",
    "--ring": "217 91% 39%",
    "--sidebar-background": "217 91% 39%",
    "--sidebar-hover": "217 80% 33%",
    "--sidebar-muted": "217 50% 55%",
    "--sidebar-primary": "217 91% 39%",
    "--sidebar-ring": "217 91% 39%"
  }
}
```

### Persistencia

- Reutiliza o campo `cor_primaria` ja existente na tabela `configuracoes_gerais`
- Salva como string com prefixo: `"tema:oceano"`, `"tema:esmeralda"`, etc.
- Se o valor nao tiver prefixo `"tema:"`, usa o tema padrao (retrocompativel)
- Nenhuma alteracao no banco de dados necessaria

### Fluxo completo

```text
1. Usuario abre Configuracoes > Geral
2. Ve a secao "Tema do Sistema" com 10 opcoes visuais
3. Clica em "Oceano" -> sistema inteiro muda instantaneamente
4. Sidebar fica azul, botoes ficam azuis, icones ficam azuis
5. Clica "Salvar" -> grava "tema:oceano" no banco
6. Proximo acesso: AppLayout le o tema e aplica no :root
```

### Cores de status permanecem fixas

As cores de status (success/verde, warning/amarelo, destructive/vermelho, info/azul) NAO mudam com o tema -- elas sao semanticas e devem permanecer consistentes para que o usuario sempre entenda o significado visual.
