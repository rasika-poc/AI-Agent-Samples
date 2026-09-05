import jwt from "jsonwebtoken";

import { env } from "./config";

export interface TokenPayload {
  sub: string;
  tenant_id: string;
  role: string;
}

// Same secret/algorithm as api-files (services/api-files/app/security.py) —
// tokens issued by /auth/login and /auth/signup are verified here as-is.
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: [env.jwtAlgorithm as jwt.Algorithm],
  }) as TokenPayload;
}
