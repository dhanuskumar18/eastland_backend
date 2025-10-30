-- CreateTable
CREATE TABLE "CsrfToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CsrfToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CsrfToken_token_key" ON "CsrfToken"("token");

-- CreateIndex
CREATE INDEX "CsrfToken_token_idx" ON "CsrfToken"("token");

-- CreateIndex
CREATE INDEX "CsrfToken_sessionId_idx" ON "CsrfToken"("sessionId");

-- CreateIndex
CREATE INDEX "CsrfToken_userId_idx" ON "CsrfToken"("userId");

-- CreateIndex
CREATE INDEX "CsrfToken_expiresAt_idx" ON "CsrfToken"("expiresAt");
