/**
 * gambi-sdk.d.ts
 *
 * Declaração de tipos para SDK externo Gambi.
 * Permite tipagem de integração com Gambi Hub e LLMs.
 *
 * Principais tipos:
 *   - GambiProvider: tipo genérico para provedores do SDK.
 *   - createGambi: função para instanciar provedores.
 *
 * Extensão:
 *   - Expandir conforme SDK evolui, adicionar novos métodos ou tipos.
 *
 * Uso:
 *   Utilizado por GambiLLM para integração com backend de IA.
 */
declare module 'gambi-sdk' {
	export type GambiProvider = any;
	export function createGambi(options: any): GambiProvider;
}
