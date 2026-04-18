/**
 * Minimal terminal spinner — no dependency on ora.
 * Writes to stderr (stdout reserved for output data).
 *
 * Usage:
 *   const s = startSpinner("Fetching incidents");
 *   try { ... } finally { s.stop(); }
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export interface Spinner {
  update(text: string): void;
  stop(finalText?: string): void;
}

/**
 * Start an animated spinner on stderr. Silently no-ops when stderr is not a TTY.
 */
export function startSpinner(text: string): Spinner {
  if (!process.stderr.isTTY) {
    // Log once and stop — no animation in non-TTY mode
    process.stderr.write(`${text}...\n`);
    return { update: () => {}, stop: () => {} };
  }

  let currentText = text;
  let frame = 0;
  const timer = setInterval(() => {
    const char = FRAMES[frame % FRAMES.length];
    frame++;
    process.stderr.write(`\r\x1b[K${char} ${currentText}`);
  }, INTERVAL_MS);

  // Hide cursor
  process.stderr.write("\x1b[?25l");

  return {
    update(newText: string) {
      currentText = newText;
    },
    stop(finalText?: string) {
      clearInterval(timer);
      process.stderr.write("\r\x1b[K");
      if (finalText) process.stderr.write(`${finalText}\n`);
      process.stderr.write("\x1b[?25h"); // restore cursor
    },
  };
}
