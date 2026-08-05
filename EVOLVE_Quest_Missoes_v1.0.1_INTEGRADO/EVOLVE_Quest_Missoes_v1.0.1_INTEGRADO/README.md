# EVOLVE Quest — Missões v1.0.1 Integrado

Módulo integrado ao Supabase sem alteração do layout aprovado.

## Fluxo

Painel do Aventureiro → Missões → Registro da Missão

## Comportamento

- Lê Jornada, Capítulo, atribuições, Missões e exercícios do Supabase.
- Academia e Casa são Missões independentes.
- Cria ou retoma `mission_executions`.
- Salva cada exercício em `execution_exercises`.
- Pausa e retoma em outro dispositivo.
- Ao finalizar exercícios, muda para `awaiting_record`.
- Encaminha para `/registro-missao/?execution_id=...`.
- Só o Registro da Missão poderá mudar a execução para `completed`.

## Observação

O banco precisa ter Jornada ativa, Capítulo, Missões, exercícios e atribuições cadastradas pelo Healer. Quando não houver prescrição, o módulo exibe um estado vazio em vez de dados demonstrativos.
