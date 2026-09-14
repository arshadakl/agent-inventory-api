export interface User {
  id: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

export type AuthenticatedUser = Pick<User, "id" | "email">;
