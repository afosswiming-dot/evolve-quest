# EVOLVE Quest — Boas-vindas v1.0.1 integrada

Versão integrada ao Supabase criada a partir do módulo oficial enviado. O arquivo original não foi alterado.

## Responsabilidade deste módulo

- validar a sessão do Aventureiro;
- ler o perfil em `public.profiles`;
- criar ou atualizar o registro em `public.adventurer_onboarding`;
- encaminhar para Avaliação Inicial ou Painel do Aventureiro.

## Rotas esperadas

- Cadastro: `cadastro.html`
- Avaliação Inicial: `avaliacao-inicial.html`
- Painel do Aventureiro: `painel-aventureiro.html`

As rotas ficam centralizadas no objeto `CONFIG`, no início de `script.js`.

## Dados registrados

Ao abrir:
- `onboarding_status = welcome`
- `welcome_viewed_at`

Ao iniciar a avaliação:
- `onboarding_status = assessment_started`
- `assessment_status = in_progress`
- `assessment_pending = true`
- `assessment_started_at`

Ao responder depois:
- `onboarding_status = assessment_pending`
- `assessment_status = not_started`
- `assessment_pending = true`
- `assessment_postponed_at`

## Pagamento

Este módulo não confirma pagamentos. A validação financeira pertence ao módulo Pagamento/Assinatura. Quando essa camada for integrada, a entrada nesta página deverá ser liberada somente para uma assinatura aprovada ou ativa.

## Execução

Use servidor HTTP/HTTPS. Não abra diretamente com `file://`, pois autenticação e navegação entre módulos dependem de uma origem web consistente.
