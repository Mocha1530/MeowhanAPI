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
    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    await page.setViewport({ 
      width: 1920, 
      height: 1080,
      deviceScaleFactor: 1 
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0');

    let pendingRequests = 0;
    let lastActivity = Date.now();

    await page.setRequestInterception(true);

    page.on('request', (request) => {
      pendingRequests++;
      lastActivity = Date.now();
      request.continue();
    });

    page.on('requestfinished', (request) => {
      pendingRequests--;
      lastActivity = Date.now();
    });

    page.on('requestfailed', (request) => {
      pendingRequests--;
      lastActivity = Date.now();
    });

    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    const maxWaitTime = 15000;
    const networkIdleTime = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      if (Date.now() - lastActivity > networkIdleTime && pendingRequests === 0) {
        break;
      }
      
      await page.waitForTimeout(500);
    }

    try {
      await page.waitForFunction(
        () => {
          if (window._fetchRequests && window._fetchRequests > 0) return false;
          
          const loaders = document.querySelectorAll('[data-loading], .loading, .spinner, .loader, [aria-busy="true"]');
          if (loaders.length > 0) return false;
          
          const images = Array.from(document.images);
          if (images.some(img => !img.complete)) return false;
          
          return document.readyState === 'complete';
        },
        { timeout: 5000, polling: 500 }
      );
    } catch (error) {
    }

    await page.waitForTimeout(1000);

    // await page.waitForFunction(
    //   () => {
    //     return document.readyState === 'complete' && 
    //            document.body != null && 
    //            document.querySelector('img[loading="lazy"]') === null;
    //   },
    //   { timeout: 10000 }
    // );

    //await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false,
    });

    // const html = await page.content();
    // console.log(html);

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
