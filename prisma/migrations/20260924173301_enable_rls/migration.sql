-- Supabase exposes tables in the public schema through its Data API.
-- The app only accesses the database through Prisma (as the table owner,
-- which bypasses RLS), so enabling RLS with no policies blocks public API
-- access without affecting the app.
ALTER TABLE "Admin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Volunteer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Signup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Waiver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaiverAcceptance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
