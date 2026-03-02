# MotoDelivery - TODO

## Fase 1: Schema do banco e estrutura base
- [x] Schema do banco: users (com role: admin/cliente/motoboy), rides, locations, pricing_settings, notifications
- [x] Migração do banco de dados (pnpm db:push)
- [x] Helpers de DB em server/db.ts
- [x] Configuração de tema e estilos globais (index.css)
- [x] Estrutura de rotas no App.tsx (admin, cliente, motoboy)

## Fase 2: Backend - Routers tRPC
- [x] Router de autenticação com RBAC (admin, cliente, motoboy)
- [x] Router de corridas (criar, listar, atualizar status)
- [x] Router de motoboys (online/offline, aprovar, listar)
- [x] Router de rastreamento (salvar localização, buscar última posição)
- [x] Router de configurações de preço
- [x] Router de faturamento (admin)
- [x] Lógica de cálculo de preço (até 5km = R$10, acima + R$2/km)

## Fase 3: WebSocket e OSRM
- [x] Servidor WebSocket (Socket.IO) para rastreamento em tempo real
- [x] Integração com OSRM para cálculo de rotas
- [x] Geocoding via Nominatim (OpenStreetMap)
- [x] Cálculo de distância e tempo estimado

## Fase 4: Painel Admin
- [x] Layout do painel admin com sidebar
- [x] Mapa em tempo real com todos os motoboys e corridas
- [x] Lista de corridas com filtros e status
- [x] Lista de motoboys online/offline
- [x] Aprovação de motoboys
- [x] Configuração de regras de preço
- [x] Dashboard de faturamento total

## Fase 5: Painel Cliente
- [x] Layout do painel cliente
- [x] Formulário de criação de corrida (endereço coleta + entrega)
- [x] Autocomplete de endereços via Nominatim
- [x] Preview de rota no mapa com distância/tempo/valor
- [x] Confirmação e criação da corrida
- [x] Rastreamento em tempo real da corrida ativa
- [x] Histórico de corridas

## Fase 6: Painel Motoboy (PWA)
- [x] Layout PWA do painel motoboy
- [x] Toggle online/offline
- [x] Notificação de nova corrida disponível
- [x] Aceitar/recusar corrida
- [x] Envio de GPS a cada 5 segundos via WebSocket
- [x] Mapa com rota até o cliente/destino
- [x] Atualização de status da corrida (A CAMINHO, EM ENTREGA, FINALIZADA)
- [x] Histórico de corridas concluídas

## Fase 7: Notificações, Testes e PWA
- [x] Sistema de notificações in-app (novas corridas, cancelamentos, atualizações)
- [x] PWA manifest e service worker
- [x] Testes vitest para routers principais (11 testes passando)
- [x] Checkpoint final
