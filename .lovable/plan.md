

# Correção do login ADMIN e melhorias no sistema de usuários

## Problema 1: Login ADMIN dando "Invalid login credentials"

O usuário ADMIN foi criado via API administrativa do backend, mas a senha não foi definida corretamente durante a criação. Os logs confirmam que as tentativas de login com `master@anjolav.com` retornam erro 400 (credenciais inválidas). A solução é **resetar a senha** do usuário ADMIN via uma edge function temporária usando o service_role.

## Problema 2: Avatar no menu lateral

Linha 166 do `AppSidebar.tsx` usa uma foto genérica do Unsplash como fallback quando o funcionário não tem avatar. Quando o ADMIN logar, vai aparecer a foto de um estranho. A correção é mostrar as **iniciais do nome** quando não há avatar cadastrado.

## Problema 3: Melhorias na criação de usuários

O hook `useCreateFuncionario` usa `supabase.auth.signUp()` para criar o auth user, mas isso pode causar problemas:
- O `signUp` pelo client-side pode deslogar o usuário atual (admin) ao criar um novo funcionário
- Não há validação visual clara de campos obrigatórios

## Plano de execução

### 1. Resetar senha do ADMIN
- Criar edge function temporária `reset-admin-password` que usa `supabase.auth.admin.updateUserById()` para definir a senha `fg886633@#$` no usuário `ac4ffebd-b6eb-4ef2-810c-220e65039eed`
- Executar e remover a função

### 2. Corrigir avatar no sidebar
- Em `AppSidebar.tsx`, trocar o fallback de foto Unsplash por iniciais do nome do funcionário
- Usar o componente `Avatar` do shadcn com `AvatarFallback` mostrando as iniciais

### 3. Melhorar criação de funcionários
- Criar edge function `manage-employee` permanente que usa `auth.admin.createUser()` no server-side, evitando deslogar o admin
- Atualizar `useFuncionarios.ts` para chamar essa edge function em vez de `signUp` client-side

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/reset-admin-password/index.ts` | Temporária - resetar senha ADMIN |
| `supabase/functions/manage-employee/index.ts` | Permanente - criar usuários via admin API |
| `src/components/layout/AppSidebar.tsx` | Avatar com iniciais como fallback |
| `src/hooks/useFuncionarios.ts` | Usar edge function para criar auth user |

Nenhuma migração de banco necessária.

