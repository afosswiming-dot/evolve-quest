# EVOLVE Quest — Tela de Espera v0.1

Módulo mobile-first exibido após o envio da Avaliação Inicial e antes da liberação da Jornada pelo Healer.

## Arquivos

- `index.html` — estrutura da página e configuração pública.
- `styles.css` — identidade visual responsiva.
- `app.js` — sessão, leitura do perfil, atualização manual/automática, roteamento e logout.

## Configuração

No final de `index.html`, preencha apenas os dados públicos do projeto:

```js
window.EVOLVE_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabasePublishableKey: "SUA_PUBLISHABLE_KEY",
  routes: {
    welcome: "/boas-vindas/",
    assessment: "/avaliacao-inicial/",
    waiting_healer: "/tela-espera/",
    dashboard: "/painel-aventureiro/",
    checkpoint: "/checkpoint/",
    feedback: "/feedback-evolucao/",
    progression: "/progressao/",
    login: "/login/"
  },
  refreshIntervalMs: 60000
};
```

O intervalo é limitado automaticamente entre 45 e 90 segundos.

## Dependências

O cliente oficial `@supabase/supabase-js` v2 é carregado por ESM via jsDelivr. As fontes Cinzel e Inter são carregadas pelo Google Fonts.

## Banco de dados

A página lê apenas a linha autenticada da tabela `profiles`:

```sql
select id, preferred_name, full_name, account_status, journey_stage, profile_status
from public.profiles
where id = auth.uid();
```

Nenhum dado administrativo é alterado por este módulo.

## RLS mínima esperada

```sql
alter table public.profiles enable row level security;

create policy "Aventureiro lê o próprio perfil"
on public.profiles
for select
to authenticated
using (id = auth.uid());
```

Mantenha políticas equivalentes nas tabelas de onboarding caso sejam adicionadas em versões futuras.

## Comportamentos implementados

- validação da sessão autenticada;
- identificação pelo `auth.uid()`;
- leitura de `profiles.journey_stage`;
- permanência na tela em `waiting_healer`;
- redirecionamento automático para `/painel-aventureiro/` em `dashboard`;
- roteamento para os demais estados oficiais;
- atualização manual sem escrita no banco;
- atualização automática moderada;
- pausa da consulta com a página oculta;
- retomada ao voltar para a página;
- logout e redirecionamento para `/login/`;
- estados de carregamento, pendência, liberação, sessão expirada e erro de conexão.

## Publicação

Pode ser hospedado como projeto estático na Vercel. A rota final deve servir esta pasta em `/tela-espera/` ou ter um rewrite equivalente.

## Segurança

- Use somente a Publishable Key no frontend.
- Nunca inclua a Service Role Key.
- Não armazene respostas clínicas no navegador.
- Não use IDs recebidos por URL.
- Preserve o Row Level Security.


## Integração no Piloto 2.4

As credenciais públicas do projeto EVOLVE e as rotas oficiais já estão configuradas nesta cópia integrada.
