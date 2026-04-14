/** Parser de argumentos CLI. */

export interface BotArgs {
  room: string | null;
  hub: string | null;
  participant: string | null;
  help: boolean;
}

export function parseArgs(argv: string[]): BotArgs {
  const args: BotArgs = {
    room: null,
    hub: null,
    participant: null,
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
      case '--participant':
      case '-p':
        args.participant = next ?? null;
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
