import { type NextRequest, NextResponse } from "next/server"
import { convertImageUrlToDataUri } from "@/lib/image-utils"

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the image URL
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 })
    }

    // Convert the image URL to a data URI
    const dataUri = await convertImageUrlToDataUri(url)

    // Return the data URI in the response
    return NextResponse.json({ dataUri })
  } catch (error) {
    console.error("Error converting image:", error)
    return NextResponse.json({ error: "Failed to convert image" }, { status: 500 })
  }
}
