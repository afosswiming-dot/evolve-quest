# EVOLVE Quest — Piloto 2.3

## Módulos integrados

- Login
- Cadastro
- Boas-vindas
- Avaliação Inicial
- Painel do Aventureiro
- Missões

## Rotas preparadas provisoriamente

- Tela de Espera
- Registro da Missão
- Checkpoint
- Feedback de Evolução
- Progressão

Essas rotas provisórias não substituem os módulos oficiais. Elas existem para manter o fluxo navegável até que os respectivos ZIPs finais sejam integrados.

## Estado central

A navegação utiliza `profiles.journey_stage`:

`welcome`, `assessment`, `waiting_healer`, `dashboard`, `checkpoint`, `feedback`, `progression`.

## Fluxo atual

Login → Cadastro → confirmação de e-mail → Login → Boas-vindas → Avaliação Inicial → Tela de Espera → Painel → Missões → Registro → Painel → Checkpoint → Feedback → Progressão.

## Configuração Supabase

Autorizar:

- `https://evolve-quest.vercel.app/login/`
- `https://evolve-quest.vercel.app/login/?confirmed=1`

em Authentication → URL Configuration → Redirect URLs.
