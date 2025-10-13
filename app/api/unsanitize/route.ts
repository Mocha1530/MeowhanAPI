import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the sanitized text
    const body = await request.json()
    const { sanitizedText } = body

    if (!sanitizedText) {
      return NextResponse.json({ error: "Sanitized text is required" }, { status: 400 })
    }

    // Create a comprehensive unsanitization function
    function unsanitizeText(text: string): string {
      // First, handle common named HTML entities
      const namedEntities: Record<string, string> = {
        "&lt;": "<",
        "&gt;": ">",
        "&amp;": "&",
        "&quot;": '"',
        "&#39;": "'",
        "&#x27;": "'",
        "&#x2F;": "/",
        "&nbsp;": " ",
        "&copy;": "©",
        "&reg;": "®",
        "&trade;": "™",
        "&hellip;": "…",
        "&mdash;": "—",
        "&ndash;": "–",
        "&lsquo;": "‘",
        "&rsquo;": "’",
        "&ldquo;": '"',
        "&rdquo;": '"',
      }

      // Replace named entities
      let result = text
      for (const [entity, char] of Object.entries(namedEntities)) {
        result = result.replace(new RegExp(entity, "g"), char)
      }

      // Handle numeric HTML entities (decimal)
      result = result.replace(/&#(\d+);/g, (match, dec) => {
        return String.fromCharCode(Number.parseInt(dec, 10))
      })

      // Handle hexadecimal HTML entities
      result = result.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
        return String.fromCharCode(Number.parseInt(hex, 16))
      })

      // Explicitly handle curly braces and other commonly encoded characters
      const specificEntities: Record<string, string> = {
        "&#123;": "{",
        "&#x7B;": "{",
        "&#125;": "}",
        "&#x7D;": "}",
        "&#91;": "[",
        "&#x5B;": "[",
        "&#93;": "]",
        "&#x5D;": "]",
        "&#40;": "(",
        "&#x28;": "(",
        "&#41;": ")",
        "&#x29;": ")",
        "&#64;": "@",
        "&#x40;": "@",
        "&#35;": "#",
        "&#x23;": "#",
        "&#37;": "%",
        "&#x25;": "%",
        "&#43;": "+",
        "&#x2B;": "+",
        "&#61;": "=",
        "&#x3D;": "=",
        "&#63;": "?",
        "&#x3F;": "?",
        "&#33;": "!",
        "&#x21;": "!",
        "&#58;": ":",
        "&#x3A;": ":",
        "&#59;": ";",
        "&#x3B;": ";",
        "&#44;": ",",
        "&#x2C;": ",",
        "&#46;": ".",
        "&#x2E;": ".",
        "&#124;": "|",
        "&#x7C;": "|",
        "&#92;": "\\",
        "&#x5C;": "\\",
        "&#96;": "`",
        "&#x60;": "`",
        "&#126;": "~",
        "&#x7E;": "~",
        "&#94;": "^",
        "&#x5E;": "^",
        "&#42;": "*",
        "&#x2A;": "*",
        "&#36;": "$",
        "&#x24;": "$",
      }

      // Replace specific entities
      for (const [entity, char] of Object.entries(specificEntities)) {
        result = result.replace(new RegExp(entity, "g"), char)
      }

      return result
    }

    // Unsanitize the text
    const unsanitizedText = unsanitizeText(sanitizedText)

    // Return the unsanitized text in the response
    return NextResponse.json({ unsanitizedText })
  } catch (error) {
    console.error("Error unsanitizing text:", error)
    return NextResponse.json({ error: "Failed to unsanitize text" }, { status: 500 })
  }
}
