# EVOLVE Quest — Registro da Missão v1.0.1 Integrado

Módulo mobile-first integrado ao Piloto 2.3 e ao Supabase.

## Fluxo

`/missoes/` → `/registro-missao/?execution_id=UUID` → `/painel-aventureiro/`

## Integração

- valida a sessão pelo Supabase Auth;
- identifica o Aventureiro por `auth.uid()`;
- valida que o `execution_id` pertence ao usuário autenticado;
- aceita somente execuções em `awaiting_record`;
- chama a função transacional `register_mission_feedback`;
- cria o Registro da Missão;
- atualiza a execução;
- atualiza o progresso semanal;
- cria alerta ao Healer quando necessário;
- mantém fila local apenas como contingência offline.

## Arquivos

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

## Segurança

A Publishable Key é utilizada no navegador. Nenhuma chave administrativa está presente no módulo. As operações sensíveis são executadas pela função transacional no banco, que verifica `auth.uid()`.
