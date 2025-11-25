// File: /Route/test.js
// Playwright Self-Healing Scraper for Internship Jobs

import express from "express";
import fs from "fs";
import { chromium } from "playwright";
import cron from "node-cron";
import { saveJob, checkDuplicate } from "../Server/dbConnection/saveScrapedData.js";

const router = express.Router();

const SELECTORS_FILE = "./selectors.json";
const MAX_RETRIES = 5;

// Default selectors
const defaultSelectors = {
  indeed: { jobCard: "td.resultContent", title: "h2.jobTitle span", company: "span[data-testid='company-name']", link: "h2.jobTitle a", skills: "li[data-testid='attribute_snippet_testid']" },
  glassdoor: { jobCard: ".JobCard_jobCardLeftContent__cHcGe", title: ".JobCard_jobTitle__GLyJ1", company: ".EmployerProfile_compactEmployerName__9MGcV", link: "a.JobCard_jobTitle__GLyJ1", skills: ".JobCard_jobDescriptionSnippet__l1tnl" },
  linkedin: { jobCard: ".base-card", title: ".base-search-card__title", company: ".base-search-card__subtitle", link: "a.base-card__full-link", skills: ".job-card-container__description" }
};

// Load or initialize selectors
let selectors = {};
try {
  selectors = JSON.parse(fs.readFileSync(SELECTORS_FILE, "utf-8"));
} catch {
  selectors = defaultSelectors;
}

// Keywords to filter internships
const internshipKeywords = ["internship", "ojt", "on-the-job", "training", "practicum", "intern"];
function isInternship(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  return internshipKeywords.some(kw => text.includes(kw));
}

let browser;

// Get reusable browser
async function getBrowser() {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

// Auto-scroll for dynamic content
async function autoScroll(page, duration = 20000) {
  await page.evaluate(async (duration) => {
    const distance = 300;
    const delay = 300;
    const start = Date.now();
    while (Date.now() - start < duration) {
      window.scrollBy(0, distance);
      await new Promise(r => setTimeout(r, delay));
    }
  }, duration);
}

// Self-healing scrape for a single site
async function scrapeSite(page, site) {
  console.log(`[SCRAPER] Scraping ${site}...`);
  const siteSelectors = selectors[site];
  const urlMap = {
    indeed: "https://ph.indeed.com/jobs?q=internship&l=Philippines",
    glassdoor: "https://www.glassdoor.com/Job/philippines-internship-jobs-SRCH_IL.0,11_IN204_KO12,22.htm",
    linkedin: "https://www.linkedin.com/jobs/search?keywords=internship&location=Philippines"
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(urlMap[site], { waitUntil: "networkidle", timeout: 60000 });
      await autoScroll(page);

      await page.waitForSelector(siteSelectors.jobCard, { timeout: 10000 }).catch(() => {});

      let jobs = await page.evaluate((s) => {
        const jobEls = Array.from(document.querySelectorAll(s.jobCard));
        return jobEls.map(el => {
          const titleEl = el.querySelector(s.title);
          const companyEl = el.querySelector(s.company);
          const linkEl = el.querySelector(s.link);
          const skillsEls = Array.from(el.querySelectorAll(s.skills || "li")).map(li => li.innerText).join(", ");

          return {
            site: s.siteName,
            title: titleEl?.innerText || "",
            position: titleEl?.innerText || "",
            company: companyEl?.innerText || "",
            link: linkEl?.href || linkEl?.getAttribute("href") || "",
            skills: skillsEls || ""
          };
        });
      }, { ...siteSelectors, siteName: site });

      jobs = jobs.filter(job => isInternship(job.title, job.company));

      if (jobs.length === 0) {
        console.warn(`[WARN] No jobs found for ${site}, attempt ${attempt}. Trying to self-heal selectors...`);

        // Attempt dynamic selector healing
        const allEls = await page.$$("*");
        for (const el of allEls) {
          const text = await el.innerText().catch(() => "");
          if (text && internshipKeywords.some(kw => text.toLowerCase().includes(kw))) {
            selectors[site].jobCard = await el.evaluate(e => e.tagName.toLowerCase());
            console.log(`[UPDATE] ${site} jobCard selector updated to: ${selectors[site].jobCard}`);
            fs.writeFileSync(SELECTORS_FILE, JSON.stringify(selectors, null, 2));
            break;
          }
        }

        continue; // Retry with updated selector
      }

      console.log(`[TRACK] ${site}: ${jobs.length} jobs scraped.`);
      return jobs;

    } catch (err) {
      console.error(`[ERROR] ${site} scraping failed on attempt ${attempt}: ${err.message}`);
    }
  }

  console.warn(`[WARN] ${site} scraping failed after ${MAX_RETRIES} attempts.`);
  return [];
}

// Run full scraper
async function runScraper() {
  console.log("[SCRAPER] Playwright self-healing scraper started...");
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  const sites = ["indeed", "glassdoor", "linkedin"];
  let allJobs = [];

  for (const site of sites) {
    const siteJobs = await scrapeSite(page, site);
    allJobs.push(...siteJobs);
  }

  // Deduplicate
  const seen = new Set();
  allJobs = allJobs.filter(job => {
    const key = `${job.company}-${job.position}-${job.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Save new jobs
  let saved = 0;
  for (const job of allJobs) {
    const exists = await checkDuplicate(job.link);
    if (!exists) {
      await saveJob(job);
      saved++;
    }
  }

  console.log(`[SCRAPER] Total jobs scraped: ${allJobs.length} | New jobs saved: ${saved}`);
  await page.close();
}

// Run on startup
setTimeout(() => {
  console.log('[CRON] Initial run on startup...');
  runScraper();
}, 3000);

// Test route
router.get("/test-playwright-jobs", async (req, res) => {
  await runScraper();
  res.json({ status: "Self-healing scraper executed" });
});

// Automation every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  console.log("[CRON] Running self-healing scraper...");
  await runScraper();
});

export default router;
