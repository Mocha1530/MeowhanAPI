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

  // Predefined rectangles
  private readonly defaultRects = {
    name: { left: 624, top: 169, right: 980, bottom: 205 },
    age: { left: 600, top: 284, right: 981, bottom: 245 },
    gender: { left: 648, top: 369, right: 979, bottom: 326 },
    status: { left: 633, top: 452, right: 980, bottom: 409 },
    icon: { left: 99, top: 136, right: 405, bottom: 439 },
  };

  private defaultTextStyle: Required<TextStyle> = {
    fontSize: 24,
    fontFamily: 'sans-serif',
    color: '#000000',
    fontWeight: 'bold',
  };

  /**
   * @param templatePath - Path to the template image (e.g., 'public/id-template.png')
   * @param customRects - Optional custom rectangles (if not provided, defaults are used)
   * @param textStyle - Optional default text style
   */
  constructor(
    templatePath: string,
    customRects?: Partial<typeof this.defaultRects>,
    textStyle?: Partial<TextStyle>
  ) {
    // Resolve relative paths against the project root so `public/...` works
    if (path.isAbsolute(templatePath)) {
      this.templatePath = templatePath;
    } else {
      // Try multiple resolution strategies for production environments
      const possiblePaths = [
        path.join(process.cwd(), templatePath), // Development
        path.join('/var/task', templatePath), // AWS Lambda
        path.join('/app', templatePath), // Vercel/Docker
      ];
      
      this.templatePath = possiblePaths[0]; // Default to process.cwd()
    }
    
    if (customRects) {
      // Merge custom rectangles with defaults
      this.defaultRects = { ...this.defaultRects, ...customRects };
    }
    if (textStyle) {
      this.defaultTextStyle = { ...this.defaultTextStyle, ...textStyle };
    }
  }

  /**
   * Loads the template image into memory. Called automatically by generate() if not already loaded.
   */
  private async loadTemplate(): Promise<void> {
    if (!this.templateBuffer) {
      // Try to find the template file in possible locations
      let templatePath = this.templatePath;
      
      // If the path doesn't exist, try alternative locations
      if (!fs.existsSync(templatePath)) {
        const alternatives = [
          path.join('/var/task', 'public/ID_TEMPLATE.jpg'),
          path.join('/app', 'public/ID_TEMPLATE.jpg'),
          path.join(process.cwd(), 'public/ID_TEMPLATE.jpg'),
        ];
        
        for (const alt of alternatives) {
          if (fs.existsSync(alt)) {
            templatePath = alt;
            break;
          }
        }
      }
      
      this.templateBuffer = await sharp(templatePath).toBuffer();
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
    const svg = `
      <svg width="${rect.width}" height="${rect.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @font-face {
              font-family: 'sans-serif';
              font-weight: normal;
            }
            @font-face {
              font-family: 'sans-serif';
              font-weight: bold;
            }
          </style>
        </defs>
        <text 
          x="${rect.width / 2}" 
          y="${rect.height * 0.65}" 
          font-family="sans-serif"
          font-size="${mergedStyle.fontSize}px"
          font-weight="${mergedStyle.fontWeight}"
          fill="${mergedStyle.color}"
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