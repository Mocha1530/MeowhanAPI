import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the encoded text
    const body = await request.json()
    const { encodedText } = body

    if (!encodedText) {
      return NextResponse.json({ error: "Encoded text is required" }, { status: 400 })
    }

    // Decode the URL-encoded text
    const decodedText = decodeURIComponent(encodedText)

    // Return the decoded text in the response
    return NextResponse.json({ decodedText })
  } catch (error) {
    console.error("Error decoding text:", error)
    return NextResponse.json({ error: "Failed to decode text" }, { status: 500 })
  }
}
