# EVOLVE Quest — Gestão de Missões v0.1

Módulo administrativo responsável pela criação e manutenção editorial dos modelos oficiais de Missões.

## Estrutura

```text
healer-missions/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Na integração oficial:

```text
healer/
└── missoes/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── README.md
    └── detalhe/
        ├── index.html
        ├── styles.css
        └── app.js
```

A v0.1 utiliza lista e editor lateral na mesma interface, mantendo a separação preparada.

## Funcionalidades implementadas

- autenticação administrativa;
- validação de Healer ou Admin;
- pesquisa com debounce;
- filtros por código, ambiente, status, nível e Capítulo;
- paginação;
- criação e edição de Missões;
- Alpha, Bravo e Charlie;
- Academia e Casa;
- associação com Capítulo e Nível;
- seções oficiais:
  - Preparação;
  - Combate;
  - Aprimoramento;
  - Conclusão;
- adição de exercícios da Biblioteca;
- séries;
- repetições;
- duração;
- descanso;
- observação do Healer;
- ordenação acessível com botões;
- movimentação entre seções;
- duplicação de item;
- remoção de item;
- pré-visualização editorial;
- salvamento como rascunho;
- publicação;
- duplicação controlada da Missão;
- arquivamento;
- estados vazios, loading e erro;
- responsividade mobile, tablet e desktop.

## Configuração

No `app.js`, substitua:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a Publishable Key no navegador.

## Tabelas esperadas

### `missions`

- `id`
- `chapter_id`
- `code`
- `mission_type`
- `environment`
- `name`
- `subtitle`
- `objective`
- `estimated_duration_minutes`
- `status`
- `version`
- `healer_notes`
- `created_by`
- `updated_by`
- `published_at`
- `archived_at`
- `created_at`
- `updated_at`

### `mission_exercises`

- `id`
- `mission_id`
- `exercise_id`
- `section`
- `sets`
- `repetitions`
- `duration_seconds`
- `rest_seconds`
- `healer_note`
- `alternative_exercise_id`
- `display_order`
- `created_at`
- `updated_at`

## RPCs esperadas

- `get_healer_missions(...)`
- `get_mission_editor_detail(p_mission_id uuid)`
- `save_mission_draft(p_mission jsonb, p_exercises jsonb)`
- `duplicate_mission(p_mission_id uuid, p_target_environment text, p_target_chapter_id uuid)`
- `publish_mission(p_mission_id uuid)`
- `archive_mission(p_mission_id uuid)`

A Biblioteca usa também:

- `get_healer_exercises(...)`

## Regras editoriais da v0.1

- Missões começam em `draft`.
- Cada versão Academia ou Casa é uma Missão independente.
- As seções são fixas: `preparation`, `combat`, `improvement` e `conclusion`.
- Ao publicar, exigir nome, código, ambiente, Capítulo, objetivo, duração e ao menos um exercício.
- Exercícios arquivados não podem entrar em novas Missões.
- Missões já atribuídas devem gerar nova versão antes de alterações estruturais.
- A duplicação cria novo ID e status `draft`.
- A duplicação não copia atribuições, execuções ou Registros.
- A pré-visualização é apenas editorial e não cria execução.

## Segurança

- manter RLS ativa;
- validar `auth.uid()` e `is_healer_or_admin()`;
- revogar execução das RPCs para `anon`;
- liberar apenas para `authenticated`;
- não usar Service Role no navegador;
- não confiar em `role` ou `healer_id` enviados pelo frontend;
- proteger Missões já atribuídas;
- registrar auditoria;
- preservar versões anteriores.

## Limites do módulo

Este módulo altera apenas:

- `missions`;
- `mission_exercises`;
- versionamento editorial;
- `admin_audit_logs`.

Ele não altera:

- `mission_assignments`;
- `mission_executions`;
- `mission_registrations`;
- Jornada;
- Classe;
- Nível;
- Capítulo atual do Aventureiro;
- Progressão.
