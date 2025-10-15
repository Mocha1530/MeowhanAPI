"use server"
import probeImageSize from 'probe-image-size';
import sharp from 'sharp';

/**
 * Converts an image URL to a base64-encoded data URI
 * @param imageUrl The URL of the image to convert
 * @returns A Promise that resolves to the data URI string
 */
export async function convertImageUrlToDataUri(imageUrl: string): Promise<string> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    // Get the content type
    const contentType = response.headers.get("content-type") || "image/jpeg"

    // Convert the image to a buffer
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Convert the buffer to a base64 string
    const base64String = buffer.toString("base64")

    // Create the data URI
    return { base64: base64String,
    type: contentType,
    format: `data:${contentType};base64,${base64String}`
    }
  } catch (error) {
    console.error("Error converting image to data URI:", error)
    throw error
  }
}

export async function getImageData(imageUrl: string): Promise<{
  width: number;
  height: number;
  type?: string;
  size?: number;
  success: boolean;
  error?: string;
}> {
  try {
    //fetch image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Image-Metadata-Api/1.0)',
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    } 

    const contentType = response.headers.get("content-type") || "image/jpeg";

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const dimensions = await probeImageSize.sync(buffer);

    return {
      width: dimensions.width,
      height: dimensions.height,
      type: contentType,
      size: buffer.length,
      success: true
    };
  } catch (error) {
    console.error("Error extracting image data:", error);
    throw {
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

// Types for position options
type HorizontalPosition = 'left' | 'center' | 'right';
type VerticalPosition = 'top' | 'center' | 'bottom';
type WatermarkPosition = `${VerticalPosition}-${HorizontalPosition}`;

/**
 * Watermark an image with another image
 */
export async function addWatermark(
  imageUrl: string,
  watermarkUrl: string,
  position: WatermarkPosition = 'center-center',
  size: number = 20
): Promise<{
  success: boolean;
  imageBuffer?: Buffer;
  dimensions?: string;
  size?: number;
  error?: string;
}> {
  try {
    if (size <= 0 || size > 100) {
      throw new Error('Size must be between 1 and 100 percent');
    }
    
    const [imageResponse, watermarkResponse] = await Promise.all([
      fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Image-Watermark-API/1.0)',
          'Accept': 'image/*',
        },
        signal: AbortSignal.timeout(30000),
      }),
      fetch(watermarkUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Image-Watermark-API/1.0)',
          'Accept': 'image/*',
        },
        signal: AbortSignal.timeout(30000),
      }),
    ]);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch main image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    if (!watermarkResponse.ok) {
      throw new Error(`Failed to fetch watermark image: ${watermarkResponse.status} ${watermarkResponse.statusText}`);
    }

    const [imageBuffer, watermarkBuffer] = await Promise.all([
      imageResponse.arrayBuffer().then(ab => Buffer.from(ab)),
      watermarkResponse.arrayBuffer().then(ab => Buffer.from(ab)),
    ]);

    const imageDimensions = await probeImageSize.sync(imageBuffer);
    const watermarkDimensions = await probeImageSize.sync(watermarkBuffer);

    if (!imageDimensions || !watermarkDimensions) {
      throw new Error('Could not determine image dimensions');
    }

    const watermarkWidth = Math.round(imageDimensions.width * (size / 100));
    const watermarkHeight = Math.round(
      (watermarkDimensions.height / watermarkDimensions.width) * watermarkWidth
    );

    const [vertical, horizontal] = position.split('-') as [VerticalPosition, HorizontalPosition];
    
    let left: number;
    let top: number;

    switch (horizontal) {
      case 'left':
        left = 10;
        break;
      case 'right':
        left = imageDimensions.width - watermarkWidth - 10;
        break;
      case 'center':
      default:
        left = Math.round((imageDimensions.width - watermarkWidth) / 2);
        break;
    }
    
    switch (vertical) {
      case 'top':
        top = 10;
        break;
      case 'bottom':
        top = imageDimensions.height - watermarkHeight - 10;
        break;
      case 'center':
      default:
        top = Math.round((imageDimensions.height - watermarkHeight) / 2);
        break;
    }

    const watermarkedImage = await sharp(imageBuffer)
      .composite([
        {
          input: await sharp(watermarkBuffer)
            .resize(watermarkWidth, watermarkHeight, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer(),
          left: Math.max(0, left),
          top: Math.max(0, top),
        }
      ])
      .png()
      .toBuffer();

    return {
      success: true,
      imageBuffer: watermarkedImage,
      dimensions: `${imageDimensions.width}x${imageDimensions.height}`,
      size: watermarkedImage.length
    };
  } catch (error) {
    console.error('Error adding watermark:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
