UPDATE "JobEntry"
SET "status" = 'FOLLOW_UP_SENT'
WHERE "referralFollowUpSent" = true
   OR "coldEmailFollowUpSent" = true;
