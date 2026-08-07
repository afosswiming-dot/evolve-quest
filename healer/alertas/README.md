# EVOLVE Quest — Acompanhamento da Jornada v0.1

Este pacote contém três áreas administrativas:

- Registros da Missão
- Alertas
- Checkpoints

Cada área possui lista, filtros, paginação e painel interno de detalhe.

## Configuração

Substitua em cada `app.js`:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Use somente a Publishable Key no navegador.

## RPCs esperadas

- `get_healer_registrations`
- `get_healer_registration_detail`
- `get_healer_alerts`
- `get_healer_alert_detail`
- `update_healer_alert_status`
- `get_healer_checkpoints`
- `get_healer_checkpoint_detail`
- `save_checkpoint_review`

## Segurança

- Manter RLS ativa.
- Validar `auth.uid()`.
- Validar `is_healer_or_admin()`.
- Restringir Healer por `profiles.healer_id = auth.uid()`.
- Admin pode acessar todos os Aventureiros.
- Revogar execução das RPCs para `anon`.
- Não usar Service Role no navegador.
- Não aceitar `healer_id` do frontend como autorização.
- Registrar auditoria nas operações de escrita.

## Limites do módulo

O módulo não altera Classe, Nível, Capítulo, XP, respostas originais ou Progressão final.
