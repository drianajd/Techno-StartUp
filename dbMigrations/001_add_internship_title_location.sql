-- Apply once to older Grantify databases that have position but lack title/location.
-- These additions preserve existing records and are already present in dbSchema.txt.
ALTER TABLE internships
  ADD COLUMN title VARCHAR(255) NULL AFTER id,
  ADD COLUMN location VARCHAR(255) NULL AFTER position;
