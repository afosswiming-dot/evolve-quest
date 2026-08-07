# EVOLVE Quest — Piloto v2.5 integrado

Integração física do Piloto v2.4 do Aventureiro com os módulos administrativos recebidos:
- Login do Healer
- Dashboard
- Avaliações / liberação
- Aventureiros e detalhe
- Registros
- Alertas
- Checkpoints
- Progressão
- Biblioteca de exercícios
- Gestão de missões
- Configurações/Admin

## Rotas
- /healer/login/
- /healer/painel/
- /healer/avaliacoes/
- /healer/aventureiros/
- /healer/aventureiro/?adventurer_id=UUID
- /healer/registros/
- /healer/alertas/
- /healer/checkpoints/
- /healer/progressao/
- /healer/exercicios/
- /healer/missoes/
- /admin/configuracoes/

## Supabase
Os módulos foram apontados para o mesmo projeto e Publishable Key já usados pelo Piloto v2.4. Nenhuma Service Role foi incluída.

## Importante para produção
A conta administrativa ainda precisa existir no Supabase Auth e ser promovida para admin antes do primeiro login administrativo.
Os módulos administrativos dependem das tabelas/RPCs previstas nos respectivos briefings. A integração de arquivos e rotas não substitui a validação/migração completa do schema/RPCs.
