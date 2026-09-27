-- CreateEnum
CREATE TYPE "BusinessLinkKind" AS ENUM ('INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'MENU', 'REVIEW', 'ORDER', 'WIFI', 'CUSTOM');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "gameEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestionsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BusinessLink" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "BusinessLinkKind" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "value" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessLink_businessId_sortOrder_idx" ON "BusinessLink"("businessId", "sortOrder");

-- CreateIndex
CREATE INDEX "Suggestion_businessId_createdAt_idx" ON "Suggestion"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessLink" ADD CONSTRAINT "BusinessLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

