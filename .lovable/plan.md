

## Plano: Ocultar campos pré-configurados no wizard de faturamento

### Problema
Quando o cliente já tem Tipo de Relatório, Observação, Descrição NF, forma de pagamento etc. configurados no cadastro, o wizard ainda exibe esses campos para edição manual, gerando redundância.

### Alterações

#### 1. `src/components/faturamento/EtapaRelatorio.tsx` — Ocultar campos já configurados
- **Tipo de Relatório**: Se `dados.configCliente?.tipo_relatorio` existe, ocultar o RadioGroup e mostrar apenas um badge informativo: "Tipo de Relatório: Mapa de Peças ✓ (configurado no cadastro)"
- **Observação da Fatura**: Se `dados.configPagamento?.observacao_faturamento` existe, ocultar o Textarea e mostrar a observação como texto estático com badge "Configurado no cadastro"
- Se algum campo **não** estiver configurado, exibir um Alert amarelo: "⚠ Configure o Tipo de Relatório / Observação no cadastro do cliente para agilizar o faturamento"

#### 2. `src/components/faturamento/EtapaNF.tsx` — Ocultar campos já configurados
- **Tipo de Descrição NF** (itens vs padrão): Se `dados.configPagamento?.listar_itens_detalhados` não é null E `dados.configPagamento?.descricao_nf_id` está configurado, ocultar o RadioGroup e o Select de descrições. Mostrar badge informativo.
- **Natureza da Operação**: Manter visível pois depende de lógica dinâmica (cidade emitente vs tomador), mas indicar quando foi auto-selecionada.
- **CNPJ Emissor**: Se `dados.configPagamento?.cnpj_emissor_id` existe, mostrar badge informativo ao lado do nome do emitente.
- Se faltar alguma configuração, exibir Alert: "Configure a Descrição NF padrão no cadastro do cliente"

#### 3. `src/components/faturamento/EtapaPagamento.tsx` — Ocultar campos já configurados
- **Forma de pagamento**: Já usa `configPagamento?.forma_pagamento` — manter como está mas adicionar badge "Configurado no cadastro" quando vem da config do cliente.
- **Vencimento**: Já calcula automaticamente — adicionar badge informativo quando `dia_fechamento` e `condicao_pagamento` estão configurados.
- Se forma de pagamento **não** estiver configurada no cliente, exibir Alert amarelo.

#### 4. `src/components/faturamento/EtapaEnvio.tsx` — Seleção de documentos gerados
- Na seção "Arquivos Gerados", adicionar checkboxes ao lado de cada documento (ROL, NF, Pagamento) para o usuário selecionar quais quer enviar.
- Estado `selectedDocs` controla quais documentos serão mencionados na mensagem de envio.
- Documentos que não foram gerados nas etapas anteriores ficam desabilitados (já está assim com `disabled`).
- Passar os `selectedDocs` para `handleSendWhatsApp` e `handleSendEmail` para personalizar a mensagem.

### Detalhes técnicos
- Criar componente auxiliar `ConfigBadge` inline (ou reutilizável) para badges "Configurado no cadastro" com ícone de check verde.
- Campos ocultos continuam sendo usados internamente nos estados (já inicializados via `useState` com valores da config).
- Nenhuma mudança de banco de dados necessária.

### Resultado
O wizard fica mais enxuto: campos já configurados no cadastro do cliente são apenas exibidos como confirmação (não editáveis), com um indicador visual. Alertas informam ao usuário quando falta configurar algo no cadastro. Na etapa de envio, o usuário escolhe quais documentos gerados deseja enviar.

