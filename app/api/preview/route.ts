import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

  const executablePath = await chromium.executablePath();
  let browser = null;
  
  try {
    browser = await chromium.puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    await page.setViewport({ 
      width: 1280, 
      height: 720,
      deviceScaleFactor: 1 
    });

    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    //await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false,
    });

    await browser.close();

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
