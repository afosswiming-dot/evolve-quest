# EVOLVE Quest — Progressão e Novo Capítulo v0.1

Módulo administrativo para:

- listar ciclos aguardando Feedback ou Progressão;
- analisar o ciclo concluído;
- registrar Feedback de Evolução;
- decidir manutenção ou alteração de Classe, Nível e Capítulo;
- selecionar Missões do próximo ciclo;
- revisar e concluir a Progressão de forma transacional;
- manter histórico e auditoria.

## Configuração

No `app.js`, substitua:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a Publishable Key no navegador.

## RPCs esperadas

- `get_healer_progressions(...)`
- `get_progression_detail(p_progression_id uuid)`
- `save_evolution_feedback(...)`
- `save_progression_draft(...)`
- `complete_journey_progression(p_progression_id uuid)`

## Regra de Missões da v0.1

A interface exige ao menos uma seleção antes de concluir um novo ciclo, exceto em decisões de bloqueio, pausa, avaliação complementar, liberação médica ou encerramento.

No backend, a regra oficial deve validar ao menos uma versão válida de Alpha, Bravo e Charlie. Caso a operação exija Academia e Casa, a RPC deve exigir as seis combinações.

## Segurança

- Manter RLS ativa.
- Validar `auth.uid()` e `is_healer_or_admin()`.
- Healer acessa somente Aventureiros vinculados por `profiles.healer_id = auth.uid()`.
- Admin pode gerenciar todas as Progressões.
- Revogar execução das RPCs para `anon`.
- Não usar Service Role no navegador.
- Não confiar em `healer_id` ou `adventurer_id` enviados pelo frontend.
- A operação final deve ser transacional e idempotente quando possível.

## Limites

O navegador não altera diretamente Classe, Nível, Capítulo, `journey_stage`, status da Jornada, Checkpoint ou Progressão aprovada. Essas mudanças pertencem à RPC transacional.
