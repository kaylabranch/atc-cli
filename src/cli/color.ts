import pc from 'picocolors';

const styles = {
  bold: pc.bold,
  red: pc.red,
  yellow: pc.yellow,
  green: pc.green,
  cyan: pc.cyan,
  blue: pc.blue,
  white: pc.white,
  dim: pc.dim,
};

export function supportsColor(): boolean {
  return pc.isColorSupported;
}

export function colorize(text: string, color: keyof typeof styles): string {
  return styles[color](text);
}

export function colorLabels() {
  return {
    danger: (text: string) => colorize(text, 'red'),
    warning: (text: string) => colorize(text, 'yellow'),
    success: (text: string) => colorize(text, 'green'),
    info: (text: string) => colorize(text, 'cyan'),
    accent: (text: string) => colorize(text, 'blue'),
    bold: (text: string) => colorize(text, 'bold'),
    muted: (text: string) => colorize(text, 'dim'),
  };
}

export function progressBar(percent: number, width = 20, filledChar = '#', emptyChar = '.') {
  const safePercent = Math.max(0, Math.min(100, percent));
  const roundedPercent = Math.round(safePercent);
  const filled = Math.round((roundedPercent / 100) * width);
  const empty = width - filled;
  return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}] ${roundedPercent}%`;
}
