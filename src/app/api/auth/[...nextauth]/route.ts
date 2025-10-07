// FILE: src/app/api/auth/[...nextauth]/route.ts
// This file handles all NextAuth authentication logic

import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  // Configure authentication providers
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "Enter your username" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // IMPORTANT: Replace this with your actual database check
        // For now, using hardcoded credentials for testing
        if (credentials?.username === 'admin' && credentials?.password === 'password') {
          return {
            id: '1',
            name: 'Admin User',
            email: 'admin@robloxverifier.com',
            role: 'admin'
          };
        }
        
        // You can add more users here or connect to a database
        // Example with multiple users:
        // if (credentials?.username === 'analyst' && credentials?.password === 'analyst123') {
        //   return {
        //     id: '2',
        //     name: 'Analyst User',
        //     email: 'analyst@robloxverifier.com',
        //     role: 'analyst'
        //   };
        // }
        
        // Return null if authentication fails
        return null;
      }
    })
  ],
  
  // Configure custom pages
  pages: {
    signIn: '/auth/signin',  // Custom sign-in page
    error: '/auth/signin',    // Redirect errors to sign-in page
  },
  
  // Configure session strategy
  session: {
    strategy: 'jwt',  // Use JSON Web Tokens for sessions
    maxAge: 30 * 24 * 60 * 60, // Session expires after 30 days
  },
  
  // Configure JWT
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // JWT expires after 30 days
  },
  
  // Callbacks to customize behavior
  callbacks: {
    // This callback runs when JWT is created or updated
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    
    // This callback runs when session is accessed
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  
  // Secret key for encrypting tokens (MUST be set in .env.local)
  secret: process.env.NEXTAUTH_SECRET,
  
  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',
};

// Create and export the NextAuth handler
const handler = NextAuth(authOptions);

// Export for both GET and POST requests
export { handler as GET, handler as POST };
