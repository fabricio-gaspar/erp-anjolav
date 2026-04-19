
Diagnóstico do problema:
- O erro que o usuário está vendo no navegador é “Login não encontrado”.
- O código atual de `src/pages/Login.tsx` já usa `rpc("get_employee_email_by_login")`, que é o fluxo correto para contornar o RLS da tabela `funcionarios`.
- Porém, o replay e os requests do preview mostram outra coisa: o navegador ainda está fazendo `GET /rest/v1/funcionarios?select=email,ativo&login=ilike.wfdigital`, que é a lógica antiga e retorna vazio por causa do RLS.
- Os logs de autenticação do backend mostram que `wfdigital` e `ADMIN` conseguem autenticar no backend com sucesso. Ou seja: o principal problema não parece ser a senha nem o banco de autenticação, e sim que o frontend em uso está com a lógica antiga / inconsistente.

O que vou corrigir:
1. Verificar e reparar o vínculo do usuário no banco
- Conferir no banco o registro de `wfdigital` em `funcionarios`:
  - `login`
  - `email`
  - `ativo`
  - `user_id`
  - `cargo`
- Conferir se o `user_id` bate com o usuário de autenticação criado para `wfdigital`.
- Validar também o `ADMIN` para garantir que os dois mestres estão consistentes.
- Se houver divergência, corrigir o registro e o vínculo.

2. Unificar o fluxo de login
- Garantir que o login use só um caminho:
  - resolver login -> email pela função `get_employee_email_by_login`
  - autenticar via `signInWithPassword`
- Remover qualquer caminho legado que ainda consulte `funcionarios` diretamente por REST.
- Se existir código duplicado em outros pontos, centralizar a resolução do login para evitar regressão.

3. Forçar consistência entre código e preview
- Aplicar uma mudança explícita no fluxo de login para disparar novo build e garantir que o preview carregue a versão correta.
- Confirmar que o navegador passa a chamar a RPC e não mais `rest/v1/funcionarios?...login=ilike...`.

4. Endurecer o pós-login
- Depois do `signIn`, validar se o usuário autenticado possui um funcionário vinculado.
- Se não possuir, mostrar erro claro em vez de deixar o sistema em estado ambíguo.
- Isso evita situações em que a autenticação funciona no backend, mas a aplicação fica sem contexto do colaborador.

5. Validar ponta a ponta
- Testar login com:
  - `wfdigital / Fag886633@#$`
  - `ADMIN / Fag886633@#$`
- Confirmar:
  - lookup do login funcionando
  - autenticação funcionando
  - redirecionamento para `/`
  - carregamento do `funcionario`
  - ausência do erro “Login não encontrado”

Arquivos envolvidos:
- `src/pages/Login.tsx`
- `src/contexts/AuthContext.tsx`
- possivelmente uma camada utilitária para centralizar autenticação por login
- banco: revisão dos dados em `funcionarios` e do vínculo com autenticação

Detalhe técnico importante:
- Não encontrei evidência de defeito estrutural no banco de autenticação.
- A evidência mais forte aponta para frontend antigo/legado ainda executando a consulta bloqueada por RLS.
- Mesmo assim, vou validar e corrigir também os registros do banco para encerrar o problema de vez.
