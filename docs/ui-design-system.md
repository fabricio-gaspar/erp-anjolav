# Sistema visual AnjoLav

## Padrão aplicado

O frontend usa os tokens em `src/index.css` como fonte visual comum:

- Estrutura institucional: azul-marinho `#14283F`.
- Ação principal e foco: azul `#1D4ED8`.
- Fundo: `#F4F6FA`; superfícies: branco; texto principal: `#1E293B`; texto secundário: `#475569`.
- Bordas: `#DDE4ED`; sucesso: `#15803D`; atenção: `#B45309`; erro: `#B91C1C`.
- Controles com altura mínima de 40 px, raio de 8 px e foco visível.
- Cartões com raio de 12 px, bordas discretas e sombra curta.
- Inter, escala operacional de 14–16 px e títulos de página de 26–28 px.

Os componentes compartilhados em `src/components/ui` consomem esses tokens para botões, campos, selects, abas, cartões, tabelas e status. O tema padrão em `src/lib/themeUtils.ts` foi alinhado ao mesmo conjunto. Os temas alternativos continuam disponíveis e preservam sua função de personalização.

## Exceções intencionais

- `PdvLayout`, `pdv-front.css`, `pdv-cashier.css` e `pdv-service-selector.css` preservam o chrome escuro e a densidade do balcão/PDV, pois são uma superfície operacional especializada.
- `AuthShell` preserva o fundo institucional escuro da autenticação.
- Cores próprias de módulos no painel operacional, statuses e documentos/etiquetas permanecem semânticas e isoladas da UI de impressão.

## Matriz de cobertura

Status usados: **Implementada e validada na interface**; **Implementada com validação pendente**; **Fora de uso / redirecionamento**.

| Tela/rota | Aba ou janela | Perfil/contexto | Ajuste aplicado | Resolução verificada | Evidência | Situação | Pendência |
|---|---|---|---|---|---|---|---|
| `/login` | Acesso | Público | AuthShell e controles compartilham tipografia, foco e tokens | — | `src/components/auth/AuthShell.tsx` | Implementada com validação pendente | Navegação visual |
| `/mfa` | Segundo fator | Público | AuthShell e input OTP usam tokens compartilhados | — | `src/components/auth/MfaCodeInput.tsx` | Implementada com validação pendente | Navegação visual |
| `/forgot-password` | Recuperação | Público | AuthShell e campos compartilhados | — | `src/pages/ForgotPassword.tsx` | Implementada com validação pendente | Navegação visual |
| `/reset-password` | Redefinição | Público | AuthShell e campos compartilhados | — | `src/pages/ResetPassword.tsx` | Implementada com validação pendente | Navegação visual |
| `/central` e `/admin/visao-geral` | Dashboard | Administrativo | AdminLayout, PageHeader, cartões, KPIs e estados | — | `src/pages/Dashboard.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/financeiro`, `/industrial/financeiro`, `/residencial/financeiro` | Financeiro | Administrativo/operacional | Componentes financeiros e tabelas usam tokens | — | `src/pages/DashboardFinanceiro.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/contas`, `/admin/financeiro/contas` | Contas | Administrativo | Abas, filtros, tabelas e modais compartilhados | — | `src/pages/Contas.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/agenda-eventos`, `/admin/operacoes/agenda` | Agenda administrativa | Administrativo | PageHeader, calendário, cards e modais | — | `src/pages/AgendaEventos.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/relatorios/quilometragem` | Quilometragem | Administrativo | Filtros, indicadores e tabela | — | `src/pages/RelatorioKilometragem.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/relatorios/mensal`, `/admin/relatorios` | Relatório mensal | Administrativo | Filtros, cards, tabelas e gráficos | — | `src/pages/RelatorioMensal.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/configuracoes`, `/admin/configuracoes` | Configurações | Administrador | Abas e formulários compartilham controles e estados | — | `src/pages/Configuracoes.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/auditoria`, `/admin/auditoria` | Auditoria | Administrador | Filtros, tabela e estados de consulta | — | `src/pages/Auditoria.tsx` | Implementada com validação pendente | Navegação visual |
| `/central/administracao-saas`, `/admin/plataforma` | Administração SaaS | Platform admin | AdminLayout e cartões administrativos | — | `src/pages/AdministracaoSaas.tsx` | Implementada com validação pendente | Navegação visual |
| `/{industrial,residencial}/clientes` e `/admin/cadastros/clientes` | Lista, resumo, dados, endereço, condições e contrato | Operacional/administrativo | Campos, abas, tabelas e novo agrupamento de condições | 1366×768 | Cadastro de clientes publicado | Implementada e validada na interface | Validar variações industrial |
| `/{industrial,residencial}/produtos` e `/admin/cadastros/produtos` | Lista e formulário | Operacional/administrativo | Cards, filtros, formulário e tabela | — | `src/pages/Produtos.tsx` | Implementada com validação pendente | Navegação visual |
| `/industrial/fornecedores` e `/admin/cadastros/fornecedores` | Diretório e cadastro | Industrial/administrativo | Cards de resumo, filtros e formulário | — | `src/pages/Fornecedores.tsx` | Implementada com validação pendente | Navegação visual |
| `/{industrial,residencial}/agenda` | Calendário, rotas e modais | Operacional | Agenda, tabs, drawers e modal de rota | — | `src/pages/Agenda.tsx` | Implementada com validação pendente | Navegação visual |
| `/{industrial,residencial}/ordens` e `/admin/operacoes/ordens` | ROLs/pedidos, detalhes e impressão | Operacional/administrativo | Lista, detalhes, ações e dialogs | — | `src/pages/OrdensServico.tsx` | Implementada com validação pendente | Validar impressão |
| `/{industrial,residencial}/producao` e `/admin/operacoes/producao` | Filas, kanban e finalizadas | Produção | Tabs, cards de etapas e estados | — | `src/pages/FluxoProducao.tsx` | Implementada com validação pendente | Navegação visual |
| `/{industrial,residencial}/lancamentos` e `/admin/financeiro/lancamentos` | Lançamentos, faturas e histórico | Financeiro | Tabs, filtros, tabelas e modais | — | `src/pages/Lancamentos.tsx` | Implementada com validação pendente | Navegação visual |
| `/industrial/estoque` e `/admin/estoque` | Estoque, compras, entradas e saídas | Gestão | Tabs, dashboards, tabelas e dialogs | — | `src/pages/Estoque.tsx` | Implementada com validação pendente | Navegação visual |
| `/industrial/relatorios/clientes` | Demonstrativos | Industrial | Filtros, indicadores e relatórios | — | `src/pages/RelatoriosCliente.tsx` | Implementada com validação pendente | Navegação visual |
| `/industrial/relatorios/proximidade` | Proximidade | Industrial | Mapa, cards e filtros | — | `src/pages/RelatorioProximidade.tsx` | Implementada com validação pendente | Navegação visual |
| `/residencial/relatorios/caixa` e `/admin/financeiro/caixas` | Histórico de caixas | Financeiro | Tabs, resumo, tabelas e dialogs | — | `src/pages/HistoricoCaixas.tsx` | Implementada com validação pendente | Navegação visual |
| `/pdv/domestico`, `/pdv/industrial` | Seleção de serviço | PDV | Chrome operacional especializado preservado | — | `src/pages/PdvServiceSelector.tsx` | Implementada com validação pendente | Navegação visual |
| `/pdv/painel/domestico`, `/pdv/painel/industrial` | Painel frontal | PDV | Cards de módulos e navegação autorizada | — | `src/pages/PdvModuleHub.tsx` | Implementada com validação pendente | Navegação visual |
| `/pdv/{domestico,industrial}/{rol,delivery,orcamento}` | Atendimento | PDV | Fluxo de cliente, itens, entrega, pagamento e finalização | — | `src/pages/CaixaPDV.tsx` | Implementada com validação pendente | E2E de jornada |
| `/pdv/{domestico,industrial}/{clientes,produtos,agenda,ordens,producao,lancamentos}` | Módulos internos | PDV | PdvLayout, abas, tabelas e dialogs | — | `src/App.tsx` e páginas correspondentes | Implementada com validação pendente | Navegação visual |
| `/portal/:codigo` | Portal do cliente | Público autenticado por código | Superfície própria preservada; tokens compartilhados nos componentes | — | `src/pages/PortalCliente.tsx` | Implementada com validação pendente | Acesso com código de teste |
| Redirecionamentos legados | Rotas antigas | Compatibilidade | Mantidos sem alterar comportamento | — | `LEGACY_ROUTE_REDIRECTS` | Fora de uso / redirecionamento | Nenhuma |

## Verificações desta padronização

- `git diff --check`: pendente após a próxima alteração local.
- `npm run typecheck`: pendente após a próxima alteração local.
- `npm run build`: pendente após a próxima alteração local.
- Validação visual completa em 1440×900, 1366×768, tablet e mobile: pendente; as rotas foram inventariadas e as exceções estão identificadas acima.
