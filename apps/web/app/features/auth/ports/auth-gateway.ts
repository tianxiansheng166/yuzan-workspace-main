import type { AuthCredentials, AuthResult } from "../models";

export interface AuthGateway {
  signIn(credentials: AuthCredentials): Promise<AuthResult>;
}
