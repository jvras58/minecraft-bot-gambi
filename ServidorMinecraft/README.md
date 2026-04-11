# 🤖 Minecraft AI Agents (Local LLM)

Este projeto conecta **Modelos de Linguagem Locais** (como Llama 3 ou Mistral rodando via Ollama) a bots dentro de um servidor de Minecraft. O objetivo é criar agentes autônomos que conseguem conversar, interagir e "viver" no mundo do jogo, rodando tudo localmente no seu PC.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

  * **Java 21 (JDK):** Necessário para rodar o servidor de Minecraft. Recomendamos o [Amazon Corretto 21](https://docs.papermc.io/misc/java-install/).
  * **Ollama:** Para rodar a Inteligência Artificial localmente. [Baixe aqui](https://ollama.com/).


-----

## 🎮 Parte 1: Instalando o Jogo (O Visor)

Para ver os bots interagindo, você precisa do jogo instalado. O servidor em si não tem gráficos.

1.  **Opção A (Oficial):** Instale o **Minecraft Launcher** da Microsoft Store.
2.  **Opção B (Alternativa):** Instale o **TLauncher** ou similar.
3.  **Importante:** Abra o jogo pelo menos uma vez para garantir que baixou os arquivos da versão **1.21.x** (ou a versão que você pretende usar).

-----

## 🌍 Parte 2: Configurando o Servidor (O Mundo)

Utilizamos o **PaperMC**, que é o "motor" do mundo.

### 1\. Instalação

1.  Troque a versão do Paper se preferir [PaperMC](https://papermc.io/downloads/paper).
2.  a pasta chamada `ServidorMinecraft` tem o arquivo `.jar` lá dentro ou se preferir trocar so colocar lá com o mesmo nome.
3.  No Linux há um `start.sh` na mesma pasta com o conteúdo:
    ```bash
    java -Xms4G -Xmx4G -jar paper.jar
    ```
    Antes de rodar, dê permissão de execução:
    ```bash
    chmod +x start.sh
    ./start.sh
    ```
    (O servidor vai fechar sozinho se for a primeira vez; isso cria o arquivo `eula.txt`.)

    No Windows, rode o `start.bat` em vez disso. O servidor também fecha após a primeira execução.
4.  Abra o arquivo `eula.txt` criado e mude para `eula=true`.
5.  o `4G` define o quanto o java pode usar de memoria (use a documentação do Paper para entender melhor...)

### 2\. Configuração de Rede e Acesso

Abra o arquivo `server.properties` e altere as seguintes linhas para permitir bots e conexões locais sem autenticação original:

```properties
online-mode=false
max-players=20

# Aumenta o tempo que o servidor espera antes de chutar alguém (Para não ficar chutando o bot)
network-compression-threshold=-1
max-tick-time=-1
player-idle-timeout=0
```

- `network-compression-threshold=-1`: Desativa a compressão de dados. Isso deixa a conexão um pouco mais "gorda", mas tira o peso da CPU de ficar compactando dados, o que ajuda o bot a responder mais rápido.
- `player-idle-timeout=0`: Impede o servidor de chutar jogadores parados (AFK).

### 3\. Compatibilidade de Versões (ViaVersion)

Para garantir que qualquer cliente (TLauncher, Bots, Versões antigas) consiga entrar no servidor, instalamos plugins de compatibilidade.

1.  Baixe o **ViaVersion** [aqui (CI Builds)](https://ci.viaversion.com/job/ViaVersion/).
2.  (Opcional) Baixe o **ViaBackwards** [aqui](https://ci.viaversion.com/job/ViaBackwards/).
3.  Coloque os arquivos `.jar` dentro da pasta `plugins` do seu servidor (garanta que já tenha tentado rodar pelo menos uma vez).
4.  Deixarei os dois arquivos numa pasta _plugins_viaversion se preferir utiliza-los