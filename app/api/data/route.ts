import { type NextRequest, NextResponse } from "next/server";
import { getImageData } from "@/lib/image-utils";



export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    if (typeof url !== 'string') {
      return NextResponse.json(
      { error: "url must be a string" },
      { status: 400 }
      );
    }

    const data = await getImageData(url);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error getting image data:", error);
    return NextResponse.json(
      { error: "Failed to get image data",
      message: error.error },
      { status: 500 }
    );
  }
}
