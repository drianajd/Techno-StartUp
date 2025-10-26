// Route/scraper.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

// ✅ Keywords for internship/OJT listings
const internshipKeywords = [
  "internship",
  "ojt",
  "on-the-job",
  "training",
  "practicum",
  "intern",
];

// ✅ Utility: Check if title/desc contains related terms
function isInternship(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  return internshipKeywords.some((kw) => text.includes(kw));
}

/* ---------------------------------------------------------
   JOBSTREET PHILIPPINES
--------------------------------------------------------- */
async function scrapeJobStreet() {
  const url = "https://www.jobstreet.com.ph/en/job-search/internship-jobs/";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $("article").each((_, el) => {
    const title = $(el).find("a").text().trim();
    const link = $(el).find("a").attr("href");
    const company = $(el)
      .find("span[data-automation='job-card-company-name']")
      .text()
      .trim();

    if (isInternship(title, company)) {
      jobs.push({
        site: "JobStreet",
        title,
        company,
        link: link?.startsWith("http")
          ? link
          : `https://www.jobstreet.com.ph${link}`,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   ONLINEJOBS.PH
--------------------------------------------------------- */
async function scrapeOnlineJobs() {
  const url = "https://www.onlinejobs.ph/jobseekers/jobsearch?keyword=internship";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $(".jobpost").each((_, el) => {
    const title = $(el).find("h4 a").text().trim();
    const link = $(el).find("h4 a").attr("href");
    const company = $(el).find(".company-name").text().trim();

    if (isInternship(title, company)) {
      jobs.push({
        site: "OnlineJobs.ph",
        title,
        company,
        link: `https://www.onlinejobs.ph${link}`,
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

    if (isInternship(title, company)) {
      jobs.push({
        site: "CareerJet",
        title,
        company,
        link,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   INDEED PHILIPPINES
--------------------------------------------------------- */
async function scrapeIndeed() {
  const url = "https://ph.indeed.com/jobs?q=internship";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $("a.tapItem").each((_, el) => {
    const title = $(el).find("h2.jobTitle").text().trim();
    const company = $(el).find(".companyName").text().trim();
    const link = "https://ph.indeed.com" + $(el).attr("href");

    if (isInternship(title, company)) {
      jobs.push({
        site: "Indeed",
        title,
        company,
        link,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   GLASSDOOR PHILIPPINES
--------------------------------------------------------- */
async function scrapeGlassdoor() {
  const url = "https://www.glassdoor.com/Job/philippines-internship-jobs-SRCH_IL.0,11_IN204_KO12,22.htm";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $(".job-search-1 .jobCard").each((_, el) => {
    const title = $(el).find(".jobTitle").text().trim();
    const company = $(el).find(".employerName").text().trim();
    const link = "https://www.glassdoor.com" + $(el).find("a").attr("href");

    if (isInternship(title, company)) {
      jobs.push({
        site: "Glassdoor",
        title,
        company,
        link,
      });
    }
  });

  return jobs;
}

/* ---------------------------------------------------------
   LINKEDIN JOBS
--------------------------------------------------------- */
async function scrapeLinkedIn() {
  const url = "https://www.linkedin.com/jobs/search?keywords=internship&location=Philippines";
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const jobs = [];

  $(".base-card").each((_, el) => {
    const title = $(el).find(".base-search-card__title").text().trim();
    const company = $(el).find(".base-search-card__subtitle").text().trim();
    const link = $(el).find("a.base-card__full-link").attr("href");

    if (isInternship(title, company)) {
      jobs.push({
        site: "LinkedIn",
        title,
        company,
        link,
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

    // Only keep fulfilled promises
    const allJobs = [
      ...(jobStreet.value || []),
      ...(onlineJobs.value || []),
      ...(careerJet.value || []),
      ...(indeed.value || []),
      ...(glassdoor.value || []),
      ...(linkedIn.value || []),
    ];

    if (allJobs.length === 0) {
      return res.json([{ message: "No internship or OJT listings found." }]);
    }

    res.json(allJobs);
  } catch (error) {
    console.error("Scraper error:", error.message);
    res.status(500).json({ error: "Error fetching job data." });
  }
});

export default router;
