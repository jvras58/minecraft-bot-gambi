export interface BotArgs {
  room: string | null;
  hub: string | null;
  model: string | null;
  help: boolean;
}

/**
 * Parse CLI arguments.
 *
 * Supports:
 *   --room ABC123 / -r ABC123
 *   --hub http://localhost:3000
 *   --model llama3
 *   --help / -h
 */
export function parseArgs(argv: string[]): BotArgs {
  const args: BotArgs = {
    room: null,
    hub: null,
    model: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--room':
      case '-r':
        args.room = next ?? null;
        i++;
        break;
      case '--hub':
        args.hub = next ?? null;
        i++;
        break;
      case '--model':
        args.model = next ?? null;
        i++;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}
