# Métricas de LLM: streaming vs. não-streaming

> Registro de decisão técnica — 2026-05-17

## O problema

Ao coletar as métricas de inferência (tokens de entrada/saída, tokens por
segundo), os valores chegavam como `undefined` tanto no log do hub quanto no
bot:

```
[gambi] llm.complete {
  metrics: {
    ttftMs: 6235,
    durationMs: 7864,
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    tokensPerSecond: undefined,
  },
}
```

A suspeita inicial foi a atualização do `gambi-sdk` (0.3.0 → 0.6.0). **Não era
isso.**

## A causa real

O `undefined` apareceu quando o bot passou a usar **streaming** (`streamText`
em vez de `generateText`). A prova está no próprio log do hub:

| Modo            | `ttftMs` vs `durationMs` | Tokens        |
|-----------------|--------------------------|---------------|
| Não-streaming   | iguais (`3142` / `3142`) | preenchidos   |
| Streaming       | diferentes (`6235` / `7864`) | `undefined` |

Quando `ttftMs ≠ durationMs`, o streaming está ativo — e foi exatamente aí que
os tokens sumiram.

### Por quê

- **Não-streaming:** o objeto `usage` (contagem de tokens) faz parte do
  *padrão* da API OpenAI-compatible. Ele vem **sempre** no corpo JSON da
  resposta. Ollama, vLLM, LM Studio, llama.cpp, LocalAI — todos devolvem.
- **Streaming:** o `usage` passa a ser **opcional**. Só chega se o servidor do
  modelo emitir um *chunk final de usage*. Alguns backends emitem, outros não.
  O Ollama testado não emitia — então o hub não tinha o que reportar.

A documentação do Gambi confirma: `outputTokens` *"pode estar ausente ao fazer
streaming sem usage reporting"*.

## A decisão: usar não-streaming

O fator decisivo é o tema do TCC — uma **avaliação comparativa** de LLMs locais
em **hardware heterogêneo**. Os participantes não usam só Ollama; podem usar
vLLM, LM Studio, llama.cpp, etc.

Uma métrica que só pode ser coletada para *alguns* backends **não serve para
comparar**. Ter `tokens/s` do vLLM mas não do Ollama inviabiliza uma tabela
comparativa. **Consistência entre backends vale mais do que ter uma métrica
extra para poucos.**

### O trade-off

Não é possível ter, com uma única chamada, as duas coisas ao mesmo tempo:

| Modo            | Tokens / tokens-por-segundo        | TTFT separado          |
|-----------------|------------------------------------|------------------------|
| Streaming       | inconsistente entre backends ❌    | sim ✅                 |
| Não-streaming   | confiável em todos os backends ✅  | não (= duração total)  |

O **TTFT** (time-to-first-token) é uma métrica interessante, mas medida via
streaming ela é uma "falsa vantagem": custa a comparabilidade dos tokens. Em
não-streaming, o TTFT não existe separado — você recebe a resposta inteira de
uma vez, então `ttftMs == durationMs`.

Optou-se por **não-streaming (`generateText`)**: perde-se o TTFT isolado, mas
ganham-se `inputTokens`, `outputTokens` e `tokens/segundo` confiáveis em
qualquer backend local — que é o coração da tese.

## Estado atual das métricas

Coletadas por ciclo (tabela `cycle_responses` no Supabase):

- **Bot-observed** (`llm_*`): duração total, tokens (via `usage`),
  tokens/segundo. `llm_ttft_ms` fica `null` (não-streaming).
- **Hub-observed** (`hub_*`): `durationMs`, `ttftMs` (≈ duração, em
  não-streaming), tokens e tokens/segundo — medidos no hub, sem o ruído de
  rede do lado do cliente. Capturados via SSE do evento `llm.complete`.

A diferença entre a duração medida no bot e no hub corresponde ao overhead de
rede/roteamento — pode ser registrada como nota de método no TCC.

## Se for preciso recuperar o TTFT no futuro

Seria necessário voltar ao streaming **e** garantir que todo backend usado
emita `usage` no stream (ex.: `stream_options: { include_usage: true }`, com
versões dos servidores que suportem). Enquanto não houver essa garantia para
todos os participantes, não-streaming é a escolha correta para o experimento.
