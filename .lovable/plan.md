

# Correção do login da JUSSARA + Mudança de senha na Equipe

## Problema 1: JUSSARA não consegue logar

**Causa raiz identificada:**
- JUSSARA tem `funcionarios.email = jussara@anjolav.com`
- Porém o `user_id` dela aponta para o auth user com email `admin@anjolav.com`
- O fluxo de login busca `funcionarios.email` e tenta autenticar com `jussara@anjolav.com`, que **não existe** no auth — o auth user real é `admin@anjolav.com`
- Resultado: "Invalid login credentials"

**Solução:** Corrigir o email na tabela `funcionarios` para corresponder ao email real do auth user (`admin@anjolav.com`). Alternativamente, atualizar o email do auth user para `jussara@anjolav.com` — esta segunda opção é melhor pois o email `admin@anjolav.com` é genérico demais para uma funcionária.

Vou usar a edge function `manage-employee` para atualizar o email do auth user de `admin@anjolav.com` para `jussara@anjolav.com` e também resetar a senha dela.

## Problema 2: Falta opção de alterar senha na Equipe

Atualmente o formulário de funcionário só pede senha na criação. Não existe forma de alterar a senha de um funcionário existente. Vou adicionar:
- Um botão "Alterar Senha" na tabela/edição de funcionário
- Um modal simples com campo de nova senha
- Chamada à edge function `manage-employee` com ação `update-password`

## Mudanças necessárias

### 1. Atualizar edge function `manage-employee`
Adicionar duas ações novas:
- `update-password`: recebe `userId` + `newPassword`, usa `auth.admin.updateUserById`
- `update-email`: recebe `userId` + `newEmail`, usa `auth.admin.updateUserById`

### 2. Corrigir dados da JUSSARA
- Atualizar o email do auth user `bc931ef6-a6c1-415b-825c-494f11261bc0` de `admin@anjolav.com` para `jussara@anjolav.com`
- Resetar a senha dela para uma senha padrão (ex: `jussara123`) ou a que o admin definir

### 3. Adicionar "Alterar Senha" no módulo Equipe
- Em `ConfiguracoesEquipe.tsx`, adicionar botão de alterar senha na lista de funcionários
- Modal com campo de nova senha + confirmação
- Hook `useChangePassword` que chama a edge function

### 4. Sincronizar email entre funcionarios e auth
- Quando o email do funcionário for alterado na edição, atualizar também no auth user via edge function

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/manage-employee/index.ts` | Adicionar ações `update-password` e `update-email` |
| `src/components/configuracoes/ConfiguracoesEquipe.tsx` | Botão e modal de alterar senha |
| `src/hooks/useFuncionarios.ts` | Hook para alterar senha via edge function |

## Correção de dados (via edge function)
- Atualizar email do auth user da JUSSARA para `jussara@anjolav.com`
- Resetar senha da JUSSARA

