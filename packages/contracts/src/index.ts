export {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  apiErrorBodySchema,
  apiErrorCodeSchema,
  fieldErrorsSchema,
  isCommonErrorCode,
  parseDto,
  publicErrorMessage,
  sanitizeFieldErrors,
  validationFailure
} from "./common/api-error.js";
export type {
  ApiErrorBody,
  CommonErrorCode,
  FieldErrors,
  ParseDtoResult,
  ValidationFailure
} from "./common/api-error.js";
export {
  apiErrorResponseSchema,
  apiListSchema,
  apiMetaSchema,
  apiSuccessSchema,
  createErrorResponse,
  healthResponseSchema,
  healthStatusSchema,
  pageMetaSchema
} from "./common/api-response.js";
export type {
  ApiErrorResponse,
  ApiMeta,
  HealthResponse,
  HealthStatus,
  PageMeta
} from "./common/api-response.js";
export {
  DEFAULT_PAGE_LIMIT,
  IDEMPOTENCY_KEY_HEADER,
  MAX_PAGE_LIMIT,
  cursorSchema,
  entityIdSchema,
  idempotencyKeySchema,
  httpsUrlSchema,
  isHttpsUrl,
  localDateQuerySchema,
  localDateSchema,
  localTimeSchema,
  localeSchema,
  pageLimitQuerySchema,
  pageQuerySchema,
  requestIdSchema,
  timeZoneSchema,
  utcDateTimeSchema
} from "./common/primitives.js";
export type { EntityId, HttpsUrl, LocalDate, PageQuery, UtcDateTime } from "./common/primitives.js";
export {
  CSRF_HEADER,
  sessionResponseSchema,
  sessionSchema,
  signOutResponseSchema,
  signOutSchema
} from "./auth/session.js";
export type { Session } from "./auth/session.js";
export {
  accountDeletionResponseSchema,
  accountDeletionSchema,
  avatarUrlSchema,
  displayNameSchema,
  profilePatchSchema,
  profileResponseSchema,
  profileSchema,
  themeSchema,
  timeFormatSchema
} from "./auth/profile.js";
export type { Profile, ProfilePatch, ThemePreference, TimeFormat } from "./auth/profile.js";
export {
  SECTION_ERROR_MESSAGE,
  calendarSectionSchema,
  dashboardResponseSchema,
  dashboardSchema,
  datetimeSectionSchema,
  externalSectionSchema,
  newsSectionSchema,
  routinesSectionSchema,
  sectionErrorSchema,
  timerSectionSchema,
  weatherSectionSchema,
  widgetsSectionSchema
} from "./dashboard/dashboard.js";
export type {
  CalendarSection,
  Dashboard,
  ExternalSection,
  NewsSection,
  WeatherSection
} from "./dashboard/dashboard.js";
export {
  calendarDayResponseSchema,
  calendarDaySchema,
  calendarEventSchema,
  calendarEventStatusSchema
} from "./calendar/events.js";
export type { CalendarDay, CalendarEvent } from "./calendar/events.js";
export {
  googleConnectResponseSchema,
  googleConnectSchema,
  integrationDeletionResponseSchema,
  integrationDeletionSchema,
  integrationListResponseSchema,
  integrationListSchema,
  integrationStatusSchema,
  integrationSummarySchema,
  integrationTypeSchema,
  telegramLinkResponseSchema,
  telegramLinkSchema
} from "./integrations/integrations.js";
export type {
  IntegrationList,
  IntegrationStatus,
  IntegrationSummary,
  IntegrationType
} from "./integrations/integrations.js";
export {
  NEWS_TOPICS,
  newsFeedSchema,
  newsItemSchema,
  newsLanguageSchema,
  newsQuerySchema,
  newsResponseSchema,
  newsTopicSchema
} from "./news/news.js";
export type { NewsFeed, NewsItem, NewsQuery, NewsTopic } from "./news/news.js";
export {
  WEATHER_SCENES,
  placeQuerySchema,
  weatherHourSchema,
  weatherLocationInputSchema,
  weatherLocationResponseSchema,
  weatherLocationStateSchema,
  weatherPlaceSchema,
  weatherPlacesResponseSchema,
  weatherPlacesSchema,
  weatherQuerySchema,
  weatherResponseSchema,
  weatherSnapshotSchema
} from "./weather/weather.js";
export type {
  PlaceQuery,
  WeatherLocationInput,
  WeatherPlace,
  WeatherQuery,
  WeatherScene,
  WeatherSnapshot
} from "./weather/weather.js";
export {
  RESTORE_EXPIRED,
  recurrenceSchema,
  routineDayResponseSchema,
  routineDaySchema,
  routineDeletionResponseSchema,
  routineDeletionSchema,
  routineEditScopeSchema,
  routineListQuerySchema,
  routineOccurrencePatchSchema,
  routineOccurrenceResponseSchema,
  routineOccurrenceSchema,
  routineOccurrenceStatusSchema,
  routineRuleChangeResponseSchema,
  routineRuleChangeSchema,
  routineRuleCreateSchema,
  routineRuleListResponseSchema,
  routineRulePatchSchema,
  routineRuleResponseSchema,
  routineRuleSchema,
  routineStatusSchema
} from "./routines/routines.js";
export type {
  Recurrence,
  RoutineDay,
  RoutineListQuery,
  RoutineOccurrence,
  RoutineOccurrencePatch,
  RoutineRule,
  RoutineRuleCreate,
  RoutineRulePatch,
  RoutineStatus
} from "./routines/routines.js";
export {
  TIMER_ALREADY_RUNNING,
  timerActionSchema,
  timerHistoryQuerySchema,
  timerHistoryResponseSchema,
  timerModeSchema,
  timerNextSchema,
  timerPatchSchema,
  timerPhaseSchema,
  timerPresetSchema,
  timerRunStatusSchema,
  timerSessionSchema,
  timerSnapshotResponseSchema,
  timerSnapshotSchema,
  timerStartSchema
} from "./timers/timers.js";
export type {
  TimerHistoryQuery,
  TimerPatch,
  TimerPhase,
  TimerPreset,
  TimerRunStatus,
  TimerSession,
  TimerSnapshot,
  TimerStart
} from "./timers/timers.js";
export {
  ITEM_LIMITS,
  REFRESH_MINUTES,
  WIDGET_SIZES,
  WIDGET_TYPES,
  calendarScopeSchema,
  itemLimitSchema,
  newsSourceModeSchema,
  refreshMinutesSchema,
  temperatureUnitSchema,
  widgetPreferencePatchSchema,
  widgetPreferenceSchema,
  widgetPreferencesPatchSchema,
  widgetPreferencesResponseSchema,
  widgetPreferencesSchema,
  widgetSettingsSchema,
  widgetSizeSchema,
  widgetTypeSchema
} from "./widgets/preferences.js";
export type {
  WidgetPreference,
  WidgetPreferencePatch,
  WidgetPreferences,
  WidgetPreferencesPatch,
  WidgetSettings,
  WidgetSize,
  WidgetType
} from "./widgets/preferences.js";
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationChannelSchema,
  notificationDeliverySchema,
  notificationEventSchema,
  notificationFeedResponseSchema,
  notificationFeedSchema,
  notificationPreferencesResponseSchema,
  notificationPreferencesSchema,
  notificationStatusSchema,
  pushSubscriptionCreateSchema,
  pushSubscriptionResponseSchema,
  pushSubscriptionSchema
} from "./notifications/notifications.js";
export type {
  NotificationChannel,
  NotificationDelivery,
  NotificationEvent,
  NotificationPreferences,
  NotificationStatus,
  PushSubscription,
  PushSubscriptionCreate
} from "./notifications/notifications.js";
