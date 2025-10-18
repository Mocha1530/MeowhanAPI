import { type NextRequest, NextResponse } from 'next/server';
import { WebcastPushConnection } from 'tiktok-live-connector';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    
    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: "Username is required",
        },
        { status: 400 },
      )
    };

    const tiktokConnection = new WebcastPushConnection(username, {
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
    
    return NextResponse.json(
      { success: true, data: response.roomInfo }
    );
  } catch (error) {
    switch (error.message) {
      case 'LIVE has ended':
        return NextResponse.json(
          { 
            success: false,
            error: 'LIVE has ended'
          },
          { 
            status: 400,
            statusText: 'Offline Error'
          }
        );
      case 'User is offline':
        return NextResponse.json(
          { 
            success: false,
            error: 'User is offline'
          },
          { 
            status: 400,
            statusText: 'Offline Error'
          }
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
  }
}
