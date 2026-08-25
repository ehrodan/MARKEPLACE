# Graph Report - .  (2026-08-24)

## Corpus Check
- Large corpus: 580 files · ~782,477 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3883 nodes · 7548 edges · 287 communities (254 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Autorizacao de Pedido
- Carrinho Multivendedor
- Assets do Catalogo
- Detalhe de Venda
- Landing Scroll-3D
- Confirmacao de Entrega
- Busca e Filtros
- Item-Base e Ofertas
- Shell da Conta
- Estado de Checkout
- Retencao e Consentimento
- Contratos de Conta
- Login e Cadastro
- Compras do Comprador
- Comunidade 14
- Comunidade 15
- Comunidade 16
- Comunidade 17
- Comunidade 18
- Comunidade 19
- Comunidade 20
- Comunidade 21
- Comunidade 22
- Comunidade 23
- Comunidade 24
- Comunidade 25
- Comunidade 26
- Comunidade 27
- Comunidade 28
- Comunidade 29
- Comunidade 30
- Comunidade 31
- Comunidade 32
- Comunidade 33
- Comunidade 34
- Comunidade 35
- Comunidade 36
- Comunidade 37
- Comunidade 38
- Comunidade 39
- Comunidade 40
- Comunidade 41
- Comunidade 42
- Comunidade 43
- Comunidade 44
- Comunidade 45
- Comunidade 46
- Comunidade 47
- Comunidade 48
- Comunidade 49
- Comunidade 50
- Comunidade 51
- Comunidade 52
- Comunidade 53
- Comunidade 54
- Comunidade 55
- Comunidade 56
- Comunidade 57
- Comunidade 58
- Comunidade 59
- Comunidade 60
- Comunidade 61
- Comunidade 62
- Comunidade 63
- Comunidade 64
- Comunidade 65
- Comunidade 66
- Comunidade 67
- Comunidade 68
- Comunidade 69
- Comunidade 70
- Comunidade 71
- Comunidade 72
- Comunidade 73
- Comunidade 74
- Comunidade 75
- Comunidade 76
- Comunidade 77
- Comunidade 78
- Comunidade 79
- Comunidade 80
- Comunidade 81
- Comunidade 82
- Comunidade 83
- Comunidade 84
- Comunidade 85
- Comunidade 86
- Comunidade 87
- Comunidade 88
- Comunidade 89
- Comunidade 90
- Comunidade 91
- Comunidade 92
- Comunidade 93
- Comunidade 94
- Comunidade 95
- Comunidade 96
- Comunidade 97
- Comunidade 98
- Comunidade 99
- Comunidade 100
- Comunidade 101
- Comunidade 102
- Comunidade 103
- Comunidade 104
- Comunidade 105
- Comunidade 106
- Comunidade 107
- Comunidade 108
- Comunidade 109
- Comunidade 110
- Comunidade 111
- Comunidade 112
- Comunidade 113
- Comunidade 114
- Comunidade 115
- Comunidade 116
- Comunidade 117
- Comunidade 118
- Comunidade 119
- Comunidade 120
- Comunidade 121
- Comunidade 122
- Comunidade 123
- Comunidade 124
- Comunidade 125
- Comunidade 126
- Comunidade 127
- Comunidade 128
- Comunidade 129
- Comunidade 130
- Comunidade 131
- Comunidade 132
- Comunidade 133
- Comunidade 134
- Comunidade 135
- Comunidade 136
- Comunidade 137
- Comunidade 138
- Comunidade 139
- Comunidade 140
- Comunidade 141
- Comunidade 142
- Comunidade 143
- Comunidade 144
- Comunidade 145
- Comunidade 146
- Comunidade 147
- Comunidade 148
- Comunidade 149
- Comunidade 150
- Comunidade 151
- Comunidade 152
- Comunidade 153
- Comunidade 154
- Comunidade 155
- Comunidade 156
- Comunidade 157
- Comunidade 158
- Comunidade 159
- Comunidade 160
- Comunidade 161
- Comunidade 162
- Comunidade 163
- Comunidade 164
- Comunidade 165
- Comunidade 166
- Comunidade 167
- Comunidade 168
- Comunidade 169
- Comunidade 170
- Comunidade 171
- Comunidade 172
- Comunidade 173
- Comunidade 174
- Comunidade 175
- Comunidade 176
- Comunidade 177
- Comunidade 178
- Comunidade 179
- Comunidade 180
- Comunidade 181
- Comunidade 182
- Comunidade 183
- Comunidade 184
- Comunidade 185
- Comunidade 186
- Comunidade 187
- Comunidade 188
- Comunidade 189
- Comunidade 190
- Comunidade 191
- Comunidade 192
- Comunidade 193
- Comunidade 194
- Comunidade 195
- Comunidade 196
- Comunidade 197
- Comunidade 198
- Comunidade 199
- Comunidade 200
- Comunidade 201
- Comunidade 202
- Comunidade 203
- Comunidade 204
- Comunidade 205
- Comunidade 206
- Comunidade 207
- Comunidade 208
- Comunidade 209
- Comunidade 210
- Comunidade 211
- Comunidade 212
- Comunidade 213
- Comunidade 214
- Comunidade 264
- Comunidade 265
- Comunidade 266
- Comunidade 267
- Comunidade 270
- Comunidade 271
- Comunidade 272
- Comunidade 273
- Comunidade 282

## God Nodes (most connected - your core abstractions)
1. `useApiResource()` - 75 edges
2. `ScreenContractPage()` - 68 edges
3. `isApiError()` - 53 edges
4. `.next/**` - 50 edges
5. `Button` - 48 edges
6. `PageState()` - 43 edges
7. `StatusBadge()` - 42 edges
8. `Panel()` - 39 edges
9. `MidasTransaction` - 37 edges
10. `formatDateTime()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `appendAuditEvent()` --references--> `MidasTransaction`  [EXTRACTED]
  modules/administration-audit/src/audit.ts → packages/database/src/database.ts
- `appendOutboxEvent()` --references--> `MidasTransaction`  [EXTRACTED]
  modules/eventing/src/outbox.ts → packages/database/src/database.ts
- `recordInboxOnce()` --references--> `MidasTransaction`  [EXTRACTED]
  modules/eventing/src/outbox.ts → packages/database/src/database.ts
- `SyncState` --references--> `StatusTone`  [EXTRACTED]
  apps/web/components/cart/cart-view.tsx → packages/ui/src/status-badge.tsx
- `GroupDescriptor` --references--> `StatusTone`  [EXTRACTED]
  apps/web/components/favorites/favorites-view.tsx → packages/ui/src/status-badge.tsx

## Import Cycles
- None detected.

## Communities (287 total, 33 thin omitted)

### Community 0 - "Autorizacao de Pedido"
Cohesion: 0.05
Nodes (83): assertActiveSellerMembership(), assertDeliveryRole(), assertOrderBuyer(), assertOrderParticipant(), hasActiveSellerMembership(), orderNotFound(), OrderParticipant, OrdersQueryExecutor (+75 more)

### Community 1 - "Carrinho Multivendedor"
Cohesion: 0.08
Nodes (60): CartLine(), CartLineCheck, CartLineProps, CartLineStatus, CartLineStatusKind, describeCartLine(), effectiveUnitPriceMinor(), activeLines() (+52 more)

### Community 2 - "Assets do Catalogo"
Cohesion: 0.07
Nodes (36): isSafeCatalogAssetUri(), ApproveAssetInput, AssetRow, AssetService, conflict(), CreateAssetInput, isMetadataRecord(), notFound() (+28 more)

### Community 3 - "Detalhe de Venda"
Cohesion: 0.06
Nodes (55): allowedTransitions, deliveryLabels, isSellerOrderStatus(), MoneyRow(), orderDetailSource(), parseEvents(), parseSaleOrderDetail(), SaleOrderDetail (+47 more)

### Community 4 - "Landing Scroll-3D"
Cohesion: 0.08
Nodes (42): LandingDepthCut(), marks, LandingFinalCta(), LandingHero(), LandingViewerInvite(), FreshnessProps, marks, PageStateKind (+34 more)

### Community 5 - "Confirmacao de Entrega"
Cohesion: 0.09
Nodes (50): ConfirmationCard(), ConfirmationPanel(), ConfirmationPanelProps, confirmationSentence(), delivery(), order(), renderPanel(), CustodyCard() (+42 more)

### Community 6 - "Busca e Filtros"
Cohesion: 0.08
Nodes (51): metadata, isSortValue(), SearchFilters(), SearchFiltersProps, activeFacets(), applySearch(), CHANNEL_LABELS, compareMinorStrings() (+43 more)

### Community 7 - "Item-Base e Ofertas"
Cohesion: 0.10
Nodes (43): AssetsResponse, compareMinor(), ItemView(), OfferSort, allowlistedOrigin(), buildMediaFrames(), findPublished3dArtifact(), ListingGallery() (+35 more)

### Community 8 - "Shell da Conta"
Cohesion: 0.10
Nodes (37): AccountContext, AccountProvider(), useAccountContext(), AccountFrame(), AccountShell(), NavigationItem, personalLinks, RailContent() (+29 more)

### Community 9 - "Estado de Checkout"
Cohesion: 0.06
Nodes (47): addMinorUnits(), AmountConsistency, asRecord(), CheckoutAction, CheckoutActionCode, CheckoutBlock, CheckoutBlockCode, CheckoutOrderSummary (+39 more)

### Community 10 - "Retencao e Consentimento"
Cohesion: 0.05
Nodes (48): absentConsentStatus(), ConsentLedgerRecord, ConsentServicePort, ConsentState, consentStateSchema, ConsentStatusRecord, ConsentTargetPortInput, createWatchlistEntryBodySchema (+40 more)

### Community 11 - "Contratos de Conta"
Cohesion: 0.05
Nodes (41): CreateSellerAccountBody, createSellerAccountBodySchema, LoginBody, loginBodySchema, RegisterUserBody, registerUserBodySchema, registerUserResponseSchema, sellerAccountIdSchema (+33 more)

### Community 12 - "Login e Cadastro"
Cohesion: 0.12
Nodes (28): LoginPage(), metadata, AccountContextValue, LoginForm(), ResourceError(), FormErrors, requestMessage(), formatUpdatedAt() (+20 more)

### Community 13 - "Compras do Comprador"
Cohesion: 0.07
Nodes (36): metadata, PurchaseDetailView(), PurchaseStatusSummary(), snapshotTitle(), PurchasesView(), NotificationPage, danger, readableStatus() (+28 more)

### Community 14 - "Comunidade 14"
Cohesion: 0.05
Nodes (43): BRAND_NAME, ^build, CORS_ALLOWED_ORIGINS, coverage/**, DATABASE_URL, dist/**, MIDAS_API_URL, !.next/cache/** (+35 more)

### Community 15 - "Comunidade 15"
Cohesion: 0.16
Nodes (19): assertPositiveAmount(), assertProviderMatchesPayment(), conflict(), Currency, FinanceService, forbidden(), hashIdempotencyKey(), normalizeCountryCode() (+11 more)

### Community 16 - "Comunidade 16"
Cohesion: 0.05
Nodes (38): devDependencies, jsdom, react, react-dom, @testing-library/jest-dom, @testing-library/react, @types/react, @types/react-dom (+30 more)

### Community 17 - "Comunidade 17"
Cohesion: 0.05
Nodes (36): dependencies, drizzle-orm, @midas/administration-audit, @midas/database, @midas/eventing, @midas/iam, @midas/identity, @midas/kernel (+28 more)

### Community 18 - "Comunidade 18"
Cohesion: 0.05
Nodes (36): dependencies, drizzle-orm, @midas/administration-audit, @midas/catalog, @midas/database, @midas/eventing, @midas/identity, @midas/kernel (+28 more)

### Community 19 - "Comunidade 19"
Cohesion: 0.06
Nodes (13): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+5 more)

### Community 20 - "Comunidade 20"
Cohesion: 0.11
Nodes (27): actionErrorMessage(), payoutCapabilityReasons, ScopedPayouts(), actionErrorMessage(), AdminPaymentsView(), CaseStatusFilter, Decision, actionErrorMessage() (+19 more)

### Community 21 - "Comunidade 21"
Cohesion: 0.06
Nodes (35): dependencies, fastify, @midas/contracts, @midas/database, @midas/eventing, @midas/kernel, zod, devDependencies (+27 more)

### Community 22 - "Comunidade 22"
Cohesion: 0.06
Nodes (34): dependencies, drizzle-orm, @midas/administration-audit, @midas/database, @midas/eventing, @midas/iam, @midas/identity, @midas/kernel (+26 more)

### Community 23 - "Comunidade 23"
Cohesion: 0.10
Nodes (23): database, database, migrationDirectories, duplicates, names, ordered, checkDatabase(), createDatabase() (+15 more)

### Community 24 - "Comunidade 24"
Cohesion: 0.11
Nodes (20): provisionVerifiedUser(), requireVerificationToken(), provisionUser(), provisionUser(), authRateLimits, credentials, emailVerificationChallenges, identitySchema (+12 more)

### Community 25 - "Comunidade 25"
Cohesion: 0.08
Nodes (29): actionsAllowedInPhase(), disputeActionDescriptions, DisputeActionEvaluation, DisputeDeadline, DisputeDecision, disputeOutcomeLabels, disputeRoleLabels, disputeWindowStateLabels (+21 more)

### Community 26 - "Comunidade 26"
Cohesion: 0.08
Nodes (32): actionPhaseGate, allowedDisputeActions(), deadlineState(), denied(), DisputeAction, disputeActionMatrix(), DisputeDeadlineState, DisputeEventActor (+24 more)

### Community 27 - "Comunidade 27"
Cohesion: 0.06
Nodes (32): dependencies, drizzle-orm, @midas/administration-audit, @midas/database, @midas/eventing, @midas/identity, @midas/kernel, devDependencies (+24 more)

### Community 28 - "Comunidade 28"
Cohesion: 0.06
Nodes (32): dependencies, drizzle-orm, @midas/administration-audit, @midas/database, @midas/eventing, @midas/iam, @midas/identity, @midas/kernel (+24 more)

### Community 29 - "Comunidade 29"
Cohesion: 0.15
Nodes (26): ExecutionSection(), RefundDetailView(), isRefundRequestStatus(), optionalMinor(), optionalString(), optionalTimestamp(), parseAttempts(), parseRefundRequestDetail() (+18 more)

### Community 30 - "Comunidade 30"
Cohesion: 0.06
Nodes (31): dependencies, drizzle-orm, pg, devDependencies, tsx, @types/node, @types/pg, typescript (+23 more)

### Community 31 - "Comunidade 31"
Cohesion: 0.09
Nodes (14): metadata, metadata, viewport, rotations, canUseWebGl(), SceneErrorBoundary, ViewerView, viewPositions (+6 more)

### Community 32 - "Comunidade 32"
Cohesion: 0.10
Nodes (23): metadata, leaderboardHalfPoints, LeaderboardResponse, TIEBREAK_ORDER, ACCOUNT_LEVEL_LADDER, AccountLevelCode, brl(), ladderEntries (+15 more)

### Community 33 - "Comunidade 33"
Cohesion: 0.06
Nodes (30): dependencies, drizzle-orm, @midas/database, @midas/kernel, pg, devDependencies, @types/node, @types/pg (+22 more)

### Community 34 - "Comunidade 34"
Cohesion: 0.08
Nodes (18): ActorContext, createSecretToken(), hashPassword(), hashSecretToken(), passwordHashOptions, verifyPassword(), createPublicId(), createUuidV7() (+10 more)

### Community 35 - "Comunidade 35"
Cohesion: 0.10
Nodes (17): emailDeliveryUnavailable(), SmtpVerificationDelivery, UnavailableVerificationDelivery, ApiConfig, environmentSchema, loadApiConfig(), optionalNonEmpty, config (+9 more)

### Community 36 - "Comunidade 36"
Cohesion: 0.07
Nodes (29): dependencies, fastify, @midas/database, zod, devDependencies, tsx, @types/node, typescript (+21 more)

### Community 37 - "Comunidade 37"
Cohesion: 0.13
Nodes (27): addRates(), asRecord(), centsToPriceInput(), computeFeeBreakdown(), createEmptyDraft(), CreateListingRequestBody, DELIVERY_METHODS, DeliveryMethod (+19 more)

### Community 38 - "Comunidade 38"
Cohesion: 0.11
Nodes (27): CreatePaymentInput, PaymentRow, paymentView(), PayoutRow, RegisterOrderFinancialStateInput, ResolutionDecisionInput, balanceLots, financeSchema (+19 more)

### Community 39 - "Comunidade 39"
Cohesion: 0.07
Nodes (28): dependencies, drizzle-orm, @midas/administration-audit, @midas/database, @midas/eventing, @midas/kernel, devDependencies, typescript (+20 more)

### Community 40 - "Comunidade 40"
Cohesion: 0.10
Nodes (24): buildConsentMutationBody(), cellKey(), channelLabels, CommunicationPreferences, CONSENT_CHANNELS, CONSENT_PURPOSES, ConsentChange, ConsentChannel (+16 more)

### Community 41 - "Comunidade 41"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 42 - "Comunidade 42"
Cohesion: 0.14
Nodes (23): ConsentEvidenceInput, ConsentStatus, ConsentTarget, GrantConsentInput, RevokeConsentInput, ConsentState, ReminderChannel, ReminderFrequencyFact (+15 more)

### Community 43 - "Comunidade 43"
Cohesion: 0.10
Nodes (20): LandingPrinciples(), principles, splitKicker(), chapters, LandingStory(), IntersectionObserverStub, AwarenessLevel, Block (+12 more)

### Community 44 - "Comunidade 44"
Cohesion: 0.12
Nodes (21): PublicCatalogItemPage, PublicListing, PublicSellerSummary, isRecommendationAllowed(), RECOMMENDATION_DENIED_PREFIXES, RECOMMENDATION_SLOTS, RecommendationRail(), RecommendationSlot (+13 more)

### Community 45 - "Comunidade 45"
Cohesion: 0.15
Nodes (20): PublicListingPage, listingsPath(), monogram(), SellerIdentityHeader(), SellerProfile(), SellerProfileView(), containsPersonalData(), DerivedFact (+12 more)

### Community 46 - "Comunidade 46"
Cohesion: 0.14
Nodes (26): assertCompensationReason(), assertContribution(), assertIdentifier(), assertNegativeMinor(), assignReplayAccountLevel(), CompensatingContribution, CompensationReason, compensationReasons (+18 more)

### Community 47 - "Comunidade 47"
Cohesion: 0.14
Nodes (24): allow(), evaluateConsentState(), hourInTimeZone(), isMarketingPurpose(), isPullChannel(), isTransactionalPurpose(), isWithinQuietHours(), QUIET_HOURS_WINDOW (+16 more)

### Community 48 - "Comunidade 48"
Cohesion: 0.07
Nodes (27): scripts, build, check, db:check, db:generate, db:migrate, dev, generate:screens (+19 more)

### Community 49 - "Comunidade 49"
Cohesion: 0.08
Nodes (25): ES2023, compilerOptions, allowJs, allowSyntheticDefaultImports, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes (+17 more)

### Community 50 - "Comunidade 50"
Cohesion: 0.08
Nodes (24): ajv, ajv-formats, dependencies, ajv, ajv-formats, zod, devDependencies, typescript (+16 more)

### Community 51 - "Comunidade 51"
Cohesion: 0.08
Nodes (24): dependencies, drizzle-orm, @midas/database, @midas/kernel, devDependencies, typescript, vitest, exports (+16 more)

### Community 52 - "Comunidade 52"
Cohesion: 0.08
Nodes (24): @node-rs/argon2, dependencies, @node-rs/argon2, zod, devDependencies, @types/node, typescript, vitest (+16 more)

### Community 53 - "Comunidade 53"
Cohesion: 0.13
Nodes (16): metadata, metadata, assetTypes, CatalogAdminView(), isPendingApproval(), itemTypes, messageFrom(), normalizeCatalogSlug() (+8 more)

### Community 54 - "Comunidade 54"
Cohesion: 0.11
Nodes (9): metadata, metadata, metadata, metadata, metadata, metadata, metadata, ListingPageView() (+1 more)

### Community 55 - "Comunidade 55"
Cohesion: 0.15
Nodes (20): STATUS_LABELS, statusTone(), StepPublish(), StepPublishProps, SellerListingWithPlan, priceInputToMinor(), stepTitle(), WizardBlocker (+12 more)

### Community 56 - "Comunidade 56"
Cohesion: 0.16
Nodes (22): finance.assert_journal_balanced(), finance.balance_lots, finance.hold_state_transitions, finance.holds, finance.ledger_accounts, finance.ledger_entries, finance.ledger_journals, finance.order_financial_states (+14 more)

### Community 57 - "Comunidade 57"
Cohesion: 0.13
Nodes (20): metadata, browserStorage(), findOptIn(), CHANNEL_NAMES, channelsFor(), comparePrice(), FavoriteCard(), FavoriteState (+12 more)

### Community 58 - "Comunidade 58"
Cohesion: 0.14
Nodes (20): applyRate(), buildFeeBreakdown(), CHECKOUT_CAPABILITY, DecimalRate, DetailListing, DetailListingPlan, FeeBreakdown, FeeLine (+12 more)

### Community 59 - "Comunidade 59"
Cohesion: 0.09
Nodes (22): dependencies, drizzle-orm, @midas/kernel, devDependencies, typescript, vitest, exports, drizzle-orm (+14 more)

### Community 60 - "Comunidade 60"
Cohesion: 0.18
Nodes (15): PageHeader(), DevicesView(), pendingCapabilities, SecurityView(), readSessionList(), SessionFact, sessionSignalsAbsent, sessionState (+7 more)

### Community 61 - "Comunidade 61"
Cohesion: 0.11
Nodes (15): calculateHoldEligibleAt(), evaluateHoldRelease(), HoldReleaseDecision, HoldReleaseFacts, PayoutCapabilityError, PayoutExecutionCapability, PayoutExecutionCapabilityStatus, PayoutExecutionContext (+7 more)

### Community 63 - "Comunidade 63"
Cohesion: 0.11
Nodes (19): disputeActionLabels, DisputeDenialReason, DisputeRole, evidenceAnalysisLabels, evidenceFileRejectionLabels, evidenceHiddenExplanations, evidenceOwnerLabels, EvidenceScopeSummary (+11 more)

### Community 64 - "Comunidade 64"
Cohesion: 0.10
Nodes (21): dependencies, @fontsource/big-shoulders-display, @fontsource-variable/ibm-plex-sans, gsap, lucide-react, @midas/ui, next, react (+13 more)

### Community 65 - "Comunidade 65"
Cohesion: 0.10
Nodes (21): devDependencies, jsdom, tailwindcss, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @types/node, @types/react (+13 more)

### Community 66 - "Comunidade 66"
Cohesion: 0.10
Nodes (20): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+12 more)

### Community 67 - "Comunidade 67"
Cohesion: 0.18
Nodes (19): clearStoredDraft(), LAUNCHER_STEPS, LookupState, problemMessage(), problemReference(), readStoredDraft(), SellerListingsPage, useSellerListingLookup() (+11 more)

### Community 68 - "Comunidade 68"
Cohesion: 0.12
Nodes (8): PaymentProviderAdapter, database, finance, identity, required(), safeEqual(), sellers, SignedProviderAdapter

### Community 69 - "Comunidade 69"
Cohesion: 0.17
Nodes (7): assertRetentionActor(), buildConsentEvidence(), ConsentService, NOW, toConsentFact(), NotificationRow, ReminderConsentRow

### Community 70 - "Comunidade 70"
Cohesion: 0.11
Nodes (3): sectionNames, getScreenContract(), ScreenContract

### Community 71 - "Comunidade 71"
Cohesion: 0.14
Nodes (8): metadata, BrandWordmark(), links, PublicNav(), adminLinks, masterLinks, OperationsShell(), SellerAccountForm()

### Community 72 - "Comunidade 72"
Cohesion: 0.25
Nodes (15): DELIVERY_COPY, StepDelivery(), StepItem(), WizardField(), WizardFieldProps, WizardNote(), StepPricing(), PROOF_COPY (+7 more)

### Community 73 - "Comunidade 73"
Cohesion: 0.18
Nodes (12): formatNotificationDate(), kindLabels, NotificationItem(), NotificationItemModel, NotificationItemProps, notificationKindLabel(), safeNotificationHref(), notification (+4 more)

### Community 74 - "Comunidade 74"
Cohesion: 0.16
Nodes (12): outboxPublisherCapability(), OutboxPublisherConfiguration, buildOutboxTransportEvent(), publicAggregateId(), publishOutboxEvent(), app, config, database (+4 more)

### Community 75 - "Comunidade 75"
Cohesion: 0.11
Nodes (17): devDependencies, typescript, vitest, exports, typescript, vitest, name, private (+9 more)

### Community 76 - "Comunidade 76"
Cohesion: 0.14
Nodes (14): calculateReplayLeaderboardScore(), ContributionInvariantError, decidePremium10BadgeAward(), IdempotencyConflictError, PREMIUM_10_BADGE_CODE, ProgressionContribution, calculateLeaderboardScore(), formatHalfPoints() (+6 more)

### Community 77 - "Comunidade 77"
Cohesion: 0.22
Nodes (7): ReminderSubjectFact, ReminderSuppressionReason, conflict(), invalid(), notFound(), ReminderService, ReminderDispatchRow

### Community 78 - "Comunidade 78"
Cohesion: 0.12
Nodes (17): dependencies, fastify, @midas/administration-audit, @midas/database, @midas/eventing, @midas/identity, @midas/sellers, nodemailer (+9 more)

### Community 79 - "Comunidade 79"
Cohesion: 0.20
Nodes (16): addCartLineBodySchema, cancelOrderBodySchema, confirmDeliveryBodySchema, mergeCartBodySchema, orderStatusSchema, placeOrderBodySchema, quantitySchema, registerOrderRoutes() (+8 more)

### Community 80 - "Comunidade 80"
Cohesion: 0.12
Nodes (16): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+8 more)

### Community 81 - "Comunidade 81"
Cohesion: 0.18
Nodes (13): formatMinorAmount(), MinorMoney(), formatPoints(), LEADERBOARD_FORMULA, LeaderboardRow, LeaderboardSeasonRef, LeaderboardTable(), LeaderboardUnavailable() (+5 more)

### Community 82 - "Comunidade 82"
Cohesion: 0.21
Nodes (9): conflict(), invalid(), notFound(), SaveCartSnapshotInput, SAVED_CART_STATUSES, SavedCartPage, SavedCartService, SavedCartStatus (+1 more)

### Community 83 - "Comunidade 83"
Cohesion: 0.23
Nodes (9): buildApi(), BuildApiOptions, normalizeError(), RawBodyRequest, requireCsrf(), clearSessionCookie(), createSessionCookie(), parseCookie() (+1 more)

### Community 84 - "Comunidade 84"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+7 more)

### Community 85 - "Comunidade 85"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+7 more)

### Community 86 - "Comunidade 86"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+7 more)

### Community 87 - "Comunidade 87"
Cohesion: 0.17
Nodes (3): PayoutExecutionAdapter, PayoutExecutionCapabilityRegistry, TestPayoutAdapter

### Community 88 - "Comunidade 88"
Cohesion: 0.23
Nodes (15): assertBasisPoints(), assertExposurePriority(), assertListingCommercialSnapshot(), assertPlanCode(), assertQueuePriority(), createListingPlanPolicyVersion(), exposurePriorities, ExposurePriority (+7 more)

### Community 89 - "Comunidade 89"
Cohesion: 0.12
Nodes (16): required, actorUserId, aggregateId, aggregateType, aggregateVersion, causationId, correlationId, dataClassification (+8 more)

### Community 90 - "Comunidade 90"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+7 more)

### Community 91 - "Comunidade 91"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+7 more)

### Community 92 - "Comunidade 92"
Cohesion: 0.16
Nodes (7): metadata, metadata, metadata, metadata, WizardLauncher(), SellerWorkspace(), SellerWorkspaceFallback()

### Community 93 - "Comunidade 93"
Cohesion: 0.24
Nodes (14): currencyCode(), FavoriteDraft, FavoritesReadResult, FavoritesWriteResult, isoTimestamp(), isRecord(), minorUnits(), nonEmptyString() (+6 more)

### Community 94 - "Comunidade 94"
Cohesion: 0.19
Nodes (10): clearWatchOptIn(), isFavoriteOnDevice(), isQuotaError(), QUOTA_ERROR_NAMES, readFavorites(), removeFavorite(), removeFavoriteFromDevice(), saveFavoriteToDevice() (+2 more)

### Community 95 - "Comunidade 95"
Cohesion: 0.13
Nodes (15): eslint, devDependencies, eslint, @playwright/test, turbo, typescript, typescript-eslint, vitest (+7 more)

### Community 96 - "Comunidade 96"
Cohesion: 0.13
Nodes (14): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+6 more)

### Community 97 - "Comunidade 97"
Cohesion: 0.27
Nodes (7): isUnknownRecord(), MercadoPagoPaymentAdapter, toDateInput(), toFiniteNumber(), toPaymentReference(), toStringValue(), UnknownRecord

### Community 98 - "Comunidade 98"
Cohesion: 0.22
Nodes (10): checkOrderTotals(), findPaymentById(), stepIndexOf(), CheckoutView(), CheckoutViewProps, toneToBadge, PolicyAcceptance(), PolicyAcceptanceProps (+2 more)

### Community 99 - "Comunidade 99"
Cohesion: 0.19
Nodes (12): disputeActions, DisputeDenialGuidance, disputeDenialReasons, disputeRoles, DisputeWindow, evaluateEvidenceAccess(), summarizeEvidenceScope(), decision (+4 more)

### Community 100 - "Comunidade 100"
Cohesion: 0.23
Nodes (10): AvailabilityFilter, CatalogResults(), compareMinorAmounts(), comparePublishedAt(), MarketView(), searchableListing(), SortMode, ochpochListing (+2 more)

### Community 101 - "Comunidade 101"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 102 - "Comunidade 102"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 103 - "Comunidade 103"
Cohesion: 0.18
Nodes (8): appendOutboxEvent(), LeasedOutboxEvent, OutboxEventInput, recordInboxOnce(), eventingSchema, idempotencyRecords, inboxReceipts, outboxEvents

### Community 104 - "Comunidade 104"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 105 - "Comunidade 105"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 106 - "Comunidade 106"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 107 - "Comunidade 107"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 108 - "Comunidade 108"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 109 - "Comunidade 109"
Cohesion: 0.18
Nodes (12): ReminderDecision, CreateNotificationInput, EnqueueReminderInput, EnqueueReminderResult, NOTIFICATION_KINDS, NOTIFICATION_PURPOSE_BY_KIND, NotificationKind, notifications (+4 more)

### Community 110 - "Comunidade 110"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 111 - "Comunidade 111"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declaration, declarationMap, module, moduleResolution, outDir, rootDir (+5 more)

### Community 112 - "Comunidade 112"
Cohesion: 0.27
Nodes (12): approveAssetBodySchema, createAssetBodySchema, createCatalogItemBodySchema, createListingBodySchema, registerCatalogRoutes(), RegisterCatalogRoutesOptions, serializeAsset(), serializeCatalogItem() (+4 more)

### Community 113 - "Comunidade 113"
Cohesion: 0.22
Nodes (8): BodyTooLargeError, GET, proxy(), PUT, readLimitedBody(), SAFE_REQUEST_HEADERS, ALLOWED_METHODS, validateProxyRequest()

### Community 114 - "Comunidade 114"
Cohesion: 0.38
Nodes (13): blocker(), blockersForStep(), buildCreateListingBody(), deliveryBlockers(), evaluateWizard(), FeeBreakdownInput, itemBlockers(), normalizeSlug() (+5 more)

### Community 115 - "Comunidade 115"
Cohesion: 0.17
Nodes (9): AuthorizationDecision, authorizeSellerAction(), SellerAuthorizationFacts, iamSchema, permissions, rolePermissions, roles, userRoleAssignments (+1 more)

### Community 116 - "Comunidade 116"
Cohesion: 0.27
Nodes (4): WatchlistEntryRow, invalid(), notFound(), WatchlistService

### Community 117 - "Comunidade 117"
Cohesion: 0.17
Nodes (10): appDirectory, matchingPages(), pageFiles, results, root, routeExpression(), screenMapPath, screens (+2 more)

### Community 118 - "Comunidade 118"
Cohesion: 0.18
Nodes (6): cleanupCatalogFixture(), cleanupPendingFixtures(), database, fixtureSuffixes, identity, sellers

### Community 119 - "Comunidade 119"
Cohesion: 0.32
Nodes (8): AccountLevel, AccountLevelDefinition, assignAccountLevel(), createAccountLevelPolicyVersion(), INITIAL_ACCOUNT_LEVEL_POLICY, orderedLevels, assertMinorBrl(), freezeArray()

### Community 120 - "Comunidade 120"
Cohesion: 0.17
Nodes (12): minLength, type, minimum, type, type, properties, aggregateType, aggregateVersion (+4 more)

### Community 121 - "Comunidade 121"
Cohesion: 0.24
Nodes (9): ajv, assertOutboxTransportEvent(), EventContractError, eventSchemas, formatValidationErrors(), OutboxTransportEvent, readEventType(), registeredOutboxEventTypes() (+1 more)

### Community 122 - "Comunidade 122"
Cohesion: 0.18
Nodes (11): devDependencies, tsx, @types/node, @types/nodemailer, typescript, vitest, tsx, @types/node (+3 more)

### Community 123 - "Comunidade 123"
Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, migrate, start, start:test, test (+3 more)

### Community 124 - "Comunidade 124"
Cohesion: 0.31
Nodes (5): isUnknownRecord(), StripePaymentAdapter, toFiniteNumber(), toStringValue(), UnknownRecord

### Community 125 - "Comunidade 125"
Cohesion: 0.36
Nodes (9): registerFinanceRoutes(), RegisterFinanceRoutesOptions, requireIdempotencyKey(), serializePayment(), serializePayout(), serializePayoutList(), serializeResolution(), actorContext() (+1 more)

### Community 126 - "Comunidade 126"
Cohesion: 0.33
Nodes (6): OverviewView(), Greeting, greetingFor(), normalizeNick(), AccountOverview, safeInternalHref()

### Community 127 - "Comunidade 127"
Cohesion: 0.22
Nodes (10): disputeEventActorLabels, DisputePhase, disputePhaseIndex(), disputePhaseLabels, disputePhases, disputePhaseSummaries, DisputePhaseTrack(), stepState() (+2 more)

### Community 128 - "Comunidade 128"
Cohesion: 0.33
Nodes (8): checkWorkspace(), extension(), findCycles(), listFiles(), main(), moduleName(), sourceExtensions, workspacePackages()

### Community 129 - "Comunidade 129"
Cohesion: 0.20
Nodes (7): appDirectory, contractOutput, contracts, exists(), root, screenMapPath, writeGeneratedPage()

### Community 130 - "Comunidade 130"
Cohesion: 0.24
Nodes (5): metadata, metadata, AuthShell(), RegistrationForm(), VerificationForm()

### Community 131 - "Comunidade 131"
Cohesion: 0.36
Nodes (8): DiscountFrame, DiscountFrameInput, DiscountFrameKind, frameBundleSavings(), frameDiscount(), NoDiscountReason, noFrame(), parseMinor()

### Community 132 - "Comunidade 132"
Cohesion: 0.20
Nodes (10): scripts, build, dev, lint, start, start:test, test, test:integration (+2 more)

### Community 133 - "Comunidade 133"
Cohesion: 0.20
Nodes (9): description, engines, node, pnpm, license, name, packageManager, private (+1 more)

### Community 134 - "Comunidade 134"
Cohesion: 0.24
Nodes (10): pattern, type, type, actorUserId, causationId, sellerAccountId, pattern, type (+2 more)

### Community 135 - "Comunidade 135"
Cohesion: 0.20
Nodes (8): capabilityRequirements, duplicateOperations, errors, operationIds, rfIds, rnfIds, root, screenIds

### Community 136 - "Comunidade 136"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, files, node, ../../../tsconfig.base.json, ../src/retention-routes.ts

### Community 137 - "Comunidade 137"
Cohesion: 0.42
Nodes (5): robots(), sitemap(), crawlPolicy(), privateRoutePrefixes, publicSiteUrl()

### Community 138 - "Comunidade 138"
Cohesion: 0.25
Nodes (4): canUseWebGl(), HeroModelCanvas, LandingModel(), ModelErrorBoundary

### Community 139 - "Comunidade 139"
Cohesion: 0.47
Nodes (8): catalog.catalog_assets, catalog.catalog_items, catalog.categories, catalog.item_categories, catalog.listing_commercial_snapshots, catalog.listing_plans, catalog.listing_revisions, catalog.listings

### Community 140 - "Comunidade 140"
Cohesion: 0.42
Nodes (5): sellerAccounts, sellerMembershipGrants, sellerMemberships, sellersSchema, CreateSellerAccountInput

### Community 141 - "Comunidade 141"
Cohesion: 0.32
Nodes (4): realtimeCapability, app, config, database

### Community 142 - "Comunidade 142"
Cohesion: 0.32
Nodes (6): input(), StoredFavorite, listingBody(), ListingFixture, problem(), stubApi()

### Community 144 - "Comunidade 144"
Cohesion: 0.32
Nodes (7): WatchChannel, WatchOptIn, channelActiveLabels, channelLabels, WatchSyncMode, WatchToggle(), WatchToggleProps

### Community 145 - "Comunidade 145"
Cohesion: 0.36
Nodes (4): appendAuditEvent(), AuditEventInput, auditEvents, auditSchema

### Community 147 - "Comunidade 147"
Cohesion: 0.36
Nodes (4): formatMinorUnits(), Money(), MoneyProps, StatusBadgeProps

### Community 149 - "Comunidade 149"
Cohesion: 0.25
Nodes (7): declaredLength, json, jsonLength, jsonType, path, summary, version

### Community 150 - "Comunidade 150"
Cohesion: 0.48
Nodes (6): orders.cart_lines, orders.carts, orders.deliveries, orders.order_events, orders.order_items, orders.orders

### Community 151 - "Comunidade 151"
Cohesion: 0.40
Nodes (4): metadata, counterpartRole(), disputeDeadlines(), DisputeView()

### Community 152 - "Comunidade 152"
Cohesion: 0.47
Nodes (6): mergeEntry(), mergeFavorites(), mergeWatch(), sortFavorites(), timeOf(), upsertFavorite()

### Community 153 - "Comunidade 153"
Cohesion: 0.53
Nodes (5): identity.auth_rate_limits, identity.credentials, identity.email_verification_challenges, identity.sessions, identity.users

### Community 154 - "Comunidade 154"
Cohesion: 0.33
Nodes (5): retention.notifications, retention.reminder_consents, retention.reminder_dispatches, retention.saved_carts, retention.watchlist_entries

### Community 155 - "Comunidade 155"
Cohesion: 0.67
Nodes (5): seller_membership_grants_tenant_trigger, sellers.enforce_membership_grant_tenant(), sellers.seller_accounts, sellers.seller_membership_grants, sellers.seller_memberships

### Community 156 - "Comunidade 156"
Cohesion: 0.33
Nodes (5): additionalProperties, $id, $schema, title, type

### Community 157 - "Comunidade 157"
Cohesion: 0.33
Nodes (6): enum, dataClassification, CONFIDENTIAL, FINANCIAL, INTERNAL, PUBLIC

### Community 158 - "Comunidade 158"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 159 - "Comunidade 159"
Cohesion: 0.40
Nodes (5): DisputeEvent, DisputeEvidenceItem, DisputeSnapshot, EvidenceConstraints, DisputeResource

### Community 160 - "Comunidade 160"
Cohesion: 0.70
Nodes (4): initScrollReveal(), prefersReducedMotion(), useHeroIntro(), useScrollReveal()

### Community 161 - "Comunidade 161"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 162 - "Comunidade 162"
Cohesion: 0.40
Nodes (4): child, nextCli, port, require

### Community 163 - "Comunidade 163"
Cohesion: 0.40
Nodes (4): @fontsource/big-shoulders-display/700, @fontsource/big-shoulders-display/800, @fontsource/ibm-plex-mono/400, @fontsource/ibm-plex-mono/600

### Community 164 - "Comunidade 164"
Cohesion: 0.70
Nodes (4): iam.permissions, iam.role_permissions, iam.roles, iam.user_role_assignments

### Community 166 - "Comunidade 166"
Cohesion: 0.40
Nodes (4): createLeaderboardPolicyVersion(), INITIAL_LEADERBOARD_POLICY, LeaderboardPolicyVersion, LeaderboardScore

### Community 167 - "Comunidade 167"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 168 - "Comunidade 168"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 169 - "Comunidade 169"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 170 - "Comunidade 170"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 171 - "Comunidade 171"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 172 - "Comunidade 172"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 173 - "Comunidade 173"
Cohesion: 0.40
Nodes (4): allOf, $id, $schema, title

### Community 174 - "Comunidade 174"
Cohesion: 0.40
Nodes (3): apiPort, webGlLaunchOptions, webPort

### Community 183 - "Comunidade 183"
Cohesion: 0.67
Nodes (3): audit.audit_events, audit_events_append_only_trigger, audit.reject_audit_mutation()

### Community 184 - "Comunidade 184"
Cohesion: 0.50
Nodes (3): eventing.idempotency_records, eventing.inbox_receipts, eventing.outbox_events

### Community 185 - "Comunidade 185"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 186 - "Comunidade 186"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 187 - "Comunidade 187"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 188 - "Comunidade 188"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 189 - "Comunidade 189"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 190 - "Comunidade 190"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 191 - "Comunidade 191"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 192 - "Comunidade 192"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 193 - "Comunidade 193"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 194 - "Comunidade 194"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 195 - "Comunidade 195"
Cohesion: 0.50
Nodes (3): allOf, $id, $schema

### Community 196 - "Comunidade 196"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, aggregateId

### Community 197 - "Comunidade 197"
Cohesion: 0.50
Nodes (3): ButtonProps, ButtonSize, ButtonVariant

### Community 202 - "Comunidade 202"
Cohesion: 0.67
Nodes (3): minLength, type, correlationId

### Community 203 - "Comunidade 203"
Cohesion: 0.67
Nodes (3): pattern, type, eventId

### Community 204 - "Comunidade 204"
Cohesion: 0.67
Nodes (3): pattern, type, eventType

### Community 205 - "Comunidade 205"
Cohesion: 0.67
Nodes (3): format, type, occurredAt

### Community 206 - "Comunidade 206"
Cohesion: 0.67
Nodes (3): schemaVersion, minimum, type

### Community 207 - "Comunidade 207"
Cohesion: 0.67
Nodes (3): sourceModule, pattern, type

## Knowledge Gaps
- **1385 isolated node(s):** `extends`, `../../../tsconfig.base.json`, `noEmit`, `node`, `../src/retention-routes.ts` (+1380 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `registerRetentionRoutes()` connect `Retencao e Consentimento` to `Detalhe de Venda`, `Comunidade 83`, `Comunidade 125`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `readAt()` connect `Detalhe de Venda` to `Retencao e Consentimento`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `buildApi()` connect `Comunidade 83` to `Comunidade 34`, `Comunidade 35`, `Retencao e Consentimento`, `Comunidade 79`, `Comunidade 112`, `Comunidade 118`, `Comunidade 24`, `Comunidade 125`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **What connects `extends`, `../../../tsconfig.base.json`, `noEmit` to the rest of the system?**
  _1385 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Autorizacao de Pedido` be split into smaller, more focused modules?**
  _Cohesion score 0.054671382257589156 - nodes in this community are weakly interconnected._
- **Should `Carrinho Multivendedor` be split into smaller, more focused modules?**
  _Cohesion score 0.07746478873239436 - nodes in this community are weakly interconnected._
- **Should `Assets do Catalogo` be split into smaller, more focused modules?**
  _Cohesion score 0.06994047619047619 - nodes in this community are weakly interconnected._