import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function getServerSession() {
  const cookieStore = await cookies()
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  })

  const token = cookieStore.get('sb-access-token')?.value

  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) return null

  return user
}

export async function getUserRole(email: string) {
  const prisma = (await import('@/lib/prisma')).default
  const user = await prisma.user.findUnique({
    where: { email }
  })
  return user?.role || 'AGENT'
}
