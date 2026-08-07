# EVOLVE Quest — Biblioteca de Exercícios v0.1

Módulo administrativo responsável pela Biblioteca de Exercícios oficial da EVOLVE Quest.

## Entrega

```text
healer-exercises/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Na integração oficial:

```text
healer/
└── exercicios/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── README.md
```

## Funcionalidades implementadas

- validação de sessão administrativa;
- autorização para Healer ou Admin;
- pesquisa com debounce;
- filtros;
- paginação de 20 registros;
- cards de exercícios;
- criação;
- edição;
- duplicação;
- arquivamento;
- restauração;
- publicação por status `active`;
- mídia por URL;
- pré-visualização segura;
- estados vazios, loading e erro;
- interface Mobile First;
- navegação administrativa.

## Configuração

No `app.js`, substitua:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a Publishable Key no navegador.

## Tabela esperada

`exercises`

Campos editoriais esperados:

- `id`
- `name`
- `slug`
- `description`
- `instructions`
- `technical_points`
- `common_errors`
- `media_url`
- `thumbnail_url`
- `environment`
- `equipment`
- `movement_pattern`
- `primary_muscles`
- `secondary_muscles`
- `difficulty_level`
- `minimum_level`
- `status`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `archived_at`

## RPCs esperadas

### `get_healer_exercises(...)`

Responsável por busca, filtros, resumo e paginação.

### `save_exercise(p_exercise jsonb)`

Cria ou atualiza um exercício. Deve:

- validar `auth.uid()`;
- validar `is_healer_or_admin()`;
- sanitizar dados;
- gerar `slug`;
- registrar `created_by` ou `updated_by`;
- registrar auditoria;
- impedir duplicações inconsistentes.

### `archive_exercise(p_exercise_id uuid)`

Arquiva sem excluir.

### `restore_exercise(p_exercise_id uuid)`

Restaura um exercício arquivado.

## Segurança

- manter RLS ativa;
- revogar execução das RPCs para `anon`;
- liberar apenas para `authenticated`;
- não usar Service Role no frontend;
- não aceitar `role` ou `healer_id` enviados pelo navegador;
- não liberar edição para todo usuário autenticado;
- manter exercícios arquivados em Missões históricas;
- impedir exclusão de exercícios já usados em Missões publicadas.

## Regra editorial da v0.1

O módulo altera somente o catálogo `exercises`.

Ele não cria:

- `missions`;
- `mission_exercises`;
- `mission_assignments`;
- `mission_executions`;
- `mission_registrations`;
- dados da Jornada do Aventureiro.
