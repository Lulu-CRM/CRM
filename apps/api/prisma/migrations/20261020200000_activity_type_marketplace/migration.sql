-- Marketplace events (POST /events) get their own activity type instead of showing as notes.
ALTER TYPE "activity_type" ADD VALUE 'marketplace';
