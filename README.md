# EVOLVE Quest — Piloto 2.4

## Módulos oficiais integrados

- Login
- Cadastro
- Boas-vindas
- Avaliação Inicial
- Tela de Espera
- Painel do Aventureiro
- Missões
- Registro da Missão

## Rotas provisórias ainda aguardando os módulos oficiais

- Checkpoint
- Feedback de Evolução
- Progressão

As rotas provisórias mantêm o fluxo navegável, mas serão substituídas pelos respectivos módulos finais.

## Estado central da Jornada

A navegação do Aventureiro utiliza exclusivamente `profiles.journey_stage`:

- `welcome` → `/boas-vindas/`
- `assessment` → `/avaliacao-inicial/`
- `waiting_healer` → `/tela-espera/`
- `dashboard` → `/painel-aventureiro/`
- `checkpoint` → `/checkpoint/`
- `feedback` → `/feedback-evolucao/`
- `progression` → `/progressao/`

## Fluxo integrado

Login → Cadastro → confirmação de e-mail → Login → Boas-vindas → Avaliação Inicial → Tela de Espera → Painel do Aventureiro → Missões → Registro da Missão → Painel do Aventureiro.

## Registro da Missão

A Página das Missões encaminha para:

`/registro-missao/?execution_id=UUID`

O registro é salvo por meio da função transacional `register_mission_feedback` no Supabase.

## Configuração do Supabase Auth

Em **Authentication → URL Configuration**, autorize:

- `https://evolve-quest.vercel.app/login/`
- `https://evolve-quest.vercel.app/login/?confirmed=1`
