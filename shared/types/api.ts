export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_ORIGIN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "EMAIL_ALREADY_EXISTS"
  | "API_KEY_NAME_CONFLICT"
  | "CANNOT_DELETE_SELF"
  | "INTERNAL_ERROR"
  | "INBOX_EVENT_DUPLICATE"
  | "INBOX_SEND_FAILED"
  | "INBOX_MEDIA_TOO_LARGE"
  | "INBOX_INVALID_PHONE"
  | "INBOX_MESSAGE_NOT_FOUND"
  | "INBOX_CONVERSATION_NOT_FOUND"
  | "INBOX_ATTACHMENT_NOT_FOUND"
  | "INBOX_SCOPE_REQUIRED"
  | "INBOX_INVALID_EVENT"
  | "INBOX_PROVIDER_ERROR";

export interface ApiData<T> {
  data: T;
}
