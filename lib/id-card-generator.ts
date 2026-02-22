import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TextField {
  text: string;
  rect: Rect;
  style?: TextStyle;
}

export interface TextStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fontWeight?: string;
}

export interface IconField {
  url: string;
  rect: Rect;
}

export interface GenerateOptions {
  name?: string;
  age?: string;
  gender?: string;
  status?: string;
  iconUrl?: string;
}

export class IDCardGenerator {
  private templateBuffer: Buffer | null = null;
  private templatePath: string;
  private fontBase64: string | null = null;
  private fontPath: string;
  private fontFamily: string;

  // Predefined rectangles
  private readonly defaultRects = {
    name: { left: 648, top: 169, right: 980, bottom: 205 },
    age: { left: 648, top: 284, right: 980, bottom: 245 },
    gender: { left: 648, top: 369, right: 980, bottom: 326 },
    status: { left: 648, top: 452, right: 980, bottom: 409 },
    icon: { left: 99, top: 136, right: 405, bottom: 439 },
  };

  private defaultTextStyle: Required<TextStyle> = {
    fontSize: 24,
    fontFamily: 'EmbeddedFont',
    color: '#000000',
    fontWeight: 'bold',
  };

  /**
   * @param templatePath - Path to the template image (e.g., 'public/id-template.png')
   * @param fontPath - Path to an .otf font file
   * @param customRects - Optional custom rectangles (if not provided, defaults are used)
   * @param textStyle - Optional default text style
   */
  constructor(
    templatePath: string,
    fontPath: string,
    customRects?: Partial<typeof this.defaultRects>,
    textStyle?: Partial<TextStyle>
  ) {
    // Resolve relative paths against the project root so `public/...` works
    this.templatePath = this.resolvePath(templatePath);
    this.fontPath = this.resolvePath(fontPath);
    this.fontFamily = 'EmbeddedFont';
    
    if (customRects) {
      // Merge custom rectangles with defaults
      this.defaultRects = { ...this.defaultRects, ...customRects };
    }
    if (textStyle) {
      this.defaultTextStyle = { ...this.defaultTextStyle, ...textStyle };
    }
    this.defaultTextStyle.fontFamily = this.fontFamily;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;

    const possiblePaths = [
      path.join('/var/task', filePath),
      path.join('/app', filePath),
      path.join(process.cwd(), filePath)
    ];
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) return possiblePath;
    }
    return possiblePaths[0];
  }

  /**
   * Loads the template image into memory. Called automatically by generate() if not already loaded.
   */
  private async loadTemplate(): Promise<void> {
    if (!this.templateBuffer) {
      let templatePath = this.templatePath;
      
      if (!fs.existsSync(templatePath)) {
        const alternatives = [
          path.join('/var/task', 'public/ID_TEMPLATE.jpg'),
          path.join('/app', 'public/ID_TEMPLATE.jpg'),
          path.join(process.cwd(), 'public/ID_TEMPLATE.jpg'),
        ];
        for (const altPath of alternatives) {
          if (fs.existsSync(altPath)) {
            templatePath = altPath;
            break;
          }
        }
      }

      this.templateBuffer = await sharp(templatePath).toBuffer();
    }
  }

  /**
   * Loads the font file and converts it to base64. Called automatically when needed.
   */
  private async loadFont(): Promise<void> {
    if (!this.fontBase64) {
      let fontPath = this.fontPath;

      // If the path doesn't exist, try alternative locations
      if (!fs.existsSync(fontPath)) {
        const alternatives = [
          path.join('/var/task', 'public/font/BauerBodoniRegular.otf'),
          path.join('/app', 'public/font/BauerBodoniRegular.otf'),
          path.join(process.cwd(), 'public/font/BauerBodoniRegular.otf'),
        ];
        
        for (const alt of alternatives) {
          if (fs.existsSync(alt)) {
            fontPath = alt;
            break;
          }
        }
      }

      try {
        const fontBuffer = fs.readFileSync(fontPath);
        this.fontBase64 = fontBuffer.toString('base64');
      } catch (error) {
        console.warn(`Failed to load font from ${fontPath}:`, error);
        this.fontBase64 = '';
      }
    }
  }

  /**
   * Converts a raw rectangle to normalized {x, y, width, height}
   */
  private normalizeRect(rect: Rect): { x: number; y: number; width: number; height: number } {
    const left = Math.min(rect.left, rect.right);
    const top = Math.min(rect.top, rect.bottom);
    const right = Math.max(rect.left, rect.right);
    const bottom = Math.max(rect.top, rect.bottom);
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }

  /**
   * Generates an SVG image for a text string, sized to fit the rectangle.
   */
  private createTextSvg(text: string, rect: { width: number; height: number }, style?: TextStyle): Buffer {
    const mergedStyle = { ...this.defaultTextStyle, ...style };

    // Build font-face only if font was loaded
    const fontFace = this.fontBase64 
      ? `
        @font-face {
          font-family: ${this.fontFamily};
          src: url(data:font/opentype;charset=utf-8;base64,${this.fontBase64}) format('opentype');
          font-weight: ${mergedStyle.fontWeight};
          font-style: normal;
        }
      `
      : '';

    const svg = `
      <svg width="${rect.width}" height="${rect.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            ${fontFace}
            .text {
              font-family: ${this.fontBase64 ? `'${this.fontFamily}', ` : ''}sans-serif;
              font-size: ${mergedStyle.fontSize}px;
              font-weight: ${mergedStyle.fontWeight};
              fill: ${mergedStyle.color};
            }
          </style>
        </defs>
        <text 
          x="${rect.width / 2}" 
          y="${rect.height * 0.65}" 
          class="text"
          text-anchor="middle"
          dominant-baseline="middle"
        >${this.escapeXml(text)}</text>
      </svg>
    `;
    return Buffer.from(svg);
  }

  /**
   * Simple XML escaping for text safety.
   */
  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'\\"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
        default:
          return c;
      }
    });
  }

  /**
   * Fetches an image from a URL and returns a Sharp‑compatible buffer.
   */
  private async fetchImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generates the ID card image.
   * @param options - Contains name, age, gender, status, and optional iconUrl.
   * @returns Promise<Buffer> - The final PNG image buffer.
   */
  public async generate(options: GenerateOptions): Promise<Buffer> {
    await this.loadTemplate();
    await this.loadFont();
    const compositeOps: sharp.OverlayOptions[] = [];

    // Helper to add a text field
    const addTextField = (text: string | undefined, rectKey: keyof typeof this.defaultRects, style?: TextStyle) => {
      if (!text) return;
      const rect = this.normalizeRect(this.defaultRects[rectKey]);
      const svgBuffer = this.createTextSvg(text, rect, style);
      compositeOps.push({ input: svgBuffer, top: rect.y, left: rect.x });
    };

    // Add text fields
    addTextField(options.name, 'name');
    addTextField(options.age, 'age');
    addTextField(options.gender, 'gender');
    addTextField(options.status, 'status');

    // Add icon if URL provided
    if (options.iconUrl) {
      try {
        const iconBuffer = await this.fetchImage(options.iconUrl);
        const iconRect = this.normalizeRect(this.defaultRects.icon);
        // Resize to fill rectangle (stretch). To preserve aspect ratio, change `fit` to 'cover' or 'contain'
        const resizedIcon = await sharp(iconBuffer)
          .resize(iconRect.width, iconRect.height, { fit: 'fill' })
          .toBuffer();
        compositeOps.push({ input: resizedIcon, top: iconRect.y, left: iconRect.x });
      } catch (err) {
        console.warn('Icon could not be added:', err);
        // Continue without icon
      }
    }

    // Apply all composites to the template
    const output = await sharp(this.templateBuffer!)
      .composite(compositeOps)
      .png()
      .toBuffer();

    return output;
  }
}