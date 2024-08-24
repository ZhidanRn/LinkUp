import { NextAuthOptions } from 'next-auth'
import { UpstashRedisAdapter } from '@next-auth/upstash-redis-adapter'
import { db } from './db'
import GoogleProvider from 'next-auth/providers/google'
import { fetchRedis } from '@/helpers/redis'

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || clientId.length === 0) {
    throw new Error('Missing GOOGLE_CLIENT_ID')
  }

  if (!clientSecret || clientSecret.length === 0) {
    throw new Error('Missing GOOGLE_CLIENT_SECRET')
  }

  return { clientId, clientSecret }
}

export const authOptions: NextAuthOptions = {
  adapter: UpstashRedisAdapter(db),
  session: {
    strategy: 'jwt',
  },

  pages: {
    signIn: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: getGoogleCredentials().clientId,
      clientSecret: getGoogleCredentials().clientSecret,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // Set the user ID in the token on first sign-in
        token.id = user.id
      } else {
        // Fetch user data from Redis if the token is not associated with a user
        const dbUserResult = await fetchRedis('get', `user:${token.id}`) as string | null
        if (dbUserResult) {
          const dbUser = JSON.parse(dbUserResult) as User
          token = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            picture: dbUser.image,
          }
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.name = token.name
        session.user.email = token.email
        session.user.image = token.picture
      }
      return session
    },

    redirect() {
      return '/dashboard'
    },
  },
}
