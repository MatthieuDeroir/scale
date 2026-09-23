export interface SessionPayload {
  userId: number;
  username: string;
  role: string;
}

export function createSession(user: {
  userId: number;
  username: string;
  role: string;
}): Promise<string>;

export function readSession(token: string | undefined): Promise<SessionPayload | null>;

export const sessionCookie: {
  name: string;
  options: {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    maxAge: number;
  };
};
