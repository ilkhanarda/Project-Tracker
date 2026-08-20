export type User = {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
};

export type LoginValues = {
  email: string;
  password: string;
};

export type RegisterValues = LoginValues & {
  displayName: string;
};

export type MobileAuthResponse = {
  user: User;
  session: {
    token: string;
    expiresAt: string;
  };
};
