# EVOLVE Quest — Avaliação Inicial v1.0.1 Integrada

Integração criada sobre uma cópia do módulo oficial.

## Integrações

- Supabase Auth para identificar o Aventureiro.
- Tabela `profiles` para identidade e perfil físico.
- `initial_evaluations` para rascunho, progresso, envio e bloqueio.
- Tabelas relacionais para objetivos, histórico, saúde, rotina, hábitos e compromisso.
- `adventurer_onboarding` atualizado após o envio.
- `localStorage` mantido somente como contingência.

## Rotas

As páginas devem ser publicadas no mesmo domínio para compartilhar a sessão autenticada.

## Regra de edição

A avaliação pode ser editada quando estiver em `draft`, `returned_for_editing`, ou `submitted` enquanto `analysis_started_at` e `locked_at` estiverem vazios.
