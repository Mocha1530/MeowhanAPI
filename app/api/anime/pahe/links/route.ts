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
      width: 1280, 
      height: 720,
      deviceScaleFactor: 1 
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0');

    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 10000 }
    );
    
    const kwikLinks = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[data-src]'));
      return buttons
        .filter(button => {
          const dataSrc = button.getAttribute('data-src');
          return dataSrc && dataSrc.includes('https://kwik.cx/');
        })
        .map(button => ({
          url: button.getAttribute('data-src'),
          text: button.textContent?.trim() || 'No label',
          type: 'kwik' as const
        }));
    });

    const paheLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .filter(anchor => {
          const href = anchor.getAttribute('href');
          return href && href.includes('https://pahe.win/');
        })
        .map(anchor => ({
          url: anchor.getAttribute('href'),
          text: anchor.textContent?.trim() || 'No label',
          type: 'pahe' as const
        }));
    });

    const pageContent = await page.evaluate(() => {
      // Get all buttons and their data-src attributes
      const allButtons = Array.from(document.querySelectorAll('button'));
      const buttonsWithData = allButtons.map(button => ({
        hasDataSrc: button.hasAttribute('data-src'),
        dataSrc: button.getAttribute('data-src'),
        text: button.textContent?.trim(),
        className: button.className
      }));

      // Get all links
      const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.getAttribute('href'),
        text: a.textContent?.trim(),
        className: a.className
      }));

      // Get page HTML structure for debugging
      const bodyHTML = document.body.innerHTML.substring(0, 2000); // First 2000 chars

      return {
        buttons: buttonsWithData.filter(b => b.hasDataSrc),
        links: allLinks.filter(l => l.href?.includes('pahe.win')),
        bodySample: bodyHTML,
        totalButtons: allButtons.length,
        totalLinks: allLinks.length
      };
    });

    console.log('Page:', pageContent);

    await browser.close();

    return NextResponse.json({
      success: true,
      kwik_links: kwikLinks || [],
      download_links: paheLinks || [],
      totalFound: kwikLinks.length + paheLinks.length
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    console.error('Scraping error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape links',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
