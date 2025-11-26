# # jobspy_scraper.py
# import os
# import mysql.connector
# from jobspy import scrape_jobs
# from dotenv import load_dotenv

# # --- Load environment variables ---
# load_dotenv()

# DB_HOST = os.getenv("DB_HOST", "localhost")
# DB_USER = os.getenv("DB_USER", "root")
# DB_PASS = os.getenv("DB_PASS", "")
# DB_NAME = os.getenv("DB_NAME", "grantify")

# RESULTS_WANTED = 50  # jobs per scrape

# # --- Database connection ---
# def get_db_connection():
#     try:
#         conn = mysql.connector.connect(
#             host=DB_HOST,
#             user=DB_USER,
#             password=DB_PASS,
#             database=DB_NAME
#         )
#         return conn
#     except mysql.connector.Error as e:
#         print("Error connecting to database:", e)
#         return None

# # --- Save jobs to MySQL ---
# def save_jobs_to_db(jobs):
#     conn = get_db_connection()
#     if not conn:
#         print("Database connection failed, cannot save jobs.")
#         return 0

#     cursor = conn.cursor()
#     inserted = 0

#     for job in jobs:
#         if isinstance(job, str):
#             job = {
#                 "title": job,
#                 "company": "",
#                 "url": "",
#                 "description": "",
#                 "site": ""
#             }
#         elif not isinstance(job, dict):
#             continue

#         db_job = {
#             "company": job.get("company") or "",
#             "position": job.get("title") or "",
#             "link": job.get("url") or job.get("link") or "",
#             "qualifications": job.get("description") or "",
#             "site": job.get("site") or ""
#         }

#         try:
#             if not db_job["link"]:
#                 continue

#             # Skip duplicates
#             cursor.execute(
#                 "SELECT id FROM internships WHERE link=%s",
#                 (db_job["link"],)
#             )
#             if cursor.fetchone():
#                 continue

#             cursor.execute(
#                 """
#                 INSERT INTO internships (company, position, link, qualifications, site)
#                 VALUES (%s, %s, %s, %s, %s)
#                 """,
#                 (db_job["company"], db_job["position"], db_job["link"], db_job["qualifications"], db_job["site"])
#             )
#             inserted += 1

#             # DEBUG: print inserted job
#             print(f"Inserted job: {db_job['position']} at {db_job['company']} ({db_job['site']})")
#             print(f"Link: {db_job['link']}")
#             print(f"Description: {db_job['qualifications'][:100]}...\n")

#         except Exception as e:
#             print("Error inserting job:", e)

#     conn.commit()
#     cursor.close()
#     conn.close()
#     print(f"Inserted {inserted} new jobs into the database.")
#     return inserted

# # --- Scraping function ---
# def scrape_internships():
#     print("Starting JobSpy scraping for Philippines internships...")
#     sites = ["indeed", "linkedin"]
#     all_jobs = []

#     for site in sites:
#         try:
#             print(f"Scraping {site} jobs...")

#             kwargs = {
#                 "site_name": [site],
#                 "search_term": "internship",
#                 "location": "Philippines",
#                 "results_wanted": RESULTS_WANTED
#             }

#             # Indeed requires country_indeed parameter
#             if site == "indeed":
#                 kwargs["country_indeed"] = "Philippines"

#             jobs = scrape_jobs(**kwargs)
#             print(f"Found {len(jobs)} jobs on {site}.")

#             for job in jobs:
#                 if isinstance(job, dict):
#                     job["site"] = site
#                 all_jobs.append(job)

#         except Exception as e:
#             print(f"Error scraping {site}: {e}")

#     print(f"Total jobs found across all sites: {len(all_jobs)}")
#     return all_jobs

# # --- Standalone execution ---
# if __name__ == "__main__":
#     jobs = scrape_internships()
#     save_jobs_to_db(jobs)


# jobspy_scraper.py
# jobspy_scraper.py
# jobspy_scraper.py
# jobspy_scraper.py
import os
import json
from jobspy import scrape_jobs
from dotenv import load_dotenv

load_dotenv()
RESULTS_WANTED = 50

def scrape_internships():
    sites = ["indeed", "linkedin"]
    all_jobs = []

    for site in sites:
        try:
            print(f"Scraping {site} jobs...")

            kwargs = {
                "site_name": [site],
                "search_term": "internship",
                "location": "Philippines",
                "results_wanted": RESULTS_WANTED,
                "hours_old": 168
            }

            if site == "indeed":
                kwargs["country_indeed"] = "Philippines"
            if site == "linkedin":
                kwargs["linkedin_fetch_description"] = True

            jobs = scrape_jobs(**kwargs)
            print(f"Found {len(jobs)} jobs on {site}.")

            # --- Print all jobs before filtering ---
            print(f"\n--- All jobs from {site} ---")
            for i, job in enumerate(jobs, 1):
                print(f"{i}: {job}\n")
            print(f"--- End of {site} jobs ---\n")

            # --- Filter valid jobs ---
            filtered_jobs = []
            for job in jobs:
                if not isinstance(job, dict):
                    continue
                url = job.get("job_url") or job.get("job_url_direct") or ""
                title = job.get("title") or ""
                if url.strip() != "" and title.strip() != "":
                    job["site"] = site
                    job["url"] = url
                    filtered_jobs.append(job)

            all_jobs.extend(filtered_jobs)

        except Exception as e:
            print(f"Error scraping {site}: {e}")

    print(f"Total valid jobs found across all sites: {len(all_jobs)}")
    return all_jobs

if __name__ == "__main__":
    jobs = scrape_internships()
    print(json.dumps(jobs, ensure_ascii=False, indent=2))
