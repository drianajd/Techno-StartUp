# scraper.py
import asyncio
import json
from playwright.async_api import async_playwright
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
# Search config
SEARCH_KEYWORD = "internship"
LOCATION = "Philippines"
MAX_PAGES = 5  # Reduce for testing; increase as needed

# Output CSV file for testing
# OUTPUT_FILE = f"internship_jobs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv" 

VALID_ROLE_KEYWORDS = [

    # ---------------- IT / CS ----------------
    "developer", "engineer", "programmer", "software", "web", "mobile",
    "qa", "quality assurance", "analyst", "data", "database", "network",
    "system", "systems", "ui", "ux", "design", "designer", "cyber",
    "security", "technical", "support", "it", "devops", "tester",
    "cloud", "full stack", "frontend", "backend", "tech", "technology",

    # ---------------- Business / Office ----------------
    "marketing", "hr", "human resources", "finance", "accounting",
    "admin", "administrative", "operations", "research", "assistant",
    "clerk", "executive", "business", "management", "sales", "service",
    "customer", "csr", "sourcing", "procurement", "purchasing",
    "audit", "auditing", "bookkeeping", "bookkeeper", "logistics",
    "supply chain", "project", "analyst", "coordinator",

    # ---------------- Creative / Media ----------------
    "video", "editor", "editing", "content", "multimedia", "graphic",
    "graphics", "animation", "animator", "photography", "photo",
    "social media", "media", "writer", "copywriter", "illustrator",
    "film", "creative", "production",

    # ---------------- Engineering ----------------
    "mechanical", "electrical", "civil", "industrial", "electronics",
    "mechatronics", "chemical", "architect", "architecture",
    "cad", "autocad", "drafter", "drafting", "surveying", "building",
    "engineering"

    # ---------------- Healthcare (common PH internships) ----------------
    "nursing", "medical", "health", "pharmacy", "pharmacist",
    "laboratory", "clinic", "clinical", "biotech", "biology",

    # ---------------- Education ----------------
    "teacher", "teaching", "education", "tutor", "trainer",

    # ---------------- Hospitality / Tourism ----------------
    "hotel", "tourism", "hospitality", "food", "beverage",
    "kitchen", "chef", "culinary", "front desk",

    # ---------------- Call Center / BPO ----------------
    "bpo", "call center", "agent", "csr", "customer service",
    "technical support",

    # ---------------- Science / R&D ----------------
    "science", "scientist", "laboratory", "lab", "researcher",
    "chemistry", "physics", "environmental",

    # ---------------- Manufacturing ----------------
    "production", "manufacturing", "factory", "qa", "qc", "quality control",

    # ---------------- Misc ----------------
    "writer", "translator", "paralegal", "legal", "law", "government",
    "ngo", "community", "public relations", "pr"

]

def extract_position(title: str) -> str:
    """
    Extracts the main role/position from an internship job title using WHOLE WORD matching.
    Returns: "Role Name Internship"  →  e.g., "Marketing Internship"
    Returns '' if no valid role found.
    """
    if not title:
        return ""

    t = " " + title.lower().strip() + " "  # add spaces to make word-boundary checks easy

    # Must contain at least one internship indicator (whole word)
    internship_indicators = [
        "internship", "ojt", "intern", "on-the-job", "practicum",
        "apprentice", "trainee", "student intern"
    ]
    if not any(re.search(r'\b' + re.escape(ind) + r'\b', t) for ind in internship_indicators):
        return ""

    # Find all VALID_ROLE_KEYWORDS that appear as whole words
    matches = []
    for role in VALID_ROLE_KEYWORDS:
        # Use word boundaries \b to match whole words only
        pattern = r'\b' + re.escape(role) + r'\b'
        if re.search(pattern, t):
            matches.append(role)

    if not matches:
        return ""

    # Pick the longest (most specific) match
    best = max(matches, key=len)

    # Capitalize properly and fix common acronyms
    result = best.title()
    result = result.replace(" It ", " IT ").replace(" Hr ", " HR ").replace(" Qa ", " QA ")
    result = result.replace(" Csr ", " CSR ").replace(" Pr ", " PR ").replace(" Ui ", " UI ").replace(" Ux ", " UX ")

    return result + " Internship"

jobs = []

# ---------------- JobStreet ----------------
async def scrape_jobstreet(page):
    for p in range(1, MAX_PAGES + 1):
        url = f"https://ph.jobstreet.com/internship-jobs/in-Philippines"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        cards = await page.query_selector_all("div[data-automation='job-card'], article[data-automation='normalJob']")
        if not cards:
            cards = await page.query_selector_all("div#job-card")

        for card in cards:
            title = None
            for sel in ["a[data-automation='jobTitle']", "a.job-title", "h3 a"]:
                try:
                    title = await card.eval_on_selector(sel, "el => el.innerText")
                    if title:
                        break
                except:
                    pass

            company = None
            for sel in ["span[data-automation='jobCompany']", "a[data-automation='jobCompany']", "span.company", "div.company a"]:
                try:
                    company = await card.eval_on_selector(sel, "el => el.innerText")
                    if company:
                        break
                except:
                    pass

            location = None
            for sel in ["span[data-automation='detailsLocation']", "span[data-automation='jobCardLocation']", "span.location", "div.job-location"]:
                try:
                    location = await card.eval_on_selector(sel, "el => el.innerText")
                    if location:
                        break
                except:
                    pass

            link = None
            for sel in ["a[data-automation='jobTitle']", "a.job-title", "h3 a"]:
                try:
                    link = await card.eval_on_selector(sel, "el => el.href")
                    if link:
                        break
                except:
                    pass

            if link and not link.startswith("http"):
                link = "https://www.jobstreet.com.ph" + link

            position = extract_position(title)

            if title:
                jobs.append({
                    "site": "JobStreet",
                    "title": title.strip(),
                    "position": position,
                    "company": company.strip() if company else "",
                    "location": location.strip() if location else "",
                    "link": link
                })


# ---------------- Indeed ----------------
async def scrape_indeed(page):
    async def safe_get_text(card, selectors):
        for sel in selectors:
            try:
                val = await card.eval_on_selector(sel, "el => el.innerText")
                if val:
                    return val.strip()
            except:
                continue
        return None

    async def safe_get_href(card, selectors):
        for sel in selectors:
            try:
                href = await card.eval_on_selector(sel, "el => el.href || el.getAttribute('href')")
                if href:
                    href = href.strip()
                    if href.startswith("/"):
                        href = "https://ph.indeed.com" + href
                    return href
            except:
                continue
        return None

    for p in range(0, 2):
        url = f"https://ph.indeed.com/jobs?q=internship&l=Philippines&ts="
        await page.goto(url, wait_until="domcontentloaded")
        for _ in range(3):
            await page.evaluate("window.scrollBy(0, document.body.scrollHeight / 3)")
            await asyncio.sleep(0.8)

        cards = await page.query_selector_all("div.job_seen_beacon, div.slider_container, article.jobsearch-SerpJobCard, div.jobsearch-SerpJobCard")
        if not cards:
            cards = await page.query_selector_all("a.jcs-JobTitle, a.tapItem")

        title_sel_candidates = ["h2.jobTitle > span", "h2 > span", "a.jobtitle", 
                                "a.jcs-JobTitle > span", "a.tapItem > h2 > span"]
        company_sel_candidates = ["span.companyName", "span.company", "div.company > a", "div.company",
                                  "span[data-testid='company-name']"]
        location_sel_candidates = ["div.companyLocation", "div.location", "span.location",
                                    "div.company > div", "div[data-testid='text-location']"]
        link_sel_candidates = ["h2 a", "a.jcs-JobTitle", "a.tapItem", "a"]

        for card in cards:
            title = await safe_get_text(card, title_sel_candidates)
            company = await safe_get_text(card, company_sel_candidates)
            location = await safe_get_text(card, location_sel_candidates)
            link = await safe_get_href(card, link_sel_candidates)

            if not link:
                try:
                    job_id = await card.get_attribute("data-jk") or await card.get_attribute("data-jcid")
                    if job_id:
                        link = f"https://ph.indeed.com/viewjob?jk={job_id}"
                except:
                    pass

            position = extract_position(title)
            if title:
                jobs.append({
                    "site": "Indeed",
                    "title": title.strip(),
                    "position": position,
                    "company": company.strip() if company else "",
                    "location": location.strip() if location else "",
                    "link": link
                })


# ---------------- LinkedIn ----------------
def scrape_linkedin():
    url = f"https://www.linkedin.com/jobs/search?keywords={SEARCH_KEYWORD}&location={LOCATION}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/142.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")

    linkedin_jobs = []
    for el in soup.select(".base-card"):
        title = el.select_one(".base-search-card__title")
        company = el.select_one(".base-search-card__subtitle")
        link = el.select_one("a.base-card__full-link")
        position = extract_position(title.get_text(strip=True) if title else "")
        if title and "internship" in title.text.lower():
            linkedin_jobs.append({
                "site": "LinkedIn",
                "title": title.text.strip(),
                "position": position,
                "company": company.text.strip() if company else "",
                "location": "",
                "link": link['href'] if link else ""
            })
    return linkedin_jobs


# ---------------- Kalibrr ----------------
async def scrape_kalibrr(page):
    url = "https://www.kalibrr.com/home/co/Philippines/w/100-internship-or-ojt"
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
    await asyncio.sleep(2)

    cards = await page.query_selector_all("div.k-font-dm-sans.k-rounded-lg")

    for card in cards:
        title = await card.eval_on_selector("h2 a", "el => el.textContent?.trim()")
        company = await card.eval_on_selector("span.k-inline-flex a", "el => el.textContent?.trim()")
        location = await card.eval_on_selector("span.k-text-gray-500", "el => el.textContent?.trim()")
        link = await card.eval_on_selector("h2 a", "el => el.href")
        position = extract_position(title)
        if title:
            jobs.append({
                "site": "Kalibrr",
                "title": title,
                "position": position,
                "company": company or "",
                "location": location or "",
                "link": link
            })


# ---------------- Main ----------------
async def scrape_all_jobs():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/142.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        await scrape_jobstreet(page)
        await scrape_indeed(page)
        linkedin_jobs = scrape_linkedin()
        jobs.extend(linkedin_jobs)
        await scrape_kalibrr(page)

        await browser.close()

    # Remove duplicates based on link
    unique_jobs = list({job['link']: job for job in jobs}.values())
    return unique_jobs


if __name__ == "__main__":
    # Output JSON for Node.js
    results = asyncio.run(scrape_all_jobs())
    print(json.dumps(results))
