"use server"
import probeImageSize from 'probe-image-size';

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

    const dimensions = await probeImageSize(buffer);

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
