# EVOLVE Quest — Login do Healer v0.1

Módulo administrativo responsável por autenticar Healers e Administradores antes do acesso ao Painel.

## Estrutura

```text
healer-login/
├── assets/
│   ├── evolve-brand.png
│   └── quest-emblem.png
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Configuração do Supabase

No arquivo `app.js`, substitua:

```js
const SUPABASE_URL = 'COLE_AQUI_SUA_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'COLE_AQUI_SUA_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a **Publishable Key** no navegador. Nunca use a Service Role Key no frontend.

## Tabela necessária

A tabela `profiles` deve conter pelo menos:

- `id` — UUID igual ao `auth.users.id`;
- `email`;
- `full_name`;
- `preferred_name`;
- `role` — `healer` ou `admin` para acesso administrativo;
- `account_status` — deve ser `active`;
- `updated_at`.

## Fluxo de autorização

1. Autentica e-mail e senha pelo Supabase Auth.
2. Obtém `session.user.id`.
3. Consulta `profiles.id = session.user.id`.
4. Verifica `role in ('healer', 'admin')`.
5. Verifica `account_status = 'active'`.
6. Redireciona para `/healer/painel/`.
7. Em qualquer falha de autorização, encerra a sessão.

## RLS recomendada

Mantenha RLS ativa e utilize uma função segura baseada em `auth.uid()` para políticas administrativas. Não autorize acesso apenas por `auth.role() = 'authenticated'`.

## Execução local

Não abra o HTML diretamente com `file://`. Use um servidor local:

```bash
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

## Publicação

O conteúdo pode ser publicado em Vercel dentro da rota do projeto:

```text
healer/login/
```

Confirme no Supabase Auth que a URL de recuperação está autorizada:

```text
https://SEU-DOMINIO/healer/login/
```
