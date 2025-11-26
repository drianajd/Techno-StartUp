# scraper.py
import asyncio
import json
from playwright.async_api import async_playwright
import requests
from bs4 import BeautifulSoup

# Search config
SEARCH_KEYWORD = "internship"
LOCATION = "Philippines"
MAX_PAGES = 2  # Reduce for testing; increase as needed

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

            if title:
                jobs.append({
                    "site": "JobStreet",
                    "title": title.strip(),
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

    for p in range(0, MAX_PAGES):
        url = f"https://ph.indeed.com/jobs?q={SEARCH_KEYWORD}&l={LOCATION}&start={p*10}"
        await page.goto(url, wait_until="domcontentloaded")
        for _ in range(3):
            await page.evaluate("window.scrollBy(0, document.body.scrollHeight / 3)")
            await asyncio.sleep(0.8)

        cards = await page.query_selector_all("div.job_seen_beacon, div.slider_container, article.jobsearch-SerpJobCard, div.jobsearch-SerpJobCard")
        if not cards:
            cards = await page.query_selector_all("a.jcs-JobTitle, a.tapItem")

        title_sel_candidates = ["h2.jobTitle > span", "h2 > span", "a.jobtitle", "a.jcs-JobTitle > span", "a.tapItem > h2 > span"]
        company_sel_candidates = ["span.companyName", "span.company", "div.company > a", "div.company"]
        location_sel_candidates = ["div.companyLocation", "div.location", "span.location", "div.company > div"]
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

            if title:
                jobs.append({
                    "site": "Indeed",
                    "title": title,
                    "company": company or "",
                    "location": location or "",
                    "link": link or ""
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
        if title and "internship" in title.text.lower():
            linkedin_jobs.append({
                "site": "LinkedIn",
                "title": title.text.strip(),
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

        if title:
            jobs.append({
                "site": "Kalibrr",
                "title": title,
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
