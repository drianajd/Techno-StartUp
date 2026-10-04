# scraper.py
import asyncio
import json
from playwright.async_api import async_playwright
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import re
import sys
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
    "engineering",

    # ---------------- Extra IT / CS ----------------
    "information technology", "computer science", "computer engineering",
    "software engineer", "software developer", "web developer",
    "mobile developer", "android", "ios", "java", "python", "javascript",
    "php", "react", "node", "laravel", ".net", "c#", "wordpress",
    "data analyst", "data science", "data scientist", "data engineer",
    "business intelligence", "machine learning", "ai", "artificial intelligence",
    "automation", "robotics", "embedded", "iot", "game developer", "game",
    "it support", "help desk", "helpdesk", "service desk", "it operations",
    "infrastructure", "sysadmin", "system administrator", "network engineer",
    "cybersecurity", "information security", "penetration", "ui/ux",
    "ux designer", "ui designer", "product designer", "product", "scrum",
    "business analyst", "systems analyst", "erp", "sap", "crm", "seo",
    "digital marketing", "e-commerce", "ecommerce", "technical writer",

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
    for acr in ("IT", "HR", "QA", "QC", "CSR", "PR", "UI", "UX", "AI", "SEO", "ERP", "SAP", "CRM", "IOS", "IOT", "PHP", "BPO", "CAD", "NGO"):
        result = re.sub(r'\b' + acr.title() + r'\b', "iOS" if acr == "IOS" else acr, result)

    return result + " Internship"

jobs = []

LOGO_JS = """el => {
  for (const i of el.querySelectorAll('img')) {
    const s = i.currentSrc || i.src || i.dataset.src || i.dataset.delayedUrl || '';
    if (/^https?:/.test(s) && !/sprite|placeholder|spacer|avatar/i.test(s)) return s;
  }
  return '';
}"""


async def card_logo(card):
    try:
        return await card.evaluate(LOGO_JS) or ""
    except Exception:
        return ""

DATE_JS = """el => {
    const t = el.querySelector('time[datetime]');
    if (t) return t.getAttribute('datetime');
    const d = el.querySelector("[data-automation='jobListingDate'], [data-testid='myJobsStateDate'], span.date, [data-test='job-age'], [class*='listdate']");
    if (d) return d.innerText;
    const m = (el.innerText || '').match(/(just posted|today|posted\\s+\\d+\\+?\\s*\\w+\\s+ago|\\d+\\+?\\s*(?:h|d|w|mo|m|hours?|days?|weeks?|months?|minutes?)\\s*(?:ago)?\\b)/i);
    return m ? m[0] : '';
}"""


def parse_posted_date(text):
    """Convert ISO dates or relative text ('3d ago', 'Posted 2 weeks ago') to an ISO datetime string. Falls back to now."""
    now = datetime.now()
    text = (text or "").strip().lower()
    if text:
        iso = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
        if iso:
            try:
                return datetime(int(iso.group(1)), int(iso.group(2)), int(iso.group(3))).strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        if re.search(r"just posted|today|\bnow\b", text):
            return now.strftime("%Y-%m-%d %H:%M:%S")
        m = re.search(r"(\d+)\+?\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|h|d|w|m)\b", text)
        if m:
            n, unit = int(m.group(1)), m.group(2)
            if unit.startswith(("min",)) or unit == "m":
                delta = timedelta(minutes=n)
            elif unit.startswith("h"):
                delta = timedelta(hours=n)
            elif unit.startswith("d"):
                delta = timedelta(days=n)
            elif unit.startswith("w"):
                delta = timedelta(weeks=n)
            else:
                delta = timedelta(days=30 * n)
            return (now - delta).strftime("%Y-%m-%d %H:%M:%S")
    return now.strftime("%Y-%m-%d %H:%M:%S")


async def card_date(card):
    try:
        return parse_posted_date(await card.evaluate(DATE_JS))
    except Exception:
        return parse_posted_date("")

# ---------------- JobStreet ----------------async def scrape_jobstreet(page):
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
                    "link": link,
                    "logo_url": await card_logo(card),
                    "date_posted": await card_date(card)
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
        link_sel_candidates = ["h2 a", "a.jcs-JobTitle", "a.tapItem"]

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
                    "link": link,
                    "logo_url": await card_logo(card),
                    "date_posted": await card_date(card)
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
                "link": link['href'] if link else "",
                "logo_url": (lambda i: (i.get("data-delayed-url") or i.get("src") or "") if i else "")(el.select_one("img")),
                "date_posted": parse_posted_date((el.select_one("time") or {}).get("datetime", "") if el.select_one("time") else "")
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
                "link": link,
                "logo_url": await card_logo(card),
                "date_posted": await card_date(card)
            })


# ---------------- Glassdoor ----------------
GLASSDOOR_URL = "https://www.glassdoor.com/Job/philippines-internship-jobs-SRCH_IL.0,11_IN204_KO12,22.htm"


async def scrape_glassdoor(playwright):
    # Glassdoor blocks bundled headless Chromium (Cloudflare 403); real Chrome in new-headless mode is used instead.
    browser = None
    try:
        browser = await playwright.chromium.launch(
            channel="chrome",
            headless=False,
            args=["--window-position=-32000,-32000", "--disable-blink-features=AutomationControlled"],
        )
        page = await (await browser.new_context()).new_page()
        resp = await page.goto(GLASSDOOR_URL, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_selector("li[data-test='jobListing']", timeout=15000)
        except Exception:
            print(f"Glassdoor: no listings (status {resp.status if resp else '?'}, title {await page.title()!r})", file=sys.stderr)
            return

        for card in await page.query_selector_all("li[data-test='jobListing']"):
            async def text(sel):
                el = await card.query_selector(sel)
                return (await el.inner_text()).strip() if el else ""

            title_el = await card.query_selector("a[data-test='job-title']")
            if not title_el:
                continue
            title = (await title_el.inner_text()).strip()
            link = await title_el.get_attribute("href")
            if not title or not link:
                continue
            jobs.append({
                "site": "Glassdoor",
                "title": title,
                "position": extract_position(title),
                "company": await text("[class*='EmployerProfile_compactEmployerName']"),
                "location": await text("[data-test='emp-location']"),
                "link": link,
                "logo_url": await card_logo(card),
                "date_posted": await card_date(card),
            })
    except Exception as e:
        print(f"Glassdoor scrape failed: {e}", file=sys.stderr)
    finally:
        if browser:
            await browser.close()


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
        await scrape_glassdoor(p)

    # Remove duplicates based on link
    unique_jobs = list({job['link']: job for job in jobs}.values())
    return unique_jobs


if __name__ == "__main__":
    # Output JSON for Node.js
    results = asyncio.run(scrape_all_jobs())
    print(json.dumps(results))

