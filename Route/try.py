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
        url = f"https://www.jobstreet.com.ph/en/job-search/{SEARCH_KEYWORD}-jobs-in-philippines?pg={p}"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)  # wait for page content

        cards = await page.query_selector_all("article[data-automation='normalJob']")
        for card in cards:
            title = await card.query_selector_eval("a[data-automation='jobTitle']", "el => el.innerText", strict=False)
            company = await card.query_selector_eval("a[data-automation='jobCompany']", "el => el.innerText", strict=False)
            location_nodes = await card.query_selector_all("span[data-automation='jobCardLocation'] a")
            location = ", ".join([await node.inner_text() for node in location_nodes]) if location_nodes else ""
            link = await card.query_selector_eval("a[data-automation='jobTitle']", "el => el.href", strict=False)
            if link and not link.startswith("http"):
                link = "https://www.jobstreet.com.ph" + link
            if title:
                jobs.append({
                    "site": "JobStreet",
                    "title": title.strip(),
                    "company": company.strip() if company else "",
                    "location": location.strip(),
                    "link": link
                })

#HAS CAPCHA
# ---------------- Indeed ---------------- 
async def scrape_indeed(page):
    async def safe_eval_on_selector(card, selector):
        try:
            return await card.eval_on_selector(selector, "el => el.innerText")
        except:
            return None

    async def safe_eval_on_selector_href(card, selector):
        try:
            return await card.eval_on_selector(selector, "el => el.href")
        except:
            return None

    for p in range(0, MAX_PAGES):
        url = f"https://ph.indeed.com/jobs?q={SEARCH_KEYWORD}&l={LOCATION}&start={p*10}"
        await page.goto(url)
        await page.wait_for_timeout(2000)

        cards = await page.query_selector_all("div.job_seen_beacon")
        for card in cards:
            title = await safe_eval_on_selector(card, "h2 > span")
            company = await safe_eval_on_selector(card, "span.companyName")
            location = await safe_eval_on_selector(card, "div.companyLocation")
            link = await safe_eval_on_selector_href(card, "h2 a")

            if title:
                jobs.append({
                    "site": "Indeed",
                    "title": title.strip(),
                    "company": company.strip() if company else "",
                    "location": location.strip() if location else "",
                    "link": link
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
async def scrape_kalibrr(page):
    for p in range(1, MAX_PAGES + 1):
        url = f"https://www.kalibrr.com/home/co/Philippines/w/100-internship-or-ojt"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        cards = await page.query_selector_all("div.css-1m4v4ye")
        for card in cards:
            title = await card.query_selector_eval("a.css-1jv94bl", "el => el.innerText", strict=False)
            company = await card.query_selector_eval("span.css-1b9rs62", "el => el.innerText", strict=False)
            location = await card.query_selector_eval("span.css-1va4azx", "el => el.innerText", strict=False)
            link = await card.query_selector_eval("a.css-1jv94bl", "el => el.href", strict=False)
            if title:
                jobs.append({
                    "site": "Kalibrr",
                    "title": title.strip(),
                    "company": company.strip() if company else "",
                    "location": location.strip() if location else "",
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
