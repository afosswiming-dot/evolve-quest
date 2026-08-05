# EVOLVE Quest — Escolha da Jornada

**Módulo:** Escolha da Jornada  
**Versão integrada:** v1.0.1  
**Responsabilidade:** permitir que o Aventureiro autenticado selecione uma Jornada e seja encaminhado ao link externo de pagamento.

## Integração realizada

- Lê a sessão criada pelo módulo Cadastro.
- Consulta no Supabase apenas `id`, `preferred_name` e `email` do Aventureiro autenticado.
- Não grava a escolha no Supabase.
- Mantém a escolha pendente apenas em `sessionStorage` durante o redirecionamento ao gateway.
- Remove a aprovação de pagamento simulada da versão original.
- Prepara o retorno aprovado para `./boas-vindas.html`.

## Configuração obrigatória antes da publicação

No início de `app.js`, preencha os quatro links oficiais da InfinitePay:

```js
paymentLinks: {
  monthly: 'LINK_MENSAL',
  quarterly: 'LINK_TRIMESTRAL',
  semiannual: 'LINK_SEMESTRAL',
  annual: 'LINK_ANUAL'
}
```

Enquanto esses links estiverem vazios, o módulo exibirá “Pagamento indisponível” e não simulará uma aprovação.

## Retorno do pagamento

O módulo reconhece os parâmetros:

- `?payment_status=approved`
- `?payment_status=declined`
- `?payment_status=cancelled`

A configuração real do retorno deve ser feita no gateway ou no futuro módulo Pagamento. Nenhuma confirmação financeira deve depender apenas de parâmetro do navegador em produção; a confirmação definitiva deverá ser validada por webhook/backend.

## Rotas preparadas

- Anterior: `./cadastro.html`
- Próxima após pagamento aprovado: `./boas-vindas.html`

## Arquivo original

O ZIP enviado pelo usuário não foi alterado. Esta pasta é uma cópia integrada.

## Links de pagamento configurados

- Jornada Mensal: InfinitePay
- Jornada Trimestral: InfinitePay
- Jornada Semestral: InfinitePay
- Jornada Anual: InfinitePay

A escolha ainda não é persistida no Supabase nesta versão. Essa integração será feita posteriormente.
