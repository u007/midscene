// This test assumes a Playwright-like test environment.
// Adjustments might be needed based on the actual test runner for this package.

import { Page } from '../src/puppeteer/base-page'; // Adjust path as needed
import { chromium } from 'playwright'; // Or import puppeteer
import type { Browser, Page as PlaywrightPageInstance } from 'playwright'; // Or puppeteer types

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const HTML_FILE_PATH = path.join(__dirname, 'fixtures', 'interaction-test-page.html');
let server: http.Server;
let serverUrl: string;

beforeAll(async () => {
  return new Promise<void>(resolve => {
    server = http.createServer((req, res) => {
      fs.readFile(HTML_FILE_PATH, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end(err.message);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    });
    server.listen(() => {
      const address = server.address();
      if (typeof address === 'string' || address === null) {
        serverUrl = 'http://localhost:3000'; 
        console.error("Server address is not an object, falling back.");
      } else {
        serverUrl = `http://localhost:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>(resolve => {
    server.close(() => resolve());
  });
});

describe('Page Class - ID-based Interactions', () => {
  let browser: Browser;
  let underlyingPlaywrightPage: PlaywrightPageInstance;
  let midscenePage: Page<'playwright', PlaywrightPageInstance>;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    underlyingPlaywrightPage = await browser.newPage();
    await underlyingPlaywrightPage.goto(serverUrl);
    midscenePage = new Page(underlyingPlaywrightPage, 'playwright'); 
  });

  afterEach(async () => {
    await browser.close();
  });

  it('should correctly perform clickById and trigger a single click event', async () => {
    await midscenePage.clickById('singleClickTarget');
    
    const buttonText = await underlyingPlaywrightPage.$eval('#singleClickTarget', el => el.textContent);
    expect(buttonText).toBe('Single Clicked!');

    const statusText = await underlyingPlaywrightPage.$eval('#statusArea', el => el.textContent);
    expect(statusText).toBe('Status: Single click on "singleClickTarget"');
  });

  it('should correctly perform doubleClickById and trigger a double click event', async () => {
    await midscenePage.doubleClickById('doubleClickTarget');
    
    const buttonText = await underlyingPlaywrightPage.$eval('#doubleClickTarget', el => el.textContent);
    expect(buttonText).toBe('Double Clicked!');

    const statusText = await underlyingPlaywrightPage.$eval('#statusArea', el => el.textContent);
    expect(statusText).toBe('Status: Double click on "doubleClickTarget"');
  });

  it('clickById should throw if element does not exist', async () => {
    await expect(midscenePage.clickById('nonExistentElement'))
      .rejects
      .toThrow(/selector.*nonExistentElement/i);
  });

  it('doubleClickById should throw if element does not exist', async () => {
    await expect(midscenePage.doubleClickById('nonExistentElementWithDbl'))
      .rejects
      .toThrow(/selector.*nonExistentElementWithDbl/i);
  });
});
