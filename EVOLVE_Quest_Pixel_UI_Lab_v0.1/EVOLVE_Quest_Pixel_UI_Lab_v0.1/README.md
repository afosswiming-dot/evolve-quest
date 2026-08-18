# EVOLVE Quest — Pixel UI Lab v0.1

Página experimental isolada para validar a nova linguagem visual antes de qualquer aplicação no Web App oficial.

## Rota desejada

`/pixel-ui-lab/`

## O que está implementado

- PixelButton: primary, secondary, reward, disabled, hover e pressed
- PixelBadge: active, completed e locked
- XPBar dinâmica
- LocationTabs Academia/Casa com troca real de conteúdo
- MissionCard dinâmica com estados disponível, em andamento, concluída e bloqueada
- HealerDialog usando o sprite fornecido
- MissionCompleteModal
- Dados mockados
- Mobile-first (360–430px), tablet e desktop
- Foco visível, labels e `prefers-reduced-motion`
- Sem Supabase
- Sem alterações em outros módulos

## Estrutura

- `index.html`
- `styles/`
- `src/components/`
- `src/data/`
- `assets/pixel/characters/`
- `assets/pixel/icons/`

## Publicação no projeto atual

Coloque a pasta inteira `pixel-ui-lab` na raiz do repositório `evolve-quest`.
Com o deploy atual da Vercel, a rota ficará disponível em:

`https://evolve-quest.vercel.app/pixel-ui-lab/`

## Observação

As imagens de conceito completas não foram inseridas na página. Apenas o sprite do Healer e pequenos ícones rasterizados foram utilizados como assets gráficos.
