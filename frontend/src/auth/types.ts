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

export type AuthContextValue = {
  user: User | null;
  isAuthLoading: boolean;
  login: (values: LoginValues) => Promise<void>;
  register: (values: RegisterValues) => Promise<void>;
  logout: () => Promise<void>;
};
