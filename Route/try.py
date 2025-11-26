# File: internship_scraper.py
import asyncio
from playwright.async_api import async_playwright
import csv
from datetime import datetime

# Output CSV file
OUTPUT_FILE = f"internship_jobs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

# Search config
SEARCH_KEYWORD = "internship"
LOCATION = "Philippines"
MAX_PAGES = 2  # Reduce for testing; increase as needed

jobs = []
#WORKING BUT INCORRECT QUERYSELECTORS
# ---------------- JobStreet ----------------
async def scrape_jobstreet(page):
    for p in range(1, MAX_PAGES + 1):
        url = f"https://ph.jobstreet.com/internship-jobs/in-Philippines"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        # NEW selectors (2025 layout)
        cards = await page.query_selector_all("div[data-automation='job-card'], article[data-automation='normalJob']")
        if not cards:
            # fallback container selector
            cards = await page.query_selector_all("div#job-card")

        for card in cards:
            # title fallbacks
            title = None
            for sel in [
                "a[data-automation='jobTitle']",
                "a.job-title",
                "h3 a"
            ]:
                try:
                    title = await card.eval_on_selector(sel, "el => el.innerText")
                    if title:
                        break
                except:
                    pass

            # company fallbacks
            company = None
            for sel in [
                "span[data-automation='jobCompany']",
                "a[data-automation='jobCompany']",
                "span.company",
                "div.company a"
            ]:
                try:
                    company = await card.eval_on_selector(sel, "el => el.innerText")
                    if company:
                        break
                except:
                    pass

            # location fallbacks
            location = None
            for sel in [
                "span[data-automation='detailsLocation']",
                "span[data-automation='jobCardLocation']",
                "span.location",
                "div.job-location"
            ]:
                try:
                    location = await card.eval_on_selector(sel, "el => el.innerText")
                    if location:
                        break
                except:
                    pass

            # link
            link = None
            for sel in [
                "a[data-automation='jobTitle']",
                "a.job-title",
                "h3 a"
            ]:
                try:
                    link = await card.eval_on_selector(sel, "el => el.href")
                    if link:
                        break
                except:
                    pass

            if link and not link.startswith("http"):
                link = "https://www.jobstreet.com.ph" + link

            if title:
                jobs.append({
                    "site": "JobStreet",
                    "title": title.strip(),
                    "company": company.strip() if company else "",
                    "location": location.strip() if location else "",
                    "link": link
                })

#HAS CAPCHA
# ---------------- Indeed ---------------- 
async def scrape_indeed(page):
    async def safe_get_text(card, selectors):
        """Try a list of selectors on the ElementHandle and return the first non-empty text."""
        for sel in selectors:
            try:
                val = await card.eval_on_selector(sel, "el => el.innerText")
                if val:
                    return val.strip()
            except Exception:
                continue
        return None

    async def safe_get_href(card, selectors):
        """Try selectors that point to links and return the first href (absolute if possible)."""
        for sel in selectors:
            try:
                href = await card.eval_on_selector(sel, "el => el.href || el.getAttribute('href')")
                if href:
                    href = href.strip()
                    # normalize relative links
                    if href.startswith("/"):
                        href = "https://ph.indeed.com" + href
                    return href
            except Exception:
                continue
        return None

    # Wait until job cards appear (try a couple of common top-level locators)
    try:
        await page.wait_for_selector("div.job_seen_beacon, a.jcs-JobTitle, div.slider_container", timeout=10000)
    except Exception:
        # If nothing appears, still continue to attempt pages
        pass

    for p in range(0, MAX_PAGES):
        url = f"https://ph.indeed.com/jobs?q={SEARCH_KEYWORD}&l={LOCATION}&start={p*10}"
        await page.goto(url, wait_until="domcontentloaded")
        # small scrolls to trigger lazy load
        for _ in range(3):
            await page.evaluate("window.scrollBy(0, document.body.scrollHeight / 3)")
            await asyncio.sleep(0.8)

        # gather cards (use several possible containers)
        cards = await page.query_selector_all("div.job_seen_beacon, div.slider_container, article.jobsearch-SerpJobCard, div.jobsearch-SerpJobCard")
        if not cards:
            # fallback: try anchor-based job items
            cards = await page.query_selector_all("a.jcs-JobTitle, a.tapItem")

        # selectors to try for title/company/location/link (ordered from preferred to fallback)
        title_sel_candidates = [
            "h2.jobTitle > span",          # current common pattern
            "h2 > span",                   # simpler fallback
            "a.jobtitle",                  # legacy fallback
            "a.jcs-JobTitle > span",
            "a.tapItem > h2 > span"
        ]
        company_sel_candidates = [
            "span.companyName",
            "span.company",
            "div.company > a",
            "div.company"
        ]
        location_sel_candidates = [
            "div.companyLocation",
            "div.location",
            "span.location",
            "div.company > div"
        ]
        link_sel_candidates = [
            "h2 a",                        # typical anchor inside title
            "a.jcs-JobTitle",
            "a.tapItem",
            "a"                            # last resort: first anchor in card
        ]

        for card in cards:
            title = await safe_get_text(card, title_sel_candidates)
            company = await safe_get_text(card, company_sel_candidates)
            location = await safe_get_text(card, location_sel_candidates)
            link = await safe_get_href(card, link_sel_candidates)

            # Extra: if link is missing, try to build from jobId attribute if present
            if not link:
                try:
                    job_id = await card.get_attribute("data-jk") or await card.get_attribute("data-jcid")
                    if job_id:
                        link = f"https://ph.indeed.com/viewjob?jk={job_id}"
                except Exception:
                    pass

            if title:
                jobs.append({
                    "site": "Indeed",
                    "title": title,
                    "company": company or "",
                    "location": location or "",
                    "link": link or ""
                })


#WORKING PROPERLY
# ---------------- LinkedIn ----------------
def scrape_linkedin():
    import requests
    from bs4 import BeautifulSoup

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
        if title and "internship" in title.text.lower():
            linkedin_jobs.append({
                "site": "LinkedIn",
                "title": title.text.strip(),
                "company": company.text.strip() if company else "",
                "location": "",  # Can parse if needed
                "link": link['href'] if link else ""
            })
    return linkedin_jobs

# WORKING BUT INCORRECT QUERYSELECTORS
# ---------------- Kalibrr ----------------
# async def scrape_kalibrr(page):
#     for p in range(1, MAX_PAGES + 1):
#         url = f"https://www.kalibrr.com/home/co/Philippines/w/100-internship-or-ojt"
#         await page.goto(url, wait_until="domcontentloaded")
#         await asyncio.sleep(2)

#         cards = await page.query_selector_all("div.css-1m4v4ye")
#         for card in cards:
#             title = await card.query_selector_eval("a.css-1jv94bl", "el => el.innerText", strict=False)
#             company = await card.query_selector_eval("span.css-1b9rs62", "el => el.innerText", strict=False)
#             location = await card.query_selector_eval("span.css-1va4azx", "el => el.innerText", strict=False)
#             link = await card.query_selector_eval("a.css-1jv94bl", "el => el.href", strict=False)
#             if title:
#                 jobs.append({
#                     "site": "Kalibrr",
#                     "title": title.strip(),
#                     "company": company.strip() if company else "",
#                     "location": location.strip() if location else "",
#                     "link": link
#                 })

async def scrape_kalibrr(page):
    url = "https://www.kalibrr.com/home/co/Philippines/w/100-internship-or-ojt"

    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    # scroll to load content
    await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
    await asyncio.sleep(2)

    cards = await page.query_selector_all("div.k-font-dm-sans.k-rounded-lg")

    for card in cards:

        # title
        title = await card.eval_on_selector(
            "h2 a",
            "el => el.textContent?.trim()"
        )

        # company
        company = await card.eval_on_selector(
            "span.k-inline-flex a",
            "el => el.textContent?.trim()"
        )

        # location
        location = await card.eval_on_selector(
            "span.k-text-gray-500",
            "el => el.textContent?.trim()"
        )

        # link
        link = await card.eval_on_selector(
            "h2 a",
            "el => el.href"
        )

        if title:
            jobs.append({
                "site": "Kalibrr",
                "title": title,
                "company": company or "",
                "location": location or "",
                "link": link
            })


# ---------------- Main ----------------
async def main():
    async with async_playwright() as p:
        chrome_path = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"  # Update your path
        browser = await p.chromium.launch(headless=False, executable_path=chrome_path)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/142.0.0.0 Safari/537.36"
        )

        page = await context.new_page()

        print("Scraping JobStreet...")
        await scrape_jobstreet(page)
        print("Scraping Indeed...")
        await scrape_indeed(page)
        print("Scraping LinkedIn...")
        linkedin_jobs = scrape_linkedin()
        jobs.extend(linkedin_jobs)
        print("Scraping Kalibrr...")
        await scrape_kalibrr(page)

        await browser.close()

    # Remove duplicates based on link
    unique_jobs = {job['link']: job for job in jobs}.values()

    # Save to CSV
    with open(OUTPUT_FILE, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=["site", "title", "company", "location", "link"])
        writer.writeheader()
        for job in unique_jobs:
            writer.writerow(job)

    print(f"Saved {len(unique_jobs)} jobs to {OUTPUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
