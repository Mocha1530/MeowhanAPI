import { type NextRequest, NextResponse } from "next/server"
import { WebcastPushConnection } from "tiktok-live-connector"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    let tiktokConnection
    
    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: "Username is required",
        },
        { status: 400 },
      )
    }

    tiktokConnection = new WebcastPushConnection(username, {
      sessionId: process.env.sessionId,
      ttTargetIdc: process.env.ttTargetIdc,
    })
    console.log({session: process.env.sessionId, ttTargetIdc: process.env.ttTargetIdc})
    
    tiktokConnection.getRoomInfo().then(roomInfo => {
      return NextResponse.json(
        { success: true },
        roomInfo,
      )
    })
  } catch (error) {
    console.error("TikTokAPI error:", error)
    return NextResponse.json(
      { success: false },
      { status: 500 },
    )
  }
}
