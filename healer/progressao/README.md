# EVOLVE Quest — Central de Progressões

Central do Healer/Admin para:

- listar Aventureiros com Jornada em acompanhamento;
- visualizar Nível, Capítulo, sessões e progresso;
- acompanhar Checkpoint e análise existentes;
- identificar o próximo Capítulo ativo pela ordem oficial;
- acessar a Jornada e o fluxo administrativo protegido.

## Configuração

O navegador usa apenas a Publishable Key e mantém a sessão administrativa em
`evolve-quest-healer-auth`.

## RPC principal

- `get_healer_progressions(...)`

A alteração efetiva de Capítulo não acontece nesta tela. O botão **Gerenciar
Progressão** abre o perfil do Aventureiro, que reutiliza:

- `get_healer_journey_management(p_adventurer_id uuid)`
- `change_adventurer_chapter(p_adventurer_id uuid, p_new_chapter_id uuid, p_observation text)`

## Regra de progresso

O percentual vem de `adventurer_journeys.chapter_progress`, calculado pelas
sessões concluídas em `mission_registrations` sobre as sessões planejadas.
Somente capítulos `active` participam da sequência normal.

## Segurança e limites

- A RPC valida `auth.uid()`, `is_healer_or_admin()` e o vínculo de gestão.
- RPCs administrativas não possuem execução para `anon`.
- Nenhuma Service Role é exposta no navegador.
- O navegador não altera diretamente Classe, Nível, Capítulo, `journey_stage`,
  status da Jornada, Checkpoint ou Progressão aprovada.
- A avaliação completa do Checkpoint continua fora deste módulo.
