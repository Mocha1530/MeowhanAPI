"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Copy, Check, ImageIcon, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Converter() {
  // Image to Data URI state
  const [imageUrl, setImageUrl] = useState("")
  const [dataUri, setDataUri] = useState("")
  const [isLoadingImage, setIsLoadingImage] = useState(false)
  const [imageError, setImageError] = useState("")
  const [imageCopied, setImageCopied] = useState(false)

  // URL Decode state
  const [encodedText, setEncodedText] = useState("")
  const [decodedText, setDecodedText] = useState("")
  const [isLoadingText, setIsLoadingText] = useState(false)
  const [textError, setTextError] = useState("")
  const [textCopied, setTextCopied] = useState(false)

  const handleConvertImage = async () => {
    if (!imageUrl) return

    setIsLoadingImage(true)
    setImageError("")
    setDataUri("")

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: imageUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to convert image")
      }

      setDataUri(data.dataUri.base64)
    } catch (err) {
      setImageError("Failed to convert image. Please check the URL and try again.")
      console.error(err)
    } finally {
      setIsLoadingImage(false)
    }
  }

  const handleDecodeText = async () => {
    if (!encodedText) return

    setIsLoadingText(true)
    setTextError("")
    setDecodedText("")

    try {
      const response = await fetch("/api/decode-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ encodedText }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to decode text")
      }

      setDecodedText(data.decodedText)
    } catch (err) {
      setTextError("Failed to decode text. Please check your input and try again.")
      console.error(err)
    } finally {
      setIsLoadingText(false)
    }
  }

  const handleCopyImage = () => {
    if (!dataUri) return
    navigator.clipboard.writeText(dataUri)
    setImageCopied(true)
    setTimeout(() => setImageCopied(false), 2000)
  }

  const handleCopyText = () => {
    if (!decodedText) return
    navigator.clipboard.writeText(decodedText)
    setTextCopied(true)
    setTimeout(() => setTextCopied(false), 2000)
  }

  return (
    <div className="container max-w-[800px] mx-auto py-10 px-5">
      <Tabs defaultValue="image" className="w-full">
        <TabsList className="grid overflow-x-auto w-full grid-cols-2">
          <TabsTrigger value="image" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Image to Data URI
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            URL Decode
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Test Tab
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image">
          <Card>
            <CardHeader>
              <CardTitle>Convert Image URL to Data URI</CardTitle>
              <CardDescription>
                Convert any image URL to a base64-encoded data URI that can be embedded directly in your code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="imageUrl" className="text-sm font-medium">
                  Image URL
                </label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <Button onClick={handleConvertImage} disabled={isLoadingImage || !imageUrl}>
                    {isLoadingImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Converting
                      </>
                    ) : (
                      "Convert"
                    )}
                  </Button>
                </div>
              </div>

              {imageError && <div className="text-red-500 text-sm">{imageError}</div>}

              {dataUri && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="dataUri" className="text-sm font-medium">
                      Data URI
                    </label>
                    <Button variant="ghost" size="sm" onClick={handleCopyImage} className="h-8 px-2">
                      {imageCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea id="dataUri" value={dataUri} readOnly className="font-mono text-xs h-32" />
                </div>
              )}

              {dataUri && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preview</label>
                  <div className="border rounded-md p-4 flex items-center justify-center">
                    <img
                      src={imageUrl || "/placeholder.svg"}
                      alt="Converted image preview"
                      className="max-h-64 max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start space-y-2 text-sm text-muted-foreground">
              <p>
                Note: Large images will result in very long data URIs. Consider image optimization before conversion.
              </p>
              <div className="w-full pt-2 border-t">
                <p className="font-medium text-foreground">API Usage:</p>
                <pre className="mt-2 p-2 bg-muted rounded-md overflow-x-auto text-xs">
                  {`POST /api/convert
Content-Type: application/json

{
  "url": "https://example.com/image.jpg"
}`}
                </pre>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>URL Decoder</CardTitle>
              <CardDescription>Decode URL-encoded text (percent-encoded) to human-readable format.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="encodedText" className="text-sm font-medium">
                  URL-Encoded Text
                </label>
                <div className="flex gap-2">
                  <Input
                    id="encodedText"
                    placeholder="Hello%20World%21"
                    value={encodedText}
                    onChange={(e) => setEncodedText(e.target.value)}
                  />
                  <Button onClick={handleDecodeText} disabled={isLoadingText || !encodedText}>
                    {isLoadingText ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Decoding
                      </>
                    ) : (
                      "Decode"
                    )}
                  </Button>
                </div>
              </div>

              {textError && <div className="text-red-500 text-sm">{textError}</div>}

              {decodedText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="decodedText" className="text-sm font-medium">
                      Decoded Text
                    </label>
                    <Button variant="ghost" size="sm" onClick={handleCopyText} className="h-8 px-2">
                      {textCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea id="decodedText" value={decodedText} readOnly className="font-mono text-sm h-32" />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start space-y-2 text-sm text-muted-foreground">
              <p>
                Note: This tool decodes URL-encoded strings where spaces appear as %20, special characters as %XX, etc.
              </p>
              <div className="w-full pt-2 border-t">
                <p className="font-medium text-foreground">API Usage:</p>
                <pre className="mt-2 p-2 bg-muted rounded-md overflow-x-auto text-xs">
                  {`POST /api/decode-url
Content-Type: application/json

{
  "encodedText": "Hello%20World%21"
}`}
                </pre>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Test Tab</CardTitle>
              <CardDescription>
                This is only a test.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="imageUrl" className="text-sm font-medium">
                  Image URL
                </label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <Button onClick={handleConvertImage} disabled={isLoadingImage || !imageUrl}>
                    {isLoadingImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Converting
                      </>
                    ) : (
                      "Convert"
                    )}
                  </Button>
                </div>
              </div>

              {imageError && <div className="text-red-500 text-sm">{imageError}</div>}

              {dataUri && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="dataUri" className="text-sm font-medium">
                      Data URI
                    </label>
                    <Button variant="ghost" size="sm" onClick={handleCopyImage} className="h-8 px-2">
                      {imageCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea id="dataUri" value={dataUri} readOnly className="font-mono text-xs h-32" />
                </div>
              )}

              {dataUri && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preview</label>
                  <div className="border rounded-md p-4 flex items-center justify-center">
                    <img
                      src={imageUrl || "/placeholder.svg"}
                      alt="Converted image preview"
                      className="max-h-64 max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start space-y-2 text-sm text-muted-foreground">
              <p>
                Note: Large images will result in very long data URIs. Consider image optimization before conversion.
              </p>
              <div className="w-full pt-2 border-t">
                <p className="font-medium text-foreground">API Usage:</p>
                <pre className="mt-2 p-2 bg-muted rounded-md overflow-x-auto text-xs">
                  {`POST /api/convert
Content-Type: application/json

{
  "url": "https://example.com/image.jpg"
}`}
                </pre>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
