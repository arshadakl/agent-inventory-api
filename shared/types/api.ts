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
  | "INTERNAL_ERROR";

export interface ApiData<T> {
  data: T;
}
