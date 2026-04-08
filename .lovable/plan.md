
# Login por Username (campo "login") em vez de Email

## Como funciona hoje
O funcionário precisa digitar o **email** para entrar. O Supabase Auth exige email+senha.

## Como vai funcionar
O funcionário digita o **login** (username cadastrado na aba Equipe). O sistema busca o email vinculado a esse login na tabela `funcionarios` e usa esse email para autenticar no backend.

## Fluxo

```text
1. Usuário digita login + senha
2. SELECT email FROM funcionarios WHERE login = ? AND ativo = true
3. Se não encontrar → erro "Login não encontrado"
4. Se encontrar mas sem email → erro "Funcionário sem email cadastrado"
5. Se encontrar → signIn(email, senha)
```

## Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Login.tsx` | Trocar campo Email por Login (text), buscar email do funcionário na tabela antes de autenticar |

Nenhuma migração necessária.
