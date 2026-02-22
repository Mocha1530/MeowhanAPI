import { type NextRequest, NextResponse } from "next/server";
import EmojiDetector from "@/lib/EmojiDetector";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;
    const emoji = EmojiDetector.getEmoji(input);

    if (emoji) {
      return NextResponse.json(
        {
          valid: true,
          emoji
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          valid: false,
          emoji: null
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unknown error occurred"
      },
      { status:500 }
    );
  }
}