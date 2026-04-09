

# Criar usuário Master (ADMIN)

## Situação atual
- O cargo "ADMINISTRADOR" não existe na lista de cargos do sistema (só tem OPERADOR, MOTORISTA, BALCONISTA, etc.)
- O email `admin@anjolav.com` já está vinculado à funcionária JUSSARA
- A tabela `user_roles` está vazia (nenhum role atribuído a ninguém)

## O que será feito

### 1. Adicionar cargo "ADMINISTRADOR" à lista
No `ConfiguracoesEquipe.tsx`, adicionar "ADMINISTRADOR" como primeira opção na lista de cargos.

### 2. Criar o usuário admin no backend
- **Email**: master@anjolav.com
- **Senha**: fg886633@#$
- **Login**: ADMIN
- **Nome**: ADMIN
- **Cargo**: ADMINISTRADOR

Passos técnicos:
1. Criar um auth user via edge function (ou migration com insert) com email `master@anjolav.com` e senha `fg886633@#$`
2. Criar registro na tabela `funcionarios` vinculando ao auth user
3. Atribuir role `admin` na tabela `user_roles`

### 3. Habilitar auto-confirm para este email
Como o email não é real, será necessário confirmar automaticamente o usuário para que ele possa fazer login imediatamente.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/configuracoes/ConfiguracoesEquipe.tsx` | Adicionar "ADMINISTRADOR" à lista CARGOS |
| Migration SQL | Criar auth user + funcionario + user_role |

## Resultado
Após a implementação, o acesso será:
- **Login**: ADMIN
- **Senha**: fg886633@#$

