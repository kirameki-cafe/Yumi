-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '>',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "MembershipScreening_ApprovalChannel" TEXT,
    "MembershipScreening_Enabled" BOOLEAN NOT NULL DEFAULT false,
    "MembershipScreening_GivenRole" TEXT,
    "ServiceAnnouncement_Channel" TEXT,
    "ServiceAnnouncement_Enabled" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

