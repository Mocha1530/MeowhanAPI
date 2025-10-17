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
    
    const response = await tiktokConnection.getRoomInfo();
    return NextResponse.json(
      { success: true, data: response }
    );
  } catch (error) {
    console.error("TikTokAPI error:", error)
    return NextResponse.json(
      { success: false },
      { status: 500 },
    )
  };
};
