import { type NextRequest, NextResponse } from 'next/server';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { put, head } from '@vercel/blob';
import sharp from 'sharp';

export async function getCoverImage(imageUrl: string, username: string): Promise<string> {
  try { 
    const filename =  `MEOW_${username}_livecover.jpg`;
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    try {
      const isBlob = await head(filename, { token: process.env.MEOW_READ_WRITE_TOKEN });
      return isBlob.url;
    } catch (error) {
      console.log("Failed head:", error);
    }
       
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const background = await sharp(buffer)
      .resize(1920, 1080, { fit: 'cover' })
      .blur(20)
      .modulate({ brightness: 0.7 })
      .toBuffer();

    const foreground = await sharp(buffer)
      .resize(1920, 1080, { fit: 'inside' })
      .sharpen()
      .png()
      .toBuffer();

    const coverBuffer = await sharp(background)
      .composite([
        {
          input: foreground,
          gravity: 'center'
        }
      ])
      .jpeg()
      .toBuffer();

    const blob = await put(filename, coverBuffer, {
      access: 'public',
      token: process.env.MEOW_READ_WRITE_TOKEN,
      allowOverwrite: true,
    });
    
    return blob.url;
  } catch (error) {
    console.error("Error getting cover:", error);
    return imageUrl;
  }
}


export async function GET(request: NextRequest) {
  let tiktokConnection;
  
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    
    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username is required',
        },
        { status: 400 },
      );
    }

    tiktokConnection = new WebcastPushConnection(username, {
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 1000,
      sessionId: process.env.sessionId,
      ttTargetIdc: process.env.ttTargetIdc,
      clientParams: {},
      requestHeaders: {},
      websocketHeaders: {},
      requestOptions: {},
      websocketOptions: {},
    });

    const response = await tiktokConnection.connect()
    const coverImage = await getCoverImage(response.roomInfo.cover.url_list[0], username)
    
    return NextResponse.json(
      { 
        success: true,
        data: {
          ...response.roomInfo,
          cover_image: coverImage,
        }
      });
  } catch (error) {
    switch (error.message) {
      case 'LIVE has ended':
        return NextResponse.json(
          { 
            success: false,
            error: 'LIVE has ended'
          },
          { status: 400 }
        );
      case 'User is offline':
        return NextResponse.json(
          { 
            success: false,
            error: 'User is offline'
          },
          { status: 400 }
        );
      default:
        console.error("TikTokAPI error:", error)
        return NextResponse.json(
          { 
            success: false,
            error: 'Unknown error'
          },
          { status: 500 }
        );
    }
  } finally {
    if (tiktokConnection) {
      tiktokConnection.disconnect();
    }
  }
}
