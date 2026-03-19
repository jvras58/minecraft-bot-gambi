/**
 * sleep.ts
 *
 * Função utilitária para delays assíncronos.
 * Permite pausar execução de código por um tempo definido (ms).
 *
 * Principais funções:
 *   - sleep: retorna Promise resolvida após o tempo especificado.
 *
 * Extensão:
 *   - Adicionar funções de controle de tempo, como waitUntil ou timeout.
 *
 * Uso:
 *   Utilizado em loops, reconexão e delays entre ações do bot.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
