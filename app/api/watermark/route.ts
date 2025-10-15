import { type NextRequest, NextResponse } from "next/server";
import { addWatermark } from "@/lib/image-utils";

/**
 * Upload image to external hosting service
 */
async function uploadToImageHosting(imageBuffer: Buffer, filename: string = 'watermarked-image.png'): Promise<string> {
  try {
	const auth = process.env.imgChest;
    
    if (!auth) {
      throw new Error('ImgChest Auth Token is not configured');
    }
	  
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('images[]', blob, filename);

    const response = await fetch('https://api.imgchest.com/v1/post', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${auth}`
      }
    });

    if (!response.ok) {
      throw new Error(`Image hosting failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
	console.log('ImgChest API response:', JSON.stringify(result, null, 2));
    
    return result.images[0].link || result.link;
  } catch (error) {
    console.error('Image hosting failed:', error);
    throw new Error('Failed to upload image to hosting service');
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const image = searchParams.get('image');
    const watermark = searchParams.get('watermark');
    const position = searchParams.get('position') as WatermarkPosition || 'center-center';
    const size = parseInt(searchParams.get('size') || '20');

    if (!image || !watermark) {
      return new Response('Missing required parameters: image and watermark', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const result = await addWatermark(image, watermark, position, size);

    if (!result.success || !result.imageBuffer) {
      return new Response(result.error || 'Failed to create watermarked image', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response(result.imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': result.imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('GET endpoint error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { image, watermark, position = 'center-center', size = 20 } = body;

    if (!image || !watermark) {
      return Response.json(
        { error: 'Missing required parameters: image and watermark' },
        { status: 400 }
      );
    }

    const result = await addWatermark(image, watermark, position as WatermarkPosition, size);

    if (!result.success || !result.imageBuffer) {
      return Response.json(
        { error: result.error || 'Failed to create watermarked image' },
        { status: 400 }
      );
    }
		
    const imageUrl = await uploadToImageHosting(result.imageBuffer);

    return Response.json({
      dimensions: result.dimensions,
      size: result.size,
      url: imageUrl,
      success: true
    });

  } catch (error) {
    console.error('POST endpoint error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
