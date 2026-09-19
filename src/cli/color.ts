export function supportsColor(): boolean {
  return process.stdout.isTTY === true;
}

const ansi = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  green: '\u001b[32m',
  cyan: '\u001b[36m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  white: '\u001b[37m',
};

export function colorize(text: string, color: keyof typeof ansi): string {
  if (!supportsColor()) return text;
  return `${ansi[color]}${text}${ansi.reset}`;
}

export function colorLabels() {
  return {
    danger: (text: string) => colorize(text, 'red'),
    warning: (text: string) => colorize(text, 'yellow'),
    success: (text: string) => colorize(text, 'green'),
    info: (text: string) => colorize(text, 'cyan'),
    accent: (text: string) => colorize(text, 'blue'),
    bold: (text: string) => colorize(text, 'white'),
  };
}

export function progressBar(percent: number, width = 20, filledChar = '#', emptyChar = '.') {
  const safePercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((safePercent / 100) * width);
  const empty = width - filled;
  return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}] ${safePercent}%`;
}
