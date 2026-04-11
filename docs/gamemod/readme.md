# Configuração Rápida de Servidor Minecraft

Guia prático para configurar modo criativo, desativar mobs e obter poderes de admin (OP) em servidores Java Edition.

## Modo Criativo para Todos

Edite o arquivo `server.properties` (pare o servidor antes):
```
gamemode=1
force-gamemode=true
```
- `gamemode=1` define criativo como padrão para novos jogadores.
- `force-gamemode=true` força todos os jogadores a criativo ao entrar.
Reinicie o servidor. Para aplicar imediatamente: `/gamemode creative @a`. [minecraft.fandom](https://minecraft.fandom.com/wiki/Server.properties)

## Desativar Mobs/Spawns

No `server.properties`:
```
spawn-monsters=false
spawn-animals=false  # Opcional, desativa animais
```
Para controle total via comandos (chat/console com OP):
```
/gamerule doMobSpawning false  # Desativa todo spawn natural
/gamerule mobGriefing false    # Impede griefing de mobs (ex: Endermen)
/kill @e[type=!player]         # Mata todos mobs existentes
```
Efeitos persistem no mundo salvo. [serverminer](https://serverminer.com/article/how-to-disable-mobs-from-spawning-on-your-minecraft-server/)

## Tornar-se Admin (OP)

**Via Console do Servidor** (mais simples):
1. Acesse o console/painel do host.
2. Digite: `/op SeuNickExato` e Enter.
3. Confirmação aparece; agora você usa comandos como `/gamemode`.

**Via Arquivo ops.json** (manual):
1. Pare o servidor.
2. Edite `ops.json`:
   ```json
   [
     {
       "uuid": "SEU-UUID-AQUI",
       "name": "SeuNick",
       "level": 4,
       "bypassesPlayerLimit": false
     }
   ]
   ```
3. Pegue UUID em mcuuid.net. Reinicie. [glibhost](https://www.glibhost.com/blog/minecraft-como-adicionar-ou-remover-um-admin-ou-op-no-servidor-de-minecraft-java)

## Dicas Finais
- Sempre reinicie após editar `server.properties`.
- Comandos funcionam com OP (nível 4 = total).
- Teste em singleplayer primeiro se possível.
- Para hosts como Aternos: use console no painel web.