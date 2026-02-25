import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { pool } from "./db";

export const ADMINS = new Set(["mj"]);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const result = await pool.query(
          "SELECT username, name, password_hash FROM users WHERE username = $1",
          [credentials.username]
        );

        const user = result.rows[0];
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!valid) return null;

        return {
          id: user.username,
          username: user.username,
          name: user.name,
          isAdmin: ADMINS.has(user.username),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Cast to our extended type on first sign-in
        const u = user as typeof user & { username: string; isAdmin: boolean };
        token.username = u.username;
        token.isAdmin = u.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { username: string; isAdmin: boolean }).username =
          token.username as string;
        (session.user as typeof session.user & { username: string; isAdmin: boolean }).isAdmin =
          token.isAdmin as boolean;
      }
      return session;
    },
  },
};
