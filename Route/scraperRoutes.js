// Route/scraper.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { saveJob } from "../Server/dbConnection/saveScrapedData.js";
import { checkDuplicate } from "../Server/dbConnection/saveScrapedData.js";

const router = express.Router();

// Keywords for internship/OJT listings
const internshipKeywords = [
  "internship",
  "ojt",
  "on-the-job",
  "training",
  "practicum",
  "intern",
];

// Utility: Check if title/desc contains related terms
function isInternship(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  return internshipKeywords.some((kw) => text.includes(kw));
}

// Utility to extract qualifications text safely
function extractText($el) {
  return $el.text()?.trim()?.replace(/\s+/g, " ") || "N/A";
}



/* ---------------------------------------------------------
   JOBSTREET PHILIPPINES
--------------------------------------------------------- */
export async function scrapeJobStreet() {
  const url = "https://ph.jobstreet.com/internship-jobs";
  const { data } = await axios.get(url, { headers });
  const $ = cheerio.load(data);
  const jobs = [];

  $("div[data-automation='job-card']").each((_, el) => {
    const title = $(el).find("a[data-automation='job-card-title']").text().trim();
    const link = $(el).find("a[data-automation='job-card-title']").attr("href");
    const company = $(el).find("span[data-automation='job-card-company-name']").text().trim();
    const qualifications = extractText($(el).find("div[data-automation='job-card-snippet']"));

    if (isInternship(title, company)) {
      jobs.push({
        site: "JobStreet",
        title,
        position: title,
        company,
        link: link?.startsWith("http") ? link : `https://www.jobstreet.com.ph${link}`,
        skills: qualifications,
      });
    }
  });

  console.log("JobStreet jobs found:", jobs.length);
  return jobs;
}
/* ---------------------------------------------------------
   ONLINEJOBS.PH
--------------------------------------------------------- */
async function scrapeOnlineJobs() {
  const url =
    "https://www.onlinejobs.ph/jobseekers/jobsearch?keyword=internship";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $(".jobpost").each((_, el) => {
    const title = $(el).find("h4 a").text().trim();
    const link = $(el).find("h4 a").attr("href");
    const company = $(el).find(".company-name").text().trim();

    const qualifications = extractText($(el).find(".skillmarks, .jobdesc"));

    if (isInternship(title, company)) {
      jobs.push({
        site: "OnlineJobs.ph",
        title,
        position: title,
        company,
        link: `https://www.onlinejobs.ph${link}`,
        skills: qualifications,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   CAREERJET PHILIPPINES
--------------------------------------------------------- */
async function scrapeCareerJet() {
  const url = "https://www.careerjet.ph/search/jobs?s=internship";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $(".job").each((_, el) => {
    const title = $(el).find("h2 a").text().trim();
    const link = $(el).find("h2 a").attr("href");
    const company = $(el).find(".company").text().trim();

    const qualifications = extractText($(el).find(".desc, .content"));

    if (isInternship(title, company)) {
      jobs.push({
        site: "CareerJet",
        title,
        position: title,
        company,
        link,
        skills: qualifications,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   INDEED PHILIPPINES
--------------------------------------------------------- */
export async function scrapeIndeed() {
  const url = "https://ph.indeed.com/jobs?q=internship&l=Philippines";
  const { data } = await axios.get(url, { headers });
  const $ = cheerio.load(data);
  const jobs = [];

  $("a.tapItem").each((_, el) => {
    const title = $(el).find("h2.jobTitle span").text().trim();
    const company = $(el).find(".companyName").text().trim();
    const link = "https://ph.indeed.com" + $(el).attr("href");
    const qualifications = extractText($(el).find(".job-snippet li, .job-snippet"));

    if (isInternship(title, company)) {
      jobs.push({
        site: "Indeed",
        title,
        position: title,
        company,
        link,
        skills: qualifications,
      });
    }
  });

  console.log("Indeed jobs found:", jobs.length);
  return jobs;
}

/* ---------------------------------------------------------
   GLASSDOOR PHILIPPINES
--------------------------------------------------------- */
export async function scrapeGlassdoor() {
  const url = "https://www.glassdoor.com/Job/philippines-internship-jobs-SRCH_IL.0,11_IN204_KO12,22.htm";
  const { data } = await axios.get(url, { headers });
  const $ = cheerio.load(data);
  const jobs = [];

  $("li.react-job-listing").each((_, el) => {
    const title = $(el).find("a.jobLink").text().trim();
    const company = $(el).find(".jobEmpolyerName, .jobHeader").text().trim();
    const link = "https://www.glassdoor.com" + $(el).find("a.jobLink").attr("href");
    const qualifications = extractText($(el).find(".jobDescriptionContent"));

    if (isInternship(title, company)) {
      jobs.push({
        site: "Glassdoor",
        title,
        position: title,
        company,
        link,
        skills: qualifications,
      });
    }
  });

  console.log("Glassdoor jobs found:", jobs.length);
  return jobs
}

/* ---------------------------------------------------------
   LINKEDIN JOBS
--------------------------------------------------------- */
async function scrapeLinkedIn() {
  const url =
    "https://www.linkedin.com/jobs/search?keywords=internship&location=Philippines";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $(".base-card").each((_, el) => {
    const title = $(el).find(".base-search-card__title").text().trim();
    const company = $(el).find(".base-search-card__subtitle").text().trim();
    const link = $(el).find("a.base-card__full-link").attr("href");

    const qualifications = extractText(
      $(el).find(".job-card-container__description, .result-benefits")
    );

    if (isInternship(title, company)) {
      jobs.push({
        site: "LinkedIn",
        title,
        position: title,
        company,
        link,
        skills: qualifications,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   COMBINE ALL SCRAPERS
--------------------------------------------------------- */
router.get("/jobs", async (req, res) => {
  try {
    const [
      jobStreet,
      onlineJobs,
      careerJet,
      indeed,
      glassdoor,
      linkedIn,
    ] = await Promise.allSettled([
      scrapeJobStreet(),
      scrapeOnlineJobs(),
      scrapeCareerJet(),
      scrapeIndeed(),
      scrapeGlassdoor(),
      scrapeLinkedIn(),
    ]);

    let allJobs = [
      ...(jobStreet.value || []),
      ...(onlineJobs.value || []),
      ...(careerJet.value || []),
      ...(indeed.value || []),
      ...(glassdoor.value || []),
      ...(linkedIn.value || []),
    ];

    /* ========================================================
        1.) REMOVE DUPLICATES FROM SCRAPED DATA ITSELF
    ======================================================== */
    const seen = new Set();
    allJobs = allJobs.filter(job => {
      const key = `${job.company}-${job.position}-${job.link}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    /* ========================================================
        2.) SAVE ONLY NEW JOBS TO DATABASE (link-based)
    ======================================================== */
    let savedCount = 0;

    for (const job of allJobs) {
      const exists = await checkDuplicate(job.link);
      if (!exists) {
        await saveJob(job);
        savedCount++;
      }
    }

    /* ========================================================
        Return ALL scraped jobs 
    ======================================================== */
    res.json({
      totalScraped: allJobs.length,
      newJobsSaved: savedCount,
      jobs: allJobs,
    });

  } catch (err) {
    console.error("Scraper error:", err.message);
    res.status(500).json({ error: "Error fetching job data" });
  }
});


export default router;