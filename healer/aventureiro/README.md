# EVOLVE Quest — Gestão dos Aventureiros v0.1

Módulo administrativo com duas telas:

- `healer-adventurers/`: lista, pesquisa, filtros, indicadores e paginação;
- `healer-adventurer-detail/`: perfil administrativo consolidado do Aventureiro.

## Configuração

Em cada `app.js`, substitua:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a Publishable Key no navegador.

## RPCs esperadas

### `get_healer_adventurers`

Recebe busca, filtros, paginação e ordenação. Deve validar `auth.uid()`, `is_healer_or_admin()` e restringir Healers por `profiles.healer_id = auth.uid()`.

### `get_healer_adventurer_detail`

Recebe apenas `p_adventurer_id`. Deve validar a autorização e retornar apenas os dados administrativos necessários.

## Segurança

- RLS deve permanecer ativa.
- RPCs administrativas devem revogar execução de `anon`.
- Não usar Service Role no frontend.
- Não confiar em `healer_id` enviado pelo navegador.
- Admin pode acessar todos os Aventureiros.
- Healer acessa somente Aventureiros vinculados.
- Não retornar respostas clínicas completas sem necessidade.

## Regra da v0.1

O módulo é prioritariamente de consulta. Não altera Classe, Nível, Capítulo, Missões, progresso, Checkpoints, Progressão ou status de alerta.

## Rotas

- Lista: `/healer/aventureiros/`
- Detalhe oficial: `/healer/aventureiros/{adventurerId}/`
- Alternativa v0.1: `/healer/aventureiro/?adventurer_id=UUID`
