export type User = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

export type AuthTokens = {
  accessToken: string;
  user: User;
};
