-- AlterTable
ALTER TABLE "StaffMembership" ADD COLUMN     "seesFullSchedule" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffMembershipId" TEXT NOT NULL,
    "locationId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shift_businessId_startsAt_idx" ON "Shift"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "Shift_staffMembershipId_startsAt_idx" ON "Shift"("staffMembershipId", "startsAt");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_staffMembershipId_fkey" FOREIGN KEY ("staffMembershipId") REFERENCES "StaffMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
