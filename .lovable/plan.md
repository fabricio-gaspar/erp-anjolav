# Login por Username (campo "login") em vez de Email

## Como funciona hoje
O funcionário precisa digitar o **email** para entrar. O Supabase Auth exige email+senha.

## Como vai funcionar
O funcionário digita o **login** (username cadastrado na aba Equipe). O sistema busca o email vinculado a esse login na tabela `funcionarios` e usa esse email para autenticar no backend.

## Mudanças

### 1. `src/pages/Login.tsx`
- Trocar o campo "Email" por "Login" (type text, placeholder "seu.login")
- Renomear estado de `email` para `login`
- No `handleSubmit`: antes de chamar `signIn`, consultar `funcionarios` pelo campo `login` para obter o `email`
- Se não encontrar funcionário ou se não tiver email vinculado, mostrar erro claro
- Se encontrar, chamar `signIn(email, password)` normalmente

### 2. `src/contexts/AuthContext.tsx`
- Criar função auxiliar `signInByLogin(login, password)` que encapsula a busca + autenticação
- Ou manter simples e fazer a busca direto no Login.tsx (mais simples)

## Abordagem escolhida
Fazer a busca direto no `Login.tsx` — mais simples, sem alterar o AuthContext:

```
1. Usuário digita login + senha
2. SELECT email FROM funcionarios WHERE login = ? AND ativo = true
3. Se não encontrar → erro "Login não encontrado"
4. Se encontrar mas sem email → erro "Funcionário sem email cadastrado"
5. Se encontrar → signIn(email, senha)
```

## Arquivos
| Arquivo | Mudança |
|---------|---------|
| `src/pages/Login.tsx` | Campo login, busca funcionário, depois autentica |

Nenhuma migração necessária.
