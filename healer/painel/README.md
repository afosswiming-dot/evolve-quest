# EVOLVE Quest — Dashboard do Healer v0.1

Dashboard administrativo responsivo para consulta e direcionamento operacional. Este módulo não executa análise, prescrição, liberação de Jornada, resolução de alertas ou progressão.

## Estrutura

```text
healer-dashboard/
├── assets/
│   └── evolve-logo.webp
├── index.html
├── styles.css
├── app.js
└── README.md
```

Na integração oficial, mover os arquivos para `healer/painel/`.

## Configuração do Supabase

Em `app.js`, substitua:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a **Publishable Key**. Nunca coloque a Service Role no navegador.

## Autorização

O carregamento valida novamente:

- sessão do Supabase Auth;
- `profiles.id = auth.uid()`;
- `profiles.role IN ('healer', 'admin')`;
- `profiles.account_status = 'active'`.

Usuários não autorizados têm a sessão encerrada e são redirecionados para `/healer/login/`.

## Indicadores

O card **Registros recentes** usa um único período: **últimos 7 dias**.

O frontend tenta primeiro as RPCs seguras:

- `get_healer_dashboard_summary()`;
- `get_healer_priority_items()`;
- `get_healer_recent_activity()`.

Caso a RPC de resumo ainda não exista, o app usa consultas agregadas com `count: 'exact'`. Prioridades e atividade recente permanecem em estado vazio real até as respectivas RPCs existirem.

### Retorno esperado de `get_healer_dashboard_summary()`

```json
{
  "pendingAssessments": 4,
  "activeAdventurers": 18,
  "newAlerts": 2,
  "pendingCheckpoints": 3,
  "recentRegistrations": 7
}
```

## Segurança recomendada para RPCs

- validar `auth.uid()` internamente;
- confirmar Healer ou Admin ativo;
- não aceitar `healer_id` enviado pelo frontend;
- definir `search_path` fixo;
- revogar execução para `anon`;
- liberar somente para `authenticated`;
- retornar apenas campos necessários;
- manter RLS ativa nas tabelas.

## Dados lidos

- Supabase Auth: sessão e usuário.
- `profiles` e, opcionalmente, `healer_profiles`.
- Resumos de `initial_evaluations`, `healer_alerts`, `mission_registrations`, `checkpoint_assignments`, `adventurer_journeys`, `missions` e perfis dos Aventureiros.

O Dashboard não carrega respostas clínicas completas, exercícios ou prescrições inteiras.

## Dados gravados

Por padrão, nenhum dado funcional. O registro opcional de visualização em `healer_activity` ou `admin_audit_logs` não foi ativado no frontend desta versão.

## Teste local

Por usar módulos de autenticação e rotas, execute em servidor local, por exemplo:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`. Para testar a rota oficial, sirva o projeto completo mantendo `healer/painel/`.

## Estados previstos

- carregamento;
- configuração ausente;
- acesso negado;
- sessão expirada;
- erro de conexão com nova tentativa;
- zero real nos indicadores;
- prioridades e atividades vazias;
- mobile, tablet e desktop.
