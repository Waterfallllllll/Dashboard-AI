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
export type { EntityId, LocalDate, PageQuery, UtcDateTime } from "./common/primitives.js";
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
  dashboardResponseSchema,
  dashboardSchema,
  datetimeSectionSchema,
  externalSectionSchema,
  routinesSectionSchema,
  sectionErrorSchema,
  timerSectionSchema,
  widgetsSectionSchema
} from "./dashboard/dashboard.js";
export type { Dashboard, ExternalSection } from "./dashboard/dashboard.js";
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
