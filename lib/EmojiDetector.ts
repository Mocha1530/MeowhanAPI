import emojiRegex from 'emoji-regex';
import * as emoji from 'node-emoji';

class EmojiDetector {
  private static instance: EmojiDetector;
  private regex: RegExp;

  private constructor() {
    // Create the regex once and reuse it
    this.regex = emojiRegex();
  }

  public static getInstance(): EmojiDetector {
    if (!EmojiDetector.instance) {
      EmojiDetector.instance = new EmojiDetector();
    }
    return EmojiDetector.instance;
  }

  /**
   * Checks if the input is a single Unicode emoji (Twemoji‑supported).
   * Emoji may consist of multiple code points (e.g. 👨‍👩‍👧‍👦 family).
   */
  public isUnicodeEmoji(input: string): boolean {
    const trimmed = input.trim();
    const match = trimmed.match(this.regex);
    // The regex matches the first emoji in the string. We ensure that:
    // - There is exactly one match
    // - That match covers the entire trimmed string
    return match !== null && match[0] === trimmed;
  }

  /**
   * Converts a shortcode like ":smile:" to its Unicode emoji.
   * Returns null if the shortcode is unknown.
   */
  public shortcodeToUnicode(shortcode: string): string | null {
    // Remove surrounding colons if present
    const name = shortcode.replace(/^:|:$/g, '');
    const emojiChar = emoji.get(name);
    // node-emoji returns the emoji string or undefined if not found
    return emojiChar || null;
  }

  /**
   * Main entry point.
   * - If the input is a valid Unicode emoji, returns it.
   * - If the input matches :name: and the name exists, returns the Unicode emoji.
   * - Otherwise returns null.
   */
  public getEmoji(input: string): string | null {
    if (this.isUnicodeEmoji(input)) {
      return input.trim();
    }

    const shortcodeMatch = input.match(/^:([a-zA-Z0-9_+-]+):$/);
    if (shortcodeMatch) {
      const unicode = this.shortcodeToUnicode(input);
      if (unicode) {
        return unicode;
      }
    }

    return null;
  }
}

// Export a singleton instance
export default EmojiDetector.getInstance();