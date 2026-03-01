import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const path = (await params).path.join('/');
    const baseUrls = [
      `https://i.animepahe.si/snapshots/${path}`,
      `https://i.animepahe.si/uploads/snapshots/${path}`,
    ];
    
    let imageResponse: Response | null = null;
    let lastError: Error | null = null;

    for (const imageUrl of baseUrls) {
      try {
        imageResponse = await fetch(imageUrl, {
          headers: {
            'Referer': 'https://animepahe.si/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (imageResponse.ok) {
          break;
        }
      } catch (error) {
        lastError = error as Error;
        imageResponse = null;
      }
    }

    if (!imageResponse || !imageResponse.ok) {
      const errorMessage = 'Image not found';
      const statusCode = imageResponse?.status || 404;
      
      return new NextResponse(errorMessage, { 
        status: statusCode
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200
  });
}
