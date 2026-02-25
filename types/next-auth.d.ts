import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      username: string;
      isAdmin: boolean;
    };
  }

  interface User extends DefaultUser {
    username: string;
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    username: string;
    isAdmin: boolean;
  }
}
