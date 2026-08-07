# EVOLVE Quest — Análise da Avaliação e Liberação da Jornada v0.1

Módulo administrativo mobile first para leitura integral da Avaliação Inicial, registro das decisões do Healer, prescrição inicial e liberação transacional da primeira Jornada.

## Estrutura

```text
healer-assessment-review/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Na integração oficial:

```text
healer/avaliacoes/detalhe/
```

Rota aceita: `/healer/avaliacao/?evaluation_id=UUID` ou `/healer/avaliacoes/{evaluationId}/`.

## Configuração

No início de `app.js`, substitua:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a Publishable Key no navegador. Nunca use Service Role no frontend.

## RPCs esperadas

O frontend foi preparado para quatro funções seguras:

- `get_assessment_for_healer(p_evaluation_id uuid)`
- `save_healer_assessment_review(p_review jsonb)`
- `release_initial_journey(p_evaluation_id uuid)`
- `return_evaluation_for_editing(p_evaluation_id uuid, p_reason text)`

Todas devem validar `auth.uid()`, `profiles.role in ('healer','admin')`, `profiles.account_status = 'active'`, usar `search_path` fixo, revogar execução de `anon` e não confiar em `healer_id` ou `adventurer_id` enviados pelo navegador.

## Regra de Missões da v0.1

A liberação exige **ao menos uma versão publicada para cada tipo Alpha, Bravo e Charlie**. Academia e Casa podem coexistir e permanecer disponíveis durante o ciclo, mas não é obrigatório selecionar as seis versões nesta versão.

## Contrato sugerido de leitura

`get_assessment_for_healer` deve retornar:

```json
{
  "profile": {},
  "evaluation": {},
  "goals": {},
  "trainingHistory": {},
  "health": {},
  "routine": {},
  "habits": {},
  "commitments": {},
  "review": {},
  "assignedHealerName": "",
  "catalog": {
    "classes": [],
    "chapters": [],
    "missions": []
  }
}
```

Cada Missão deve incluir, no mínimo: `id`, `name`, `subtitle`, `mission_type`, `environment`, `duration_minutes`, `exercise_count` e `status`.

## Operação transacional

`release_initial_journey` deve ler a revisão já salva e executar tudo em uma única transação: bloquear a Avaliação, validar concorrência e status, validar Classe/Nível/Capítulo/Missões, criar ou atualizar a Jornada, criar atribuições, atualizar onboarding, marcar avaliação e revisão como aprovadas, alterar `profiles.journey_stage` para `dashboard` e registrar auditoria.

A função deve impedir liberação parcial, dupla liberação e liberação quando avaliação complementar ou liberação médica estiverem marcadas como obrigatórias.

## Segurança

- RLS ativa em todas as tabelas.
- Aventureiro não lê notas internas do Healer.
- Nenhuma Avaliação completa é salva no localStorage.
- Conteúdo do banco é inserido com `textContent`, não com `innerHTML`.
- A liberação nunca é executada offline.
- Concorrência deve ser revalidada no backend no momento da liberação.

## Validação realizada

- Estrutura HTML semântica.
- CSS responsivo para celular, tablet e desktop.
- JavaScript sem dados demonstrativos.
- Estados de carregamento, erro, acesso negado, rascunho e conflito.
- Fluxos de salvar, solicitar complementação, revisão final, liberação e logout.

A validação real de autenticação, RLS e transações depende das tabelas e RPCs existentes no projeto Supabase.
