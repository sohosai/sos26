-- CreateIndex
CREATE INDEX "FormDelivery_projectId_createdAt_idx" ON "FormDelivery"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "FormItemEditHistory_projectId_trigger_createdAt_idx" ON "FormItemEditHistory"("projectId", "trigger", "createdAt");

-- CreateIndex
CREATE INDEX "InquiryAssignee_userId_side_deletedAt_idx" ON "InquiryAssignee"("userId", "side", "deletedAt");

-- CreateIndex
CREATE INDEX "MastersheetCellSelectedOption_optionId_idx" ON "MastersheetCellSelectedOption"("optionId");

-- CreateIndex
CREATE INDEX "UserPushSubscription_pushSubscriptionId_idx" ON "UserPushSubscription"("pushSubscriptionId");
