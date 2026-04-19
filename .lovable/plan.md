

## Diagnóstico

O componente global `Input` (`src/components/ui/input.tsx`) força **TODOS** os campos de texto a:
1. Converter o valor para maiúsculas no `onChange` (linha 18)
2. Aplicar a classe CSS `uppercase` (linha 28)

Isso afeta o sistema inteiro. No Login, mesmo passando `skipUppercase`, qualquer outro campo no app continua forçando caixa alta — o que é uma "pegadinha" para senhas e logins modernos.

Além disso, a tela atual:
- Não dá feedback visual claro de erro inline (só toast)
- Não tem indicador de Caps Lock ativo (o usuário digitou senha em maiúsculas sem perceber)
- Não tem validação visual em tempo real

## Plano de Reescrita

### 1. Reescrever `src/pages/Login.tsx` com padrão moderno
- Layout limpo, centrado, com **detecção de Caps Lock** (alerta visual quando ativo) — resolve o caso da senha digitada em maiúsculas sem querer
- Campo Login usando `<input>` HTML nativo (não o `Input` shadcn), evitando qualquer transformação. Aceita letras maiúsculas, minúsculas, números e caracteres especiais **exatamente como digitados**
- Campo Senha igual, com toggle de visibilidade (Eye/EyeOff)
- Mensagens de erro inline (abaixo dos campos), em vermelho, além do toast
- Botão "Entrar" com loading state
- Autocomplete adequado (`username` e `current-password`) para gerenciadores de senha
- Visual elegante mantendo a identidade Secullum (header azul, card branco)

### 2. Lógica de autenticação (sem mudanças funcionais grandes)
- Mantém busca case-insensitive por `login` (`.ilike`) na tabela `funcionarios`
- Trim no login (sem alterar caixa)
- Senha enviada **exatamente** como digitada
- Erros tratados granularmente:
  - Login não encontrado → mensagem inline
  - Funcionário inativo → mensagem inline
  - Credenciais inválidas → mensagem inline
  - Erro de rede → toast

### 3. NÃO mexer no `Input` global
- Outras telas dependem do comportamento "uppercase". Mudar isso quebraria cadastros, formulários, etc.
- Solução: o Login usa `<input>` nativo estilizado com Tailwind, sem passar pelo wrapper `Input` que aplica uppercase

### Resultado
- Login aceita `ADMIN`, `admin`, `Admin` — todos funcionam (banco usa `.ilike`)
- Senha aceita exatamente `Fag886633@#$` (sem alterar Fag→FAG)
- Aviso de Caps Lock evita o erro mais comum (senha em maiúsculas por engano)
- Visual moderno, com feedback inline e suporte a gerenciadores de senha

