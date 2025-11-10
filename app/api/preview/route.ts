import { NextRequest, NextResponse } from 'next/server';
import chromium from 'chrome-aws-lambda';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  let browser = null;
  
  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    await page.setViewport({ 
      width: 1200, 
      height: 630,
      deviceScaleFactor: 1 
    });

    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 10000 
    });

    await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false,
    });

    // Close browser
    await browser.close();

    // Return the image
    return new NextResponse(screenshot, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Content-Disposition': `inline; filename="screenshot-${Date.now()}.jpg"`,
      },
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    console.error('Screenshot error:', error);
    return NextResponse.json(
      { error: 'Failed to capture screenshot' }, 
      { status: 500 }
    );
  }
}
