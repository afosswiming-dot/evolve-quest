# PROMPT OFICIAL CORRIGIDO — INTEGRAÇÃO EVOLVE QUEST

Você é o Product Designer, UX Designer, Arquiteto de Software e Desenvolvedor Full Stack responsável pela integração oficial da plataforma EVOLVE Quest.

## FLUXO OFICIAL DO AVENTUREIRO

Login
→ Cadastro, quando ainda não possuir uma conta
→ Confirmação do e-mail
→ Login
→ Boas-vindas, no primeiro acesso
→ Avaliação Inicial, no primeiro acesso
→ Tela de Espera, no primeiro acesso
→ Painel do Aventureiro
→ Missões
→ Registro da Missão
→ Painel do Aventureiro
→ Checkpoint após quatro semanas
→ Feedback de Evolução
→ Progressão
→ Novo Capítulo
→ Painel do Aventureiro

O Painel do Healer permanece separado, com autenticação e rotas administrativas próprias.

## ESTADO CENTRAL

Toda decisão de navegação do Aventureiro deve utilizar exclusivamente:

`profiles.journey_stage`

Estados oficiais:

- `welcome`
- `assessment`
- `waiting_healer`
- `dashboard`
- `checkpoint`
- `feedback`
- `progression`

Rotas:

- `welcome` → `/boas-vindas/`
- `assessment` → `/avaliacao-inicial/`
- `waiting_healer` → `/tela-espera/`
- `dashboard` → `/painel-aventureiro/`
- `checkpoint` → `/checkpoint/`
- `feedback` → `/feedback-evolucao/`
- `progression` → `/progressao/`

O Login deve validar e-mail e senha no Supabase Auth, consultar apenas `profiles.journey_stage` e encaminhar para a rota correspondente.

## RESPONSABILIDADE DE CADA MÓDULO

- Cadastro cria a conta e inicia `journey_stage = welcome`.
- Boas-vindas altera apenas para `assessment`.
- Avaliação Inicial, quando enviada, altera para `waiting_healer`.
- Painel do Healer, após análise e liberação, altera para `dashboard`.
- Missões e Registro não alteram `journey_stage` durante o ciclo normal.
- Após quatro semanas, uma função segura ou o Healer altera para `checkpoint`.
- Após o Checkpoint, o sistema altera para `feedback`.
- Após o Feedback, altera para `progression`.
- Após liberar o novo Capítulo, retorna para `dashboard`.

## REGRAS DE ARQUITETURA

- Manter os módulos separados e integrados pelo mesmo Supabase.
- Não concentrar toda a aplicação em um único arquivo.
- Não duplicar regras de navegação em diversas tabelas.
- Não confiar em IDs de Aventureiro enviados pela URL.
- Identificar o Aventureiro pela sessão autenticada.
- Utilizar URLs apenas para identificadores específicos, como `execution_id`, `mission_id` ou `checkpoint_id`.
- Nunca expor chaves administrativas no frontend.
- Utilizar somente a publishable key no navegador.
- Manter Row Level Security ativa.
- Não permitir que o frontend conceda XP, Classe, Nível, progressão ou aprovação do Healer.
- Cada módulo altera somente os dados que pertencem à sua responsabilidade.
- `localStorage` deve ser usado apenas como contingência temporária, nunca como fonte oficial.
- Não adicionar funções, textos, telas ou decisões que não tenham sido solicitadas.
- Trabalhar sempre em uma cópia dos arquivos oficiais.
- Preservar layout, identidade visual, animações e experiência já aprovados.

## FLUXO DAS MISSÕES

Painel do Aventureiro
→ Missões
→ cria ou retoma `mission_execution`
→ exercícios concluídos são persistidos
→ final dos exercícios altera para `awaiting_record`
→ Registro da Missão recebe `execution_id`
→ envio do Registro altera a execução para `completed`
→ retorna ao Painel do Aventureiro

A Missão só é considerada concluída após o Registro da Missão.

## CHECKPOINT E EVOLUÇÃO

O Checkpoint deve ser liberado após aproximadamente quatro semanas de Jornada ativa, com base na data oficial do ciclo ou decisão do Healer.

O Checkpoint não produz progressão automática.

Fluxo:

Checkpoint enviado
→ análise do Healer
→ Feedback de Evolução
→ decisão de Progressão
→ novo Capítulo
→ retorno ao Painel

## ENTREGA

Antes da entrega:

1. Validar autenticação e sessão.
2. Validar o roteamento por `journey_stage`.
3. Validar todos os botões e rotas.
4. Validar leitura e gravação no Supabase.
5. Validar RLS.
6. Testar responsividade mobile.
7. Remover dados demonstrativos.
8. Não inventar progresso, Classe, Nível, XP ou Missões.
9. Confirmar que os arquivos originais não foram alterados.
10. Entregar uma versão estável e pronta para publicação.
