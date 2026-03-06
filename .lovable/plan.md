

# Corrigir campo Valor e Frequência no formulário de Fornecedor

## Problemas

1. **Campo "Valor Mensal"** usa `type="number"` que tem os mesmos problemas de input que ja corrigimos no Contas a Pagar (nao aceita virgula, conflito com casas decimais). Alem disso, o label diz "Mensal" mas a frequencia pode variar.

2. **Frequencia limitada** a apenas "Mensal" e "Quinzenal" — faltam opcoes como Semanal, Anual, Avulso.

3. **Na tabela**, o texto tambem assume "Mensal" ou "Quinzenal" de forma fixa.

## Mudancas

### Arquivo: `src/pages/Fornecedores.tsx`

**1. Campo Valor — corrigir input**
- Remover `type="number"` e `step="0.01"` 
- Usar input de texto com `skipUppercase`, aceitar virgula e ponto
- Converter no `salvar()` com `parseFloat(valor.replace(",", "."))`
- Renomear label de "Valor Mensal" para **"Valor"**

**2. Frequencia — expandir opcoes**
- Adicionar opcoes ao Select: `semanal`, `quinzenal`, `mensal`, `anual`, `avulso`
- Criar mapa de labels para exibicao na tabela (ex: `semanal → "Semanal"`, `anual → "Anual"`)

**3. Tabela — atualizar exibicao**
- Usar o mapa de labels para mostrar a frequencia correta em vez de hardcoded "Mensal"/"Quinzenal"
- Linha 195: substituir ternario por lookup no mapa

**4. Titulo da secao**
- Manter "Pagamento Recorrente" (generico, nao menciona "mensal")

### Arquivo unico: `src/pages/Fornecedores.tsx`

